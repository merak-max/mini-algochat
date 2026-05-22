import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 8787;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function looksLikeUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function cleanEnv(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveOpenAIConfig() {
  const keyCandidates = [
    cleanEnv(process.env.OPENAI_API_KEY),
    cleanEnv(process.env.OPENAI_API_URL),
    cleanEnv(process.env.OPENAI_BASE_URL),
  ];

  const urlCandidates = [
    cleanEnv(process.env.OPENAI_BASE_URL),
    cleanEnv(process.env.OPENAI_API_URL),
  ];

  const apiKey = keyCandidates.find(function (value) {
    return value && !looksLikeUrl(value);
  });

  const baseURL = urlCandidates.find(function (value) {
    return value && looksLikeUrl(value);
  });

  return {
    apiKey,
    baseURL,
  };
}

const openAIConfig = resolveOpenAIConfig();
const client = openAIConfig.apiKey
  ? new OpenAI({
      apiKey: openAIConfig.apiKey,
      ...(openAIConfig.baseURL ? { baseURL: openAIConfig.baseURL } : {}),
    })
  : null;

app.use(express.json({ limit: "1mb" }));

function createFallbackReply(messages) {
  const lastUserMessage = [...messages]
    .reverse()
    .find(function (message) {
      return message.sender === "user";
    });

  const text = lastUserMessage?.text?.trim() || "there";

  return `I received: "${text}". The OpenAI SDK is running in local fallback mode because no valid key was accepted. Add OPENAI_API_KEY, or place the key in OPENAI_API_URL or OPENAI_BASE_URL if that is how this workspace is configured.`;
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
      model: process.env.OPENAI_MODEL || "gpt-5.2",
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

app.use(express.static(path.join(__dirname, "dist")));

app.use(function (req, res) {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(port, function () {
  console.log(`Mini AlgoChat server running on http://localhost:${port}`);
  console.log(
    client
      ? `OpenAI SDK active${openAIConfig.baseURL ? ` with baseURL ${openAIConfig.baseURL}` : ""}`
      : "OpenAI SDK fallback mode active"
  );
});
