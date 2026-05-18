import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [chats, setChats] = useState(function () {
    const savedChats = localStorage.getItem("mini-algochats");

    if (savedChats) {
      return JSON.parse(savedChats);
    }

    return [
      {
        id: Date.now(),
        title: "New Chat",
        messages: [
          {
            sender: "bot",
            text: "Hey! I am your AI assistant. What do you want to ask?",
          },
        ],
      },
    ];
  });

  const [activeChatId, setActiveChatId] = useState(function () {
    const savedChats = localStorage.getItem("mini-algochats");

    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      return parsedChats[0]?.id;
    }

    return null;
  });

  const [inputText, setInputText] = useState("");
  const [searchText, setSearchText] = useState("");

  useEffect(
    function () {
      localStorage.setItem("mini-algochats", JSON.stringify(chats));
    },
    [chats]
  );

  const activeChat = chats.find(function (chat) {
    return chat.id === activeChatId;
  });

  function getBotReply(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes("hi") || lowerMessage.includes("hello")) {
      return "Hello! How can I help you today?";
    } else if (lowerMessage.includes("roadmap")) {
      return "Your roadmap is React → Backend → Database → Auth → AI apps.";
    } else if (lowerMessage.includes("weather")) {
      return "You already built and deployed a Weather App. Nice progress.";
    } else if (lowerMessage.includes("backend")) {
      return "Backend is the server side. It receives requests, talks to database or AI API, and sends response back to frontend.";
    } else if (lowerMessage.includes("react")) {
      return "React helps us build UI using components, state, props, and events.";
    } else {
      return "I am a fake AI for now. Later we will connect a real AI API.";
    }
  }

  function createNewChat() {
    const newChat = {
      id: Date.now(),
      title: "New Chat",
      messages: [
        {
          sender: "bot",
          text: "New chat started. Ask me anything.",
        },
      ],
    };

    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setInputText("");
  }

  function sendMessage() {
    if (!activeChat) {
      return;
    }

    const trimmedInput = inputText.trim();

    if (trimmedInput === "") {
      return;
    }

    const userMessage = {
      sender: "user",
      text: trimmedInput,
    };

    const botMessage = {
      sender: "bot",
      text: getBotReply(trimmedInput),
    };

    const updatedChats = chats.map(function (chat) {
      if (chat.id === activeChatId) {
        const updatedTitle =
          chat.title === "New Chat"
            ? trimmedInput.slice(0, 30)
            : chat.title;

        return {
          ...chat,
          title: updatedTitle,
          messages: [...chat.messages, userMessage, botMessage],
        };
      }

      return chat;
    });

    setChats(updatedChats);
    setInputText("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      sendMessage();
    }
  }

  function deleteChat(chatId) {
    const filteredChats = chats.filter(function (chat) {
      return chat.id !== chatId;
    });

    setChats(filteredChats);

    if (activeChatId === chatId) {
      if (filteredChats.length > 0) {
        setActiveChatId(filteredChats[0].id);
      } else {
        setActiveChatId(null);
      }
    }
  }

  const filteredChats = chats.filter(function (chat) {
    return chat.title.toLowerCase().includes(searchText.toLowerCase());
  });

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Mini AlgoChat</h2>

        <button className="new-chat-btn" onClick={createNewChat}>
          + New Chat
        </button>

        <input
          className="search"
          type="text"
          placeholder="Search chats..."
          value={searchText}
          onChange={function (event) {
            setSearchText(event.target.value);
          }}
        />

        <div className="chat-list">
          {filteredChats.length === 0 ? (
            <p className="empty">No chats found</p>
          ) : (
            filteredChats.map(function (chat) {
              return (
                <div
                  key={chat.id}
                  className={
                    chat.id === activeChatId ? "chat-item active" : "chat-item"
                  }
                >
                  <button
                    className="chat-title"
                    onClick={function () {
                      setActiveChatId(chat.id);
                    }}
                  >
                    {chat.title}
                  </button>

                  <button
                    className="delete-btn"
                    onClick={function () {
                      deleteChat(chat.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <main className="chat-area">
        {activeChat ? (
          <>
            <header className="chat-header">
              <h1>{activeChat.title}</h1>
            </header>

            <div className="messages">
              {activeChat.messages.map(function (message, index) {
                return (
                  <div key={index} className={`message ${message.sender}`}>
                    {message.text}
                  </div>
                );
              })}
            </div>

            <div className="input-area">
              <input
                type="text"
                placeholder="Ask anything..."
                value={inputText}
                onChange={function (event) {
                  setInputText(event.target.value);
                }}
                onKeyDown={handleKeyDown}
              />

              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : (
          <div className="no-chat">
            <h1>No chat selected</h1>
            <button onClick={createNewChat}>Start New Chat</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;