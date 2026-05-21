import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
const BACKEND_URL = "https://chatverse-backend-5x7w.onrender.com";
const socket = io(BACKEND_URL);

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUser, setTypingUser] = useState("");
  const messagesEndRef = useRef(null);

  // New States
  const [activeTab, setActiveTab] = useState("home");
  const [activeRoom, setActiveRoom] = useState("Global");
  const [activeDM, setActiveDM] = useState(null); // { id, name }
  const [momentsFeed, setMomentsFeed] = useState([]);
  const [momentCaption, setMomentCaption] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      setTimeout(() => setTypingUser(""), 3000);
    });

    // Moments
    socket.on("momentsList", (m) => setMomentsFeed(m));
    socket.on("newMoment", (m) => setMomentsFeed((prev) => [m, ...prev]));

    return () => {
      socket.off("message");
      socket.off("privateMessage");
      socket.off("onlineUsers");
      socket.off("typing");
      socket.off("momentsList");
      socket.off("newMoment");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser, activeTab]);

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
    if (activeDM) {
      socket.emit("privateMessage", { toUserId: activeDM.id, message: input });
      // Add own message to UI since server only sends it to recipient
      setMessages((prev) => [...prev, { user: username, text: input, isPrivate: true, toId: activeDM.id }]);
    } else {
      socket.emit("sendMessage", input);
    }
    setInput("");
  };

  const uploadImage = async (e, type = "chat") => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      if (data.url) {
        if (type === "chat") {
          if (activeDM) {
             socket.emit("privateMessage", { toUserId: activeDM.id, message: data.url });
             setMessages((prev) => [...prev, { user: username, text: data.url, isPrivate: true }]);
          } else {
             socket.emit("sendMessage", data.url);
          }
        } else if (type === "moment") {
          socket.emit("shareMoment", { image: data.url, caption: momentCaption });
          setMomentCaption("");
        }
      }
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const switchRoom = (room) => {
    setActiveRoom(room);
    setActiveDM(null);
    setActiveTab("home");
    setIsSidebarOpen(false);
    socket.emit("joinRoom", room);
  };

  const startDM = (id, name) => {
    setActiveDM({ id, name });
    setActiveRoom(null);
    setActiveTab("home");
    setIsSidebarOpen(false);
  };

  if (!joined) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 text-white font-sans">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-3xl shadow-xl w-[90%] max-w-sm flex flex-col items-center">
          <h1 className="text-4xl font-bold mb-2">ChatterVerse</h1>
          <p className="mb-6 opacity-80">Connect, share, and make friends.</p>
          <input
            className="w-full p-3 rounded-xl text-black mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Enter your name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinChat()}
          />
          <button onClick={joinChat} className="w-full p-3 bg-purple-700 rounded-xl hover:bg-purple-800 transition-colors font-semibold">
            Enter the Verse
          </button>
        </div>
      </div>
    );
  }

  // Filter messages for current view (Room or DM)
  const displayMessages = messages.filter(msg => {
    if (activeDM) {
      return msg.isPrivate && (msg.fromId === activeDM.id || msg.toId === activeDM.id || (msg.user === username && msg.isPrivate));
    } else {
      return !msg.isPrivate; 
    }
  });

  return (
    <div className="h-screen flex bg-gradient-to-br from-purple-600 to-blue-500 text-white font-sans relative overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`absolute z-50 h-full w-64 p-5 flex flex-col bg-white/10 backdrop-blur-xl border-r border-white/20 shadow-lg transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <h1 className="text-2xl font-bold mb-8 tracking-wide">🌐 ChatterVerse</h1>

        <div className="space-y-2 mb-8">
          <button onClick={() => { setActiveTab("home"); setIsSidebarOpen(false); }} className={`block w-full text-left p-3 rounded-xl transition-colors font-medium ${activeTab === 'home' ? 'bg-white/30 shadow-sm' : 'bg-white/10 hover:bg-white/20'}`}>
            🏠 Chat
          </button>
          <button onClick={() => { setActiveTab("discover"); setIsSidebarOpen(false); }} className={`block w-full text-left p-3 rounded-xl transition-colors font-medium ${activeTab === 'discover' ? 'bg-white/30 shadow-sm' : 'bg-white/10 hover:bg-white/20'}`}>
            🔍 Discover
          </button>
          <button onClick={() => { setActiveTab("friends"); setIsSidebarOpen(false); }} className={`block w-full text-left p-3 rounded-xl transition-colors font-medium ${activeTab === 'friends' ? 'bg-white/30 shadow-sm' : 'bg-white/10 hover:bg-white/20'}`}>
            🤝 Friends
          </button>
          <button onClick={() => { setActiveTab("moments"); setIsSidebarOpen(false); }} className={`block w-full text-left p-3 rounded-xl transition-colors font-medium ${activeTab === 'moments' ? 'bg-white/30 shadow-sm' : 'bg-white/10 hover:bg-white/20'}`}>
            📸 Moments
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 opacity-70">Online ({Object.keys(onlineUsers).length})</h2>
          <div className="space-y-2">
            {Object.entries(onlineUsers).map(([id, name]) => (
              <div key={id} onClick={() => id !== socket.id && startDM(id, name)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/20 cursor-pointer transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium truncate">{name} {name === username ? "(You)" : ""}</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-green-400 shrink-0"></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 overflow-hidden relative">
        
        {activeTab === "home" && (
          <>
            <div className="mb-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                <h2 className="text-xl font-bold truncate">
                  {activeDM ? `💬 Chatting with ${activeDM.name}` : `🗣️ Room: ${activeRoom}`}
                </h2>
              </div>
              {activeDM && <button onClick={() => switchRoom("Global")} className="text-sm bg-white/20 px-3 py-1 rounded-full hover:bg-white/30 shrink-0">Back to Global</button>}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar">
              {displayMessages.map((msg, index) => {
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
                    <span className="text-xs opacity-70 mb-1 ml-1">{msg.user}</span>
                    <div className={`p-4 rounded-2xl max-w-[85%] md:max-w-[70%] shadow-md ${isMe ? 'bg-purple-600 rounded-tr-sm' : 'bg-white/20 backdrop-blur-md rounded-tl-sm'}`}>
                      {msg.text.startsWith('http') && msg.text.includes('/uploads/') ? (
                        <img src={msg.text} alt="Shared" className="rounded-xl max-h-60 object-contain mt-1" />
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {typingUser && typingUser !== username && !activeDM && (
                 <div className="flex items-start">
                   <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl rounded-tl-sm text-sm italic opacity-80">
                     {typingUser} is typing...
                   </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 flex gap-2">
              <label className="p-4 bg-white/20 backdrop-blur-lg rounded-2xl hover:bg-white/30 transition-colors cursor-pointer flex items-center justify-center shrink-0">
                <span className="text-xl">📸</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, "chat")} />
              </label>
              <input
                className="flex-1 p-4 rounded-2xl bg-white/20 backdrop-blur-lg text-white placeholder-white/70 focus:outline-none focus:bg-white/30 transition-all border border-white/10"
                placeholder={activeDM ? `Message ${activeDM.name}...` : `Message ${activeRoom}...`}
                value={input}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button
                onClick={sendMessage}
                className="px-6 md:px-8 bg-pink-600 rounded-2xl hover:bg-pink-700 transition-colors font-bold shadow-lg flex items-center justify-center gap-2 shrink-0"
              >
                <span className="hidden md:inline">Send</span>
                <svg className="w-5 h-5 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              </button>
            </div>
          </>
        )}

        {activeTab === "discover" && (
          <div className="flex-1 flex flex-col animate-fade-in-up">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
              <h2 className="text-3xl font-bold">Explore Rooms</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {["Global", "Gaming 🎮", "Music 🎵", "Tech Talk 💻", "Chill Zone ☕", "Movies 🍿"].map(room => (
                <button 
                  key={room} 
                  onClick={() => switchRoom(room)}
                  className={`p-6 rounded-3xl text-left transition-all ${activeRoom === room && !activeDM ? 'bg-gradient-to-r from-pink-500 to-purple-500 shadow-xl scale-[1.02]' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  <h3 className="text-xl font-bold mb-2">{room}</h3>
                  <p className="opacity-70 text-sm">Join the conversation and meet new friends.</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "friends" && (
          <div className="flex-1 flex flex-col animate-fade-in-up">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
              <h2 className="text-3xl font-bold">Your Friends</h2>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6">
              <p className="opacity-70 mb-6">Click on any online user to start a private conversation.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(onlineUsers).filter(([id]) => id !== socket.id).map(([id, name]) => (
                  <div key={id} onClick={() => startDM(id, name)} className="bg-white/10 p-4 rounded-2xl hover:bg-white/20 cursor-pointer transition-all flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-2xl font-bold shadow-md">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-lg">{name}</span>
                    <span className="text-xs bg-green-500/20 text-green-300 px-3 py-1 rounded-full">Online</span>
                  </div>
                ))}
                {Object.keys(onlineUsers).length <= 1 && (
                  <div className="col-span-full text-center p-8 opacity-50">
                    No other users are online right now. Invite some friends!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "moments" && (
          <div className="flex-1 flex flex-col animate-fade-in-up overflow-hidden">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-white/20 rounded-xl hover:bg-white/30 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
              <h2 className="text-3xl font-bold">Community Moments</h2>
            </div>
            
            {/* Upload Moment Bar */}
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl mb-6 flex flex-col sm:flex-row gap-4 items-center">
              <input 
                className="flex-1 w-full sm:w-auto p-3 rounded-xl bg-white/10 focus:bg-white/20 outline-none transition-all placeholder-white/60" 
                placeholder="Write a caption..." 
                value={momentCaption}
                onChange={(e) => setMomentCaption(e.target.value)}
              />
              <label className="w-full sm:w-auto justify-center px-6 py-3 bg-pink-600 rounded-xl hover:bg-pink-700 transition-colors font-bold shadow-lg flex items-center gap-2 cursor-pointer shrink-0">
                <span>Upload Photo</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, "moment")} />
              </label>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {momentsFeed.length === 0 ? (
                <div className="text-center p-12 opacity-50">Be the first to share a moment!</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {momentsFeed.map(moment => (
                    <div key={moment.id} className="bg-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl">
                      <img src={moment.image} alt="Moment" className="w-full h-64 object-cover" />
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center font-bold text-xs">
                            {moment.user.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{moment.user}</span>
                          <span className="text-xs opacity-50 ml-auto">{new Date(moment.createdAt).toLocaleTimeString()}</span>
                        </div>
                        {moment.caption && <p className="text-sm opacity-90">{moment.caption}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
