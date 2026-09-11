import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./App.css";
import { createStarterChat, readChats, messagesForApi, STORAGE_KEY } from "./chat-state.js";
import { MAX_MESSAGE_LENGTH, validateMessages } from "../shared/chat.js";
import { requestApi } from "./api.js";
import MessageContent from "./MessageContent.jsx";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const quickPrompts = [
  "Explain React like I am 12",
  "Build me a 30-day coding roadmap",
  "Debug this API idea",
  "Suggest a premium SaaS project",
];

const workspaceStats = [
  { label: "History", value: "This browser" },
  { label: "Assistant", value: "AI tutor" },
  { label: "Tone", value: "Calm" },
];

const craftNotes = [
  "Minimal surfaces",
  "Fast local history",
  "Clear connection status",
];

function loadInitialState() {
  try {
    return { chats: readChats(localStorage), storageError: "" };
  } catch {
    return {
      chats: [createStarterChat()],
      storageError: "Saved chats could not be loaded. Existing stored data has been left untouched; new changes will not be saved.",
    };
  }
}

function App() {
  const shellRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [initialState] = useState(loadInitialState);
  const [chats, setChats] = useState(initialState.chats);
  const [activeChatId, setActiveChatId] = useState(initialState.chats[0]?.id || null);
  const [storageError, setStorageError] = useState(initialState.storageError);
  const [connection, setConnection] = useState("Checking backend…");
  const [chatErrors, setChatErrors] = useState({});
  const requestInFlight = useRef(false);
  const [pendingChatId, setPendingChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [inputText, setInputText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function checkConnection() {
    setConnection("Checking backend…");
    try {
      const data = await requestApi("/api/health");
      if (typeof data.configured !== "boolean") throw new Error("Unexpected health response");
      setConnection(data.configured ? "Provider configured · not verified" : "AI setup needed");
    } catch {
      setConnection("Backend unavailable");
    }
  }

  useEffect(() => { checkConnection(); }, []);

  function setChatError(chatId, error) {
    setChatErrors((current) => ({ ...current, [chatId]: error }));
  }

  useGSAP(
    function () {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".sidebar-panel > *", {
        y: 18,
        opacity: 0,
        duration: 0.7,
        stagger: 0.055,
        ease: "power3.out",
      });

      gsap.from(".hero-card", {
        scale: 0.965,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });

      gsap.from(".detail-card", {
        y: 20,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".detail-grid",
          start: "top 85%",
        },
      });
    },
    { scope: shellRef }
  );

  useEffect(
    function () {
      if (initialState.storageError) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
        setStorageError("");
      } catch {
        setStorageError("Your browser could not save these changes. Keep this tab open to avoid losing them.");
      }
    },
    [chats, initialState.storageError]
  );

  useEffect(
    function () {
      if (!activeChatId && chats.length > 0) {
        setActiveChatId(chats[0].id);
      }
    },
    [activeChatId, chats]
  );

  useEffect(
    function () {
      const container = messagesEndRef.current?.parentElement;
      const hasUserMessages = chats.find((chat) => chat.id === activeChatId)?.messages.some((message) => message.sender === "user");
      container?.scrollTo({ top: hasUserMessages ? container.scrollHeight : 0, behavior: "instant" });
    },
    [chats, activeChatId, isLoading]
  );

  useEffect(
    function () {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rows = shellRef.current?.querySelectorAll(".message-row");
      const lastRow = rows?.[rows.length - 1];

      if (lastRow) {
        gsap.fromTo(
          lastRow,
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.34, ease: "power2.out" }
        );
      }
    },
    [chats, activeChatId, isLoading]
  );

  const activeChat = chats.find(function (chat) {
    return chat.id === activeChatId;
  });

  const activeMessageCount = activeChat?.messages.length || 0;

  const filteredChats = useMemo(
    function () {
      return chats.filter(function (chat) {
        return chat.title.toLowerCase().includes(searchText.toLowerCase());
      });
    },
    [chats, searchText]
  );

  async function getBotReply(messages) {
    const data = await requestApi("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (data.mode !== "openai" || typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("The backend did not return a genuine AI response. Check its configuration.");
    }

    return data.reply;
  }

  function appendBotMessage(chatId, text, kind = "message") {
    setChats(function (currentChats) {
      return currentChats.map(function (chat) {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, { sender: "bot", text, kind }],
          };
        }

        return chat;
      });
    });
  }

  async function getRealApiAdvice() {
    if (!activeChat || requestInFlight.current) {
      return;
    }

    requestInFlight.current = true;
    setIsLoading(true);
    setPendingChatId(activeChatId);
    setChatError(activeChatId, null);

    try {
      const data = await requestApi("/api/advice");
      if (typeof data.advice !== "string") throw new Error("No advice was returned.");
      appendBotMessage(activeChatId, `Random advice (not AI): ${data.advice}`, "notice");
    } catch (error) {
      setChatError(activeChatId, { text: error.message });
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
      setPendingChatId(null);
    }
  }

  function createNewChat() {
    const newChat = createStarterChat("A blank conversation is ready. What shall we refine first?");

    setChats((current) => [newChat, ...current]);
    setActiveChatId(newChat.id);
    setInputText("");
    setSearchText("");
    setSidebarOpen(false);
  }

  async function sendMessage(customText, retry = false) {
    if (!activeChat || requestInFlight.current) {
      return;
    }

    const trimmedInput = (customText || inputText).trim();

    if (!retry && trimmedInput === "") {
      return;
    }

    const userMessage = {
      sender: "user",
      text: trimmedInput,
    };

    const updatedMessages = retry ? activeChat.messages : [...activeChat.messages, userMessage];
    const apiMessages = messagesForApi(updatedMessages);
    const validationError = validateMessages(apiMessages);
    if (validationError) {
      setChatError(activeChatId, { text: validationError });
      return;
    }

    setChats(function (currentChats) {
      return currentChats.map(function (chat) {
        if (chat.id === activeChatId) {
          const updatedTitle =
            chat.title === "New Chat" && !retry ? trimmedInput.slice(0, 34) : chat.title;

          return {
            ...chat,
            title: updatedTitle,
            messages: updatedMessages,
          };
        }

        return chat;
      });
    });

    if (!retry) setInputText("");
    requestInFlight.current = true;
    setIsLoading(true);
    setPendingChatId(activeChatId);
    setChatError(activeChatId, null);

    try {
      const replyText = await getBotReply(apiMessages);
      appendBotMessage(activeChatId, replyText);
      setConnection("AI reply verified this session");
    } catch (error) {
      setChatError(activeChatId, { text: error.message, retry: true });
      setConnection("AI request failed · check setup");
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
      setPendingChatId(null);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  }

  function deleteChat(chatId) {
    const filtered = chats.filter(function (chat) {
      return chat.id !== chatId;
    });

    setChats(filtered);

    if (activeChatId === chatId) {
      setActiveChatId(filtered[0]?.id || null);
    }
  }

  return (
    <main className="app-shell" ref={shellRef}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="paper-grain" />

      <button className="mobile-sidebar-toggle ghost-action" aria-expanded={sidebarOpen} aria-controls="conversations" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? "Close conversations" : `Conversations (${chats.length})`}
      </button>
      <aside id="conversations" className={`sidebar-panel${sidebarOpen ? " is-open" : ""}`}>
        <div className="brand-mark">
          <div className="brand-symbol">M</div>
          <div>
            <h2>Mini AlgoChat</h2>
            <p>Quiet AI workspace</p>
          </div>
        </div>

        <button className="primary-action" onClick={createNewChat}>
          New Chat
        </button>

        <label className="search-wrap">
          <span>Search</span>
          <input
            className="search"
            type="text"
            placeholder="Find a conversation"
            value={searchText}
            onChange={function (event) {
              setSearchText(event.target.value);
            }}
          />
        </label>

        <div className="mini-grid">
          <div>
            <span>Chats</span>
            <strong>{chats.length}</strong>
          </div>
          <div>
            <span>Messages</span>
            <strong>{activeMessageCount}</strong>
          </div>
        </div>

        <div className="chat-list">
          {filteredChats.length === 0 ? (
            <p className="empty">No chats found</p>
          ) : (
            filteredChats.map(function (chat) {
              return (
                <div
                  key={chat.id}
                  className={chat.id === activeChatId ? "chat-item active" : "chat-item"}
                >
                  <button
                    className="chat-title"
                    onClick={function () {
                      setActiveChatId(chat.id);
                      setSidebarOpen(false);
                    }}
                  >
                    <span>{chat.title}</span>
                    <small>{chat.messages.length} messages</small>
                  </button>

                  <button
                    className="delete-btn"
                    aria-label={`Delete ${chat.title}`}
                    onClick={function () {
                      deleteChat(chat.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="craft-card">
          <span>API</span>
          <strong>{connection}</strong>
          <p>Keys stay on the backend. Saved chats stay in this browser; sending a message shares conversation context with your AI provider.</p>
        </div>
      </aside>

      <section className="chat-panel">
        {storageError && <p className="error-notice" role="alert">{storageError}</p>}
        {activeChat ? (
          <>
            <header className="topbar">
              <div>
                <p>Current conversation</p>
                <h1>{activeChat.title}</h1>
              </div>
              <div className="topbar-actions">
                <div className="status-pill" role="status">
                  {connection}
                </div>
                <button className="ghost-action" onClick={checkConnection} disabled={isLoading}>Check connection</button>
                <button className="ghost-action" onClick={getRealApiAdvice} disabled={isLoading}>
                  Random advice
                </button>
              </div>
            </header>

            <div className="messages">
              {!activeChat.messages.some((message) => message.sender === "user") && <section className="hero-card">
                <div className="hero-copy">
                  <p className="quiet-label">Minimal assistant</p>
                  <h2>
                    Clear thought, soft interface, precise answers.
                  </h2>
                  <p>
                    A warm, restrained chat surface with Japanese-inspired spacing,
                    Apple-like focus, local memory, and a server-side OpenAI SDK path.
                  </p>
                </div>

                <div className="detail-grid">
                  {workspaceStats.map(function (stat) {
                    return (
                      <div className="detail-card" key={stat.label}>
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                      </div>
                    );
                  })}
                </div>

                <div className="quick-prompts">
                  {quickPrompts.map(function (prompt) {
                    return (
                      <button
                        key={prompt}
                        onClick={function () {
                          sendMessage(prompt);
                        }}
                        disabled={isLoading}
                      >
                        {prompt}
                      </button>
                    );
                  })}
                </div>
              </section>}

              <section className="craft-notes">
                {craftNotes.map(function (note) {
                  return <span key={note}>{note}</span>;
                })}
              </section>

              {activeChat.messages.map(function (message, index) {
                return (
                  <div key={index} className={`message-row ${message.sender}`}>
                    <div className="avatar">{message.sender === "user" ? "You" : "AI"}</div>
                    <div className="message-stack">
                      <div className="message-meta">
                        {message.sender === "user" ? "You" : "Mini AlgoChat"}
                      </div>
                      <div className="message-bubble">
                        <MessageContent text={message.text} markdown={message.sender === "bot"} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading && pendingChatId === activeChatId && (
                <div className="message-row bot">
                  <div className="avatar">AI</div>
                  <div className="message-stack">
                    <div className="message-meta">Mini AlgoChat is thinking</div>
                    <div className="message-bubble typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="composer-wrap">
              {chatErrors[activeChatId] && <div className="error-notice" role="alert">
                <p>{chatErrors[activeChatId].text}</p>
                {chatErrors[activeChatId].retry && <button className="ghost-action" disabled={isLoading} onClick={() => sendMessage(undefined, true)}>Retry last message</button>}
              </div>}
              <div className="composer">
                <textarea
                  aria-label="Message"
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder="Your message…"
                  value={inputText}
                  disabled={isLoading}
                  rows="1"
                  onChange={function (event) {
                    setInputText(event.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                />

                <button
                  onClick={function () {
                    sendMessage();
                  }}
                  disabled={isLoading || !inputText.trim()}
                >
                  {isLoading ? "Sending" : "Send"}
                </button>
              </div>
              <p className="composer-hint">Shift+Enter for a new line · {inputText.length}/{MAX_MESSAGE_LENGTH} characters</p>
            </div>
          </>
        ) : (
          <div className="no-chat">
            <div className="brand-symbol large">M</div>
            <h1>No chat selected</h1>
            <p>Create a fresh conversation to begin.</p>
            <button onClick={createNewChat}>Start New Chat</button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
