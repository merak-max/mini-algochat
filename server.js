import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import OpenAI from "openai";
import { validateMessages } from "./shared/chat.js";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const cleanEnv = (value) => value?.trim() || undefined;
const keylessGatewayEnabled = (env) => env.OPENAI_ALLOW_KEYLESS === "true" && Boolean(cleanEnv(env.OPENAI_BASE_URL));

// Constructing the app separately lets tests use an isolated, temporary port.
export function createApp(env = process.env) {
  const app = express();
  const apiKey = cleanEnv(env.OPENAI_API_KEY);
  const model = cleanEnv(env.OPENAI_MODEL) || "gpt-5.2";
  const baseURL = cleanEnv(env.OPENAI_BASE_URL);
  const keyless = keylessGatewayEnabled(env);
  const client = apiKey || keyless
    ? new OpenAI({
        // The SDK requires a constructor key; the placeholder is never sent.
        apiKey: keyless ? "keyless-gateway" : apiKey,
        ...(baseURL ? { baseURL } : {}),
        ...(keyless ? { defaultHeaders: { Authorization: null } } : {}),
        timeout: 45_000, maxRetries: 0,
      })
    : null;

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    // Same-origin local requests need no CORS. Cross-origin hosting is explicit.
    if (env.FRONTEND_ORIGIN && req.headers.origin === env.FRONTEND_ORIGIN) {
      res.setHeader("Access-Control-Allow-Origin", env.FRONTEND_ORIGIN);
      res.vary("Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "128kb" }));

  app.get("/api/health", (_req, res) => {
    // Configuration is present; a successful reply still needs verification.
    res.json({ ok: true, configured: Boolean(client), model });
  });

  app.post("/api/chat", async (req, res) => {
    const messages = req.body?.messages;
    const error = validateMessages(messages);
    if (error) return res.status(400).json({ error });
    if (!client) {
      return res.status(503).json({ error: "AI is not configured. Add your provider credentials to the server's .env file and restart it." });
    }
    try {
      const response = await client.responses.create({
        model,
        instructions: "You are Mini AlgoChat, a precise AI tutor. Keep replies useful, concise, and beginner-friendly. Format code in fenced code blocks.",
        max_output_tokens: 2048,
        store: false,
        input: messages.map((message) => ({ role: message.sender === "user" ? "user" : "assistant", content: message.text })),
      });
      if (!response.output_text?.trim()) return res.status(502).json({ error: "The AI returned no text. Please try again." });
      res.json({ reply: response.output_text, mode: "openai" });
    } catch (error) {
      // Don't expose provider internals, credentials, or conversation content.
      if (error.status === 401 || error.status === 403) {
        return res.status(502).json({ error: "The AI provider rejected the server credentials. Check the backend configuration." });
      }
      if (error.status === 429) {
        return res.status(429).json({ error: "The AI provider's usage limit was reached. Check your quota or try again later." });
      }
      if (error.name === "APIConnectionTimeoutError") {
        return res.status(504).json({ error: "The AI provider took too long to respond. Please try again." });
      }
      res.status(502).json({ error: "The AI provider could not complete the request. Check the backend URL and model, then try again." });
    }
  });

  app.get("/api/advice", async (_req, res) => {
    try {
      const response = await fetch("https://api.adviceslip.com/advice", {
        headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Advice unavailable");
      const data = await response.json();
      if (typeof data?.slip?.advice !== "string") throw new Error("Invalid advice");
      res.json({ advice: data.slip.advice });
    } catch {
      res.status(502).json({ error: "Random advice is unavailable right now. Please try again later." });
    }
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));
  const distDir = path.join(projectDir, "dist");
  app.get("/", (_req, res) => res.redirect("/mini-algochat/"));
  app.use("/mini-algochat", express.static(distDir));
  app.get("/mini-algochat/*splat", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.too.large") return res.status(413).json({ error: "This conversation is too large. Start a new chat." });
    if (error.type === "entity.parse.failed") return res.status(400).json({ error: "The request must contain valid JSON." });
    res.status(error.status === 404 ? 404 : 500).json({ error: "Request unavailable. For the frontend, run npm run client or build it first." });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST || "127.0.0.1";
  const port = process.env.PORT || 8787;
  createApp().listen(port, host, () => {
    console.log(`Mini AlgoChat server running on http://${host}:${port}`);
    console.log(cleanEnv(process.env.OPENAI_API_KEY) || keylessGatewayEnabled(process.env) ? "Provider configured (not yet verified)" : "AI not configured; add server credentials to .env");
  });
}
