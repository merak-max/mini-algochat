import test from "node:test";
import assert from "node:assert/strict";
import { validateMessages, MAX_MESSAGE_LENGTH, MAX_MESSAGES } from "../shared/chat.js";
import { readChats, createStarterChat, messagesForApi } from "../src/chat-state.js";

const user = (text = "Hello") => ({ sender: "user", text });

test("message validation rejects malformed input without throwing", () => {
  for (const messages of [undefined, null, {}, [], [null], [user(123)], [{ sender: "system", text: "hi" }], [user(" ")]]) {
    assert.equal(typeof validateMessages(messages), "string");
  }
  assert.equal(validateMessages([user()]), null);
  assert.equal(validateMessages([user(), { sender: "bot", text: "Hi" }, user("Again")]), null);
});

test("message validation bounds text and context without silently truncating", () => {
  assert.equal(validateMessages([user("a".repeat(MAX_MESSAGE_LENGTH))]), null);
  assert.match(validateMessages([user("a".repeat(MAX_MESSAGE_LENGTH + 1))]), /characters/);
  assert.match(validateMessages(Array.from({ length: MAX_MESSAGES + 1 }, () => user())), /too long/);
  assert.match(validateMessages(Array.from({ length: 9 }, () => user("a".repeat(8000)))), /too large/);
  assert.match(validateMessages([{ sender: "bot", text: "Hello" }]), /last message/);
});

test("new chats get unique IDs and informational welcome messages", () => {
  const first = createStarterChat();
  assert.notEqual(first.id, createStarterChat().id);
  assert.equal(first.messages[0].kind, "notice");
});

test("storage accepts existing numeric IDs and intentionally empty history", () => {
  const chats = [{ id: 123, title: "Old chat", messages: [user()] }];
  assert.deepEqual(readChats({ getItem: () => JSON.stringify(chats) }), chats);
  assert.deepEqual(readChats({ getItem: () => "[]" }), []);
  assert.equal(readChats({ getItem: () => null }).length, 1);
});

test("invalid saved history is reported, never written over", () => {
  for (const value of ["null", "{}", "oops", '[{"id":1,"title":"a","messages":[null]}]']) {
    assert.throws(() => readChats({ getItem: () => value }));
  }
  const chat = createStarterChat();
  assert.throws(() => readChats({ getItem: () => JSON.stringify([chat, chat]) }));
});

test("only actual conversation messages are sent to the AI", () => {
  const input = [
    { sender: "bot", text: "Old welcome" }, user(),
    { sender: "bot", text: "Error: old failure" },
    { sender: "bot", text: "Real API advice: some advice" },
    { sender: "bot", text: "I received: hi. The OpenAI SDK is running in local fallback mode" },
    { sender: "bot", text: "New notice", kind: "notice" },
    { sender: "bot", text: "Hello back" }, user("Follow up"),
  ];
  assert.deepEqual(messagesForApi(input), [user(), { sender: "bot", text: "Hello back" }, user("Follow up")]);
});
