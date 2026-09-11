// Browser tests use only this local simulated provider, never paid credentials.
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "../../server.js";

const provider = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const text = `**Local test provider — not a real AI reply.**\n\nReceived ${body.input.length} conversation messages.\n\n\`\`\`js\nconsole.log("hello");\n\`\`\``;
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ object: "response", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }] }));
});
provider.listen(0, "127.0.0.1");
await once(provider, "listening");
const server = createApp({ OPENAI_API_KEY: "local-test-only", OPENAI_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1`, OPENAI_MODEL: "local-test" })
  .listen(18787, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(); server.closeAllConnections();
    provider.close(); provider.closeAllConnections();
  });
}
