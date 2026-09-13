export const MAX_MESSAGES = 80;
export const MAX_MESSAGE_LENGTH = 8000;
export const MAX_CONTEXT_LENGTH = 64000;

export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "No messages were sent.";
  if (messages.length > MAX_MESSAGES) return "This conversation is too long. Start a new chat.";
  let length = 0;
  for (const message of messages) {
    if (!message || !["user", "bot"].includes(message.sender) || typeof message.text !== "string" || !message.text.trim()) {
      return "Each message needs a valid sender and non-empty text.";
    }
    if (message.text.length > MAX_MESSAGE_LENGTH) return `Keep each message under ${MAX_MESSAGE_LENGTH + 1} characters.`;
    length += message.text.length;
  }
  if (length > MAX_CONTEXT_LENGTH) return "This conversation is too large. Start a new chat.";
  if (messages.at(-1).sender !== "user") return "The last message must be from you.";
  return null;
}
