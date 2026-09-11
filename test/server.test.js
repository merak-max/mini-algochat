import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "../server.js";

async function listen(t, server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

const message = { sender: "user", text: "Hello" };
const post = (url, body) => fetch(`${url}/api/chat`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("keyless gateway explicitly omits Authorization even with an inherited key", async (t) => {
  let authorization;
  const provider = await listen(t, createServer((req, res) => {
    authorization = req.headers.authorization;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ object: "response", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Keyless test reply" }] }] }));
  }));
  const url = await listen(t, createServer(createApp({ OPENAI_ALLOW_KEYLESS: "true", OPENAI_BASE_URL: `${provider}/v1`, OPENAI_API_KEY: "must-not-be-sent" })));
  assert.equal((await (await fetch(`${url}/api/health`)).json()).configured, true);
  const response = await post(url, { messages: [message] });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, "Keyless test reply");
  assert.equal(authorization, undefined);
});

test("keyless access requires both explicit opt-in and a gateway URL", async (t) => {
  for (const env of [{ OPENAI_ALLOW_KEYLESS: "true" }, { OPENAI_BASE_URL: "http://127.0.0.1:9/v1" }]) {
    const url = await listen(t, createServer(createApp(env)));
    assert.equal((await post(url, { messages: [message] })).status, 503);
  }
});

test("unconfigured backend reports setup required, never a fake answer", async (t) => {
  const url = await listen(t, createServer(createApp({})));
  const health = await (await fetch(`${url}/api/health`)).json();
  assert.equal(health.configured, false);
  const response = await post(url, { messages: [message] });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.match(data.error, /not configured/);
  assert.equal(data.reply, undefined);
});

test("invalid bodies and missing API routes return JSON errors", async (t) => {
  const url = await listen(t, createServer(createApp({})));
  for (const body of [{}, { messages: [null] }, { messages: [{ sender: "system", text: "hi" }] }]) {
    assert.equal((await post(url, body)).status, 400);
  }
  const malformed = await fetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /JSON/);
  const huge = await post(url, { messages: [{ ...message, text: "x".repeat(150000) }] });
  assert.equal(huge.status, 413);
  assert.ok((await huge.json()).error);
  const missing = await fetch(`${url}/api/missing`);
  assert.equal(missing.status, 404);
  assert.ok((await missing.json()).error);
});

test("cross-origin access is explicit, not wildcard", async (t) => {
  const url = await listen(t, createServer(createApp({ FRONTEND_ORIGIN: "https://frontend.example" })));
  const allowed = await fetch(`${url}/api/health`, { headers: { Origin: "https://frontend.example" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://frontend.example");
  const other = await fetch(`${url}/api/health`, { headers: { Origin: "https://other.example" } });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
});

test("actual SDK sends multi-turn Responses requests to a local simulated provider", async (t) => {
  let received;
  const provider = await listen(t, createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received = { path: req.url, body: JSON.parse(body) };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ object: "response", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Simulated reply" }] }] }));
  }));
  const url = await listen(t, createServer(createApp({ OPENAI_API_KEY: "test-only", OPENAI_BASE_URL: `${provider}/v1`, OPENAI_MODEL: "test-model" })));
  const messages = [message, { sender: "bot", text: "Hi" }, { sender: "user", text: "Remember my greeting?" }];
  const response = await post(url, { messages });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, "Simulated reply");
  assert.equal(received.path, "/v1/responses");
  assert.deepEqual(received.body.input.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(received.body.max_output_tokens, 2048);
  assert.equal(received.body.store, false);
  assert.equal(received.body.model, "test-model");
});

for (const [providerStatus, expectedStatus, expectedError] of [[401, 502, /credentials/], [429, 429, /usage limit/], [500, 502, /could not complete/]]) {
  test(`provider ${providerStatus} is handled without leaking internals`, async (t) => {
    const provider = await listen(t, createServer((_req, res) => {
      res.writeHead(providerStatus, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "private-provider-detail", type: "test_error" } }));
    }));
    const url = await listen(t, createServer(createApp({ OPENAI_API_KEY: "test-only", OPENAI_BASE_URL: `${provider}/v1` })));
    const response = await post(url, { messages: [message] });
    assert.equal(response.status, expectedStatus);
    const data = await response.json();
    assert.match(data.error, expectedError);
    assert.doesNotMatch(JSON.stringify(data), /private-provider-detail/);
  });
}

test("empty provider output is an error, not an invented answer", async (t) => {
  const provider = await listen(t, createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ object: "response", output: [] }));
  }));
  const url = await listen(t, createServer(createApp({ OPENAI_API_KEY: "test-only", OPENAI_BASE_URL: `${provider}/v1` })));
  const response = await post(url, { messages: [message] });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /no text/);
});
