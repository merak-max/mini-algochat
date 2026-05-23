import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 8787;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanEnv(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveOpenAIConfig() {
  return {
    apiKey: cleanEnv(process.env.OPENAI_API_KEY),
    baseURL: cleanEnv(process.env.OPENAI_BASE_URL),
    model: cleanEnv(process.env.OPENAI_MODEL) || "gpt-5.2",
  };
}

const openAIConfig = resolveOpenAIConfig();
const client = openAIConfig.apiKey
  ? new OpenAI({
      apiKey: openAIConfig.apiKey,
      ...(openAIConfig.baseURL ? { baseURL: openAIConfig.baseURL } : {}),
    })
  : null;

app.use(function (req, res, next) {
  const allowedOrigin = process.env.FRONTEND_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "1mb" }));

function createFallbackReply(messages) {
  const lastUserMessage = [...messages]
    .reverse()
    .find(function (message) {
      return message.sender === "user";
    });

  const text = lastUserMessage?.text?.trim() || "there";

  return `I received: "${text}". The OpenAI SDK is running in local fallback mode because no valid OPENAI_API_KEY was accepted on the backend.`;
}

function isAuthError(error) {
  return error.status === 401 || error.code === "invalid_api_key";
}

function normalizeMessages(messages) {
  return messages.map(function (message) {
    return {
      role: message.sender === "user" ? "user" : "assistant",
      content: String(message.text || ""),
    };
  });
}

app.get("/api/health", function (req, res) {
  res.json({ ok: true });
});

app.post("/api/chat", async function (req, res) {
  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];

  if (messages.length === 0) {
    return res.status(400).json({ error: "No messages were sent." });
  }

  if (!client) {
    return res.json({ reply: createFallbackReply(messages), mode: "fallback" });
  }

  try {
    const response = await client.responses.create({
      model: openAIConfig.model,
      instructions:
        "You are Mini AlgoChat, a precise AI tutor inside a calm minimalist chat workspace. Keep replies useful, concise, and beginner-friendly.",
      input: normalizeMessages(messages),
    });

    res.json({ reply: response.output_text || "I could not create a reply.", mode: "openai" });
  } catch (error) {
    console.error(error);

    if (isAuthError(error)) {
      return res.json({ reply: createFallbackReply(messages), mode: "fallback" });
    }

    res.status(500).json({
      error: error.message || "Something went wrong while calling the AI API.",
    });
  }
});

app.get("/api/advice", async function (req, res) {
  try {
    const response = await fetch("https://api.adviceslip.com/advice", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Advice API request failed.",
      });
    }

    const data = await response.json();
    const advice = data?.slip?.advice;

    if (!advice) {
      return res.status(502).json({ error: "Advice API returned no advice." });
    }

    res.json({ advice });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Something went wrong while calling the advice API.",
    });
  }
});

const distDir = path.join(__dirname, "dist");
const pagesBase = "/mini-algochat";

app.get("/", function (req, res) {
  res.redirect(`${pagesBase}/`);
});

app.use(pagesBase, express.static(distDir));
app.use(express.static(distDir, { index: false }));

app.get(`${pagesBase}/*splat`, function (req, res) {
  res.sendFile(path.join(distDir, "index.html"));
});

app.use(function (req, res) {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, function () {
  console.log(`Mini AlgoChat server running on http://localhost:${port}`);
  console.log(
    client
      ? `OpenAI SDK active${openAIConfig.baseURL ? ` with baseURL ${openAIConfig.baseURL}` : ""}`
      : "OpenAI SDK fallback mode active"
  );
});
