export const STORAGE_KEY = "mini-algochats";

export function createStarterChat(message = "Welcome to Mini AlgoChat. Ask a question or use a prepared prompt to begin.") {
  return { id: crypto.randomUUID(), title: "New Chat", messages: [{ sender: "bot", text: message, kind: "notice" }] };
}

export function readChats(storage) {
  const saved = storage.getItem(STORAGE_KEY);
  if (saved === null) return [createStarterChat()];
  const chats = JSON.parse(saved);
  const ids = new Set();
  if (!Array.isArray(chats) || !chats.every((chat) => {
    if (!chat || !["string", "number"].includes(typeof chat.id) || ids.has(chat.id)
      || typeof chat.title !== "string" || !Array.isArray(chat.messages)) return false;
    ids.add(chat.id);
    return chat.messages.every((message) => message && ["user", "bot"].includes(message.sender) && typeof message.text === "string");
  })) throw new Error("Invalid saved conversations");
  return chats;
}

// Keep older saved chats readable, but exclude their welcome/error/advice text.
export function messagesForApi(messages) {
  return messages.filter((message, index) => {
    if (message.kind === "notice" || message.kind === "error") return false;
    if (message.sender === "bot") {
      if (index === 0 || /^(Error:|Real API error:|Real API advice:)/.test(message.text)) return false;
      if (message.text.includes("The OpenAI SDK is running in local fallback mode")) return false;
    }
    return true;
  }).map(({ sender, text }) => ({ sender, text }));
}
