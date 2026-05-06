import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUser, setTypingUser] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("privateMessage", (msg) => {
      setMessages((prev) => [...prev, { ...msg, isPrivate: true }]);
    });

    socket.on("onlineUsers", (users) => {
      setOnlineUsers(users);
    });

    socket.on("typing", (user) => {
      setTypingUser(user);
      setTimeout(() => setTypingUser(""), 3000); // Clear typing indicator
    });

    return () => {
      socket.off("message");
      socket.off("privateMessage");
      socket.off("onlineUsers");
      socket.off("typing");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const joinChat = () => {
    if (!username.trim()) return;
    socket.emit("join", username);
    setJoined(true);
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    socket.emit("typing", username);
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    socket.emit("sendMessage", input);
    setInput("");
  };

  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (data.url) {
        socket.emit("sendMessage", data.url);
      }
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  if (!joined) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 text-white font-sans">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-3xl shadow-xl w-96 flex flex-col items-center">
          <h1 className="text-4xl font-bold mb-2">ChatterVerse</h1>
          <p className="mb-6 opacity-80">Connect, share, and make friends.</p>
          <input
            className="w-full p-3 rounded-xl text-black mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Enter your beautiful name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinChat()}
          />
          <button
            onClick={joinChat}
            className="w-full p-3 bg-purple-700 rounded-xl hover:bg-purple-800 transition-colors font-semibold"
          >
            Enter the Verse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-purple-600 to-blue-500 text-white font-sans">
      
      {/* Sidebar */}
      <div className="w-64 p-5 flex flex-col bg-white/10 backdrop-blur-md border-r border-white/20 shadow-lg">
        <h1 className="text-2xl font-bold mb-8 tracking-wide">🌐 ChatterVerse</h1>

        <div className="space-y-2 mb-8">
          <button className="block w-full text-left p-3 rounded-xl bg-white/20 hover:bg-white/30 transition-colors font-medium">
            🏠 Home
          </button>
          <button className="block w-full text-left p-3 rounded-xl hover:bg-white/10 transition-colors font-medium">
            🔍 Discover
          </button>
          <button className="block w-full text-left p-3 rounded-xl hover:bg-white/10 transition-colors font-medium">
            🤝 Friends
          </button>
          <button className="block w-full text-left p-3 rounded-xl hover:bg-white/10 transition-colors font-medium">
            📸 Moments
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 opacity-70">Online Users ({Object.keys(onlineUsers).length})</h2>
          <div className="space-y-2">
            {Object.entries(onlineUsers).map(([id, name]) => (
              <div key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 flex items-center justify-center font-bold">
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium">{name} {name === username ? "(You)" : ""}</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-green-400"></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8">
        
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar">
          {messages.map((msg, index) => {
            const isMe = msg.user === username;
            const isSystem = msg.user === "System";
            
            if (isSystem) {
              return (
                <div key={index} className="flex justify-center my-4">
                  <span className="bg-white/10 px-4 py-1 rounded-full text-sm opacity-80 backdrop-blur-sm">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                <span className="text-xs opacity-70 mb-1 ml-1">{msg.user} {msg.isPrivate ? " (Private)" : ""}</span>
                <div className={`p-4 rounded-2xl max-w-[70%] shadow-md ${isMe ? 'bg-purple-600 rounded-tr-sm' : 'bg-white/20 backdrop-blur-md rounded-tl-sm'}`}>
                  {msg.text.startsWith('http') && msg.text.includes('/uploads/') ? (
                    <img src={msg.text} alt="Shared" className="rounded-xl max-h-60 object-contain" />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  )}
                </div>
              </div>
            );
          })}
          
          {typingUser && typingUser !== username && (
             <div className="flex items-start">
               <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl rounded-tl-sm text-sm italic opacity-80">
                 {typingUser} is typing...
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="mt-6 flex gap-2">
          <label className="p-4 bg-white/20 backdrop-blur-lg rounded-2xl hover:bg-white/30 transition-colors cursor-pointer flex items-center justify-center">
            <span className="text-xl">📸</span>
            <input type="file" className="hidden" accept="image/*" onChange={uploadImage} />
          </label>
          <input
            className="flex-1 p-4 rounded-2xl bg-white/20 backdrop-blur-lg text-white placeholder-white/70 focus:outline-none focus:bg-white/30 transition-all border border-white/10"
            placeholder="Type a message..."
            value={input}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            className="px-8 bg-pink-600 rounded-2xl hover:bg-pink-700 transition-colors font-bold shadow-lg flex items-center gap-2"
          >
            <span>Send</span>
            <span className="text-lg">🚀</span>
          </button>
        </div>
      </div>
    </div>
  );
}
