import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./App.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const starterMessage =
  "Welcome to Mini AlgoChat. Ask a question, shape an idea, or use a prepared prompt to begin.";

const quickPrompts = [
  "Explain React like I am 12",
  "Build me a 30-day coding roadmap",
  "Debug this API idea",
  "Suggest a premium SaaS project",
];

const workspaceStats = [
  { label: "Model", value: "OpenAI SDK" },
  { label: "Context", value: "Local" },
  { label: "Tone", value: "Calm" },
];

const craftNotes = [
  "Minimal surfaces",
  "Fast local history",
  "Fallback-safe API flow",
];

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function getApiUrl(path) {
  if (!apiBaseUrl) {
    throw new Error(
      "Backend not configured for this static build. Set VITE_API_BASE_URL to your deployed backend URL."
    );
  }

  return `${apiBaseUrl}${path}`;
}

function createStarterChat(message = starterMessage) {
  return {
    id: Date.now(),
    title: "New Chat",
    messages: [
      {
        sender: "bot",
        text: message,
      },
    ],
  };
}

function getSavedChats() {
  try {
    const savedChats = localStorage.getItem("mini-algochats");
    return savedChats ? JSON.parse(savedChats) : null;
  } catch {
    return null;
  }
}

function App() {
  const shellRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [chats, setChats] = useState(function () {
    return getSavedChats() || [createStarterChat()];
  });

  const [activeChatId, setActiveChatId] = useState(function () {
    const savedChats = getSavedChats();
    return savedChats?.[0]?.id || null;
  });

  const [inputText, setInputText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useGSAP(
    function () {
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
      localStorage.setItem("mini-algochats", JSON.stringify(chats));
    },
    [chats]
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
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    [chats, activeChatId, isLoading]
  );

  useEffect(
    function () {
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
    const response = await fetch(getApiUrl("/api/chat"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI request failed.");
    }

    return data.reply;
  }

  function appendBotMessage(text) {
    setChats(function (currentChats) {
      return currentChats.map(function (chat) {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: [...chat.messages, { sender: "bot", text }],
          };
        }

        return chat;
      });
    });
  }

  async function getRealApiAdvice() {
    if (!activeChat || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl("/api/advice"));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Advice API request failed.");
      }

      appendBotMessage(`Real API advice: ${data.advice}`);
    } catch (error) {
      appendBotMessage(`Real API error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  function createNewChat() {
    const newChat = createStarterChat("A blank conversation is ready. What shall we refine first?");

    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setInputText("");
  }

  async function sendMessage(customText) {
    if (!activeChat || isLoading) {
      return;
    }

    const trimmedInput = (customText || inputText).trim();

    if (trimmedInput === "") {
      return;
    }

    const userMessage = {
      sender: "user",
      text: trimmedInput,
    };

    const messagesForApi = [...activeChat.messages, userMessage];

    setChats(function (currentChats) {
      return currentChats.map(function (chat) {
        if (chat.id === activeChatId) {
          const updatedTitle =
            chat.title === "New Chat" ? trimmedInput.slice(0, 34) : chat.title;

          return {
            ...chat,
            title: updatedTitle,
            messages: messagesForApi,
          };
        }

        return chat;
      });
    });

    setInputText("");
    setIsLoading(true);

    try {
      const replyText = await getBotReply(messagesForApi);
      appendBotMessage(replyText);
    } catch (error) {
      appendBotMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
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

      <aside className="sidebar-panel">
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
          <strong>OpenAI SDK ready</strong>
          <p>Reads OPENAI_API_KEY, OPENAI_API_URL, and OPENAI_BASE_URL with graceful fallback.</p>
        </div>
      </aside>

      <section className="chat-panel">
        {activeChat ? (
          <>
            <header className="topbar">
              <div>
                <p>Current conversation</p>
                <h1>{activeChat.title}</h1>
              </div>
              <div className="topbar-actions">
                <div className="status-pill">
                  <span />
                  Live SDK route
                </div>
                <button className="ghost-action" onClick={getRealApiAdvice} disabled={isLoading}>
                  Try Real API
                </button>
              </div>
            </header>

            <div className="messages">
              <section className="hero-card">
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
              </section>

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
                      <div className="message-bubble">{message.text}</div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
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
              <div className="composer">
                <textarea
                  placeholder="Write naturally. Press Enter to send."
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
              <p className="composer-hint">Shift and Enter creates a new line</p>
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
