import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";

const BACKEND_URL = "https://chatverse-backend-5x7w.onrender.com";
// Fallback for local testing if deployed isn't reachable
// const BACKEND_URL = "http://localhost:5000";
const socket = io(BACKEND_URL);

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) {}
};

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
  
  // Mega Feature States
  const [userProfile, setUserProfile] = useState({ bio: "", avatar: "" });
  const [darkMode, setDarkMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [editBio, setEditBio] = useState("");

  useEffect(() => {
    socket.on("messageHistory", (msgs) => setMessages(msgs));
    
    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (document.hidden && msg.user !== username) playBeep();
    });

    socket.on("privateMessage", (msg) => {
      setMessages((prev) => [...prev, { ...msg, isPrivate: true }]);
      if (document.hidden || activeDM?.id !== msg.fromId) playBeep();
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
    socket.on("updateMoment", (post) => setMomentsFeed((prev) => prev.map(m => m._id === post._id ? post : m)));

    // Profile
    socket.on("profileData", (data) => {
      setUserProfile(data);
      setEditBio(data.bio || "");
    });

    return () => {
      socket.off("messageHistory");
      socket.off("message");
      socket.off("privateMessage");
      socket.off("onlineUsers");
      socket.off("typing");
      socket.off("momentsList");
      socket.off("newMoment");
      socket.off("updateMoment");
      socket.off("profileData");
    };
  }, [username, activeDM]);

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
      setMessages((prev) => [...prev, { user: username, text: input, isPrivate: true, toUserId: activeDM.id }]);
    } else {
      socket.emit("sendMessage", input);
    }
    setInput("");
    setShowEmojiPicker(false);
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
             setMessages((prev) => [...prev, { user: username, text: data.url, isPrivate: true, toUserId: activeDM.id }]);
          } else {
             socket.emit("sendMessage", data.url);
          }
        } else if (type === "moment") {
          socket.emit("shareMoment", { image: data.url, caption: momentCaption });
          setMomentCaption("");
        } else if (type === "avatar") {
          socket.emit("updateProfile", { bio: editBio, avatar: data.url });
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

  const saveProfile = () => {
    socket.emit("updateProfile", { bio: editBio, avatar: userProfile.avatar });
    alert("Profile saved!");
  };

  const handleCommentChange = (momentId, text) => {
    setCommentInputs(prev => ({ ...prev, [momentId]: text }));
  };

  const submitComment = (momentId) => {
    const text = commentInputs[momentId];
    if (text && text.trim()) {
      socket.emit("commentMoment", { momentId, text });
      setCommentInputs(prev => ({ ...prev, [momentId]: "" }));
    }
  };

  const onEmojiClick = (emojiObject) => {
    setInput(prevInput => prevInput + emojiObject.emoji);
  };

  const Avatar = ({ url, name, size = "w-8 h-8" }) => (
    url ? <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0 shadow-md border border-white/20`} />
        : <div className={`${size} rounded-full bg-gradient-to-r from-pink-500 to-orange-400 flex items-center justify-center font-bold text-white shrink-0 shadow-md`}>{name ? name.charAt(0).toUpperCase() : '?'}</div>
  );

  if (!joined) {
    return (
      <div className={`h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-purple-600 to-blue-500'} text-white font-sans transition-colors duration-500`}>
        <div className="absolute top-4 right-4 cursor-pointer text-2xl" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️' : '🌙'}
        </div>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white/20'} backdrop-blur-lg p-8 rounded-3xl shadow-xl w-[90%] max-w-sm flex flex-col items-center`}>
          <h1 className="text-4xl font-bold mb-2">ChatterVerse</h1>
          <p className="mb-6 opacity-80 text-center">Connect, share, and make friends.</p>
          <input
            className={`w-full p-3 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400 ${darkMode ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-white text-black placeholder-gray-500'}`}
            placeholder="Enter your name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinChat()}
          />
          <button onClick={joinChat} className="w-full p-3 bg-pink-600 rounded-xl hover:bg-pink-700 transition-colors font-semibold">
            Enter the Verse
          </button>
        </div>
      </div>
    );
  }

  // Filter messages for current view (Room or DM)
  const displayMessages = messages.filter(msg => {
    if (activeDM) {
      // Find socket id of myself
      const myId = socket.id;
      return msg.isPrivate && (msg.user === activeDM.name || msg.toUserId === activeDM.id || msg.user === username);
    } else {
      return !msg.isPrivate; 
    }
  });

  const bgTheme = darkMode ? "bg-gray-900" : "bg-gradient-to-br from-purple-600 to-blue-500";
  const panelBg = darkMode ? "bg-gray-800" : "bg-white/10";
  const textTheme = darkMode ? "text-gray-100" : "text-white";

  return (
    <div className={`h-screen flex ${bgTheme} ${textTheme} font-sans relative overflow-hidden transition-colors duration-500`}>
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`absolute z-50 h-full w-64 p-5 flex flex-col ${panelBg} backdrop-blur-xl border-r ${darkMode ? 'border-gray-700' : 'border-white/20'} shadow-lg transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold tracking-wide">🌐 Chatter</h1>
          <button onClick={() => setDarkMode(!darkMode)} className="text-xl hover:scale-110 transition-transform">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6 p-3 rounded-2xl bg-white/5 border border-white/10 shadow-sm cursor-pointer hover:bg-white/10 transition" onClick={() => setActiveTab("profile")}>
          <Avatar url={userProfile.avatar} name={username} size="w-12 h-12" />
          <div className="overflow-hidden">
            <h3 className="font-bold truncate">{username}</h3>
            <p className="text-xs opacity-60 truncate">{userProfile.bio || "Add a bio..."}</p>
          </div>
        </div>

        <div className="space-y-2 mb-8">
          <button onClick={() => { setActiveTab("home"); setIsSidebarOpen(false); }} className={`block w-full text-left p-3 rounded-xl transition-colors font-medium ${activeTab === 'home' ? 'bg-pink-600 text-white shadow-md' : 'bg-white/5 hover:bg-white/10'}`}>
            🏠 Chat
          </button>
          <button onClick={() => { setActiveTab("discover"); setIsSidebarOpen(false); }} className={`block w-full text-left p-3 rounded-xl transition-colors font-medium ${activeTab === 'discover' ? 'bg-pink-600 text-white shadow-md' : 'bg-white/5 hover:bg-white/10'}`}>
            🔍 Discover
          </button>
          <button onClick={() => { setActiveTab("friends"); setIsSidebarOpen(false); }} className={`block w-full text-left p-3 rounded-xl transition-colors font-medium ${activeTab === 'friends' ? 'bg-pink-600 text-white shadow-md' : 'bg-white/5 hover:bg-white/10'}`}>
            🤝 Friends
          </button>
          <button onClick={() => { setActiveTab("moments"); setIsSidebarOpen(false); }} className={`block w-full text-left p-3 rounded-xl transition-colors font-medium ${activeTab === 'moments' ? 'bg-pink-600 text-white shadow-md' : 'bg-white/5 hover:bg-white/10'}`}>
            📸 Moments
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 opacity-50 px-2">Online ({Object.keys(onlineUsers).length})</h2>
          <div className="space-y-1">
            {Object.entries(onlineUsers).map(([id, userObj]) => (
              <div key={id} onClick={() => id !== socket.id && startDM(id, userObj.username)} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${activeDM?.id === id ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                <div className="relative">
                  <Avatar url={userObj.avatar} name={userObj.username} size="w-8 h-8" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-transparent"></span>
                </div>
                <span className="font-medium text-sm truncate">{userObj.username} {userObj.username === username ? "(You)" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 overflow-hidden relative">
        
        {/* Header (Hamburger Menu) */}
        <div className="flex items-center gap-4 mb-6 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className={`md:hidden p-2 rounded-xl transition shadow-sm ${darkMode ? 'bg-gray-800' : 'bg-white/20'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          {activeTab === "discover" && <h2 className="text-2xl md:text-3xl font-bold">Explore Rooms</h2>}
          {activeTab === "friends" && <h2 className="text-2xl md:text-3xl font-bold">Your Friends</h2>}
          {activeTab === "moments" && <h2 className="text-2xl md:text-3xl font-bold">Community Moments</h2>}
          {activeTab === "profile" && <h2 className="text-2xl md:text-3xl font-bold">Your Profile</h2>}
          {activeTab === "home" && (
            <div className={`flex-1 flex justify-between items-center ${panelBg} backdrop-blur-md p-3 px-5 rounded-2xl shadow-sm`}>
              <h2 className="text-lg md:text-xl font-bold truncate">
                {activeDM ? `💬 ${activeDM.name}` : `🗣️ ${activeRoom}`}
              </h2>
              {activeDM && <button onClick={() => switchRoom("Global")} className="text-xs md:text-sm bg-white/20 px-3 py-1.5 rounded-full hover:bg-white/30 shrink-0 shadow-sm transition">Leave DM</button>}
            </div>
          )}
        </div>
        
        {activeTab === "home" && (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 md:pr-4 custom-scrollbar">
              {displayMessages.map((msg, index) => {
                const isMe = msg.user === username;
                const isSystem = msg.user === "System";
                
                if (isSystem) {
                  return (
                    <div key={index} className="flex justify-center my-4">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm shadow-sm ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white/20'}`}>
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                // Find user's avatar if possible
                let msgAvatar = "";
                if (isMe) msgAvatar = userProfile.avatar;
                else {
                  const onlineUser = Object.values(onlineUsers).find(u => u.username === msg.user);
                  if (onlineUser) msgAvatar = onlineUser.avatar;
                }

                return (
                  <div key={index} className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 animate-fade-in-up`}>
                    <Avatar url={msgAvatar} name={msg.user} size="w-8 h-8 mb-1" />
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] md:max-w-[70%]`}>
                      <span className="text-[10px] opacity-60 mb-1 px-1 font-medium">{msg.user}</span>
                      <div className={`p-3.5 rounded-2xl shadow-md ${isMe ? (darkMode ? 'bg-pink-600 rounded-br-sm' : 'bg-purple-600 rounded-br-sm') : (darkMode ? 'bg-gray-800 rounded-bl-sm' : 'bg-white/20 backdrop-blur-md rounded-bl-sm')}`}>
                        {msg.text.startsWith('http') && msg.text.includes('/uploads/') ? (
                          <img src={msg.text} alt="Shared" className="rounded-xl max-h-60 object-contain mt-1 shadow-sm" />
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{msg.text}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {typingUser && typingUser !== username && !activeDM && (
                 <div className="flex items-end gap-2 opacity-70">
                   <Avatar name={typingUser} size="w-6 h-6 mb-1" />
                   <div className={`${panelBg} backdrop-blur-md p-3 rounded-2xl rounded-bl-sm text-xs italic shadow-sm`}>
                     {typingUser} is typing...
                   </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 relative z-20">
              {showEmojiPicker && (
                <div className="absolute bottom-[110%] right-0 md:left-12 shadow-2xl rounded-2xl overflow-hidden border border-white/10">
                  <EmojiPicker theme={darkMode ? "dark" : "light"} onEmojiClick={onEmojiClick} />
                </div>
              )}
              <div className="flex gap-1.5 sm:gap-2 items-center">
                <label className={`p-2.5 sm:p-3.5 ${panelBg} backdrop-blur-lg rounded-xl sm:rounded-2xl hover:bg-white/20 transition-colors cursor-pointer shadow-md shrink-0`}>
                  <span className="text-lg sm:text-xl">📸</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, "chat")} />
                </label>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2.5 sm:p-3.5 ${panelBg} backdrop-blur-lg rounded-xl sm:rounded-2xl hover:bg-white/20 transition-colors cursor-pointer shadow-md shrink-0`}>
                  <span className="text-lg sm:text-xl">😀</span>
                </button>
                <input
                  className={`flex-1 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm sm:text-base ${darkMode ? 'bg-gray-800 focus:bg-gray-700 placeholder-gray-400' : 'bg-white/20 focus:bg-white/30 placeholder-white/70'} backdrop-blur-lg transition-all border border-white/10 shadow-inner outline-none min-w-0`}
                  placeholder={activeDM ? `Message ${activeDM.name}...` : `Message ${activeRoom}...`}
                  value={input}
                  onChange={handleTyping}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  className="p-3 px-4 sm:p-4 sm:px-6 md:px-8 bg-pink-600 rounded-xl sm:rounded-2xl hover:bg-pink-500 transition-colors font-bold shadow-lg flex items-center justify-center shrink-0 group"
                >
                  <span className="hidden md:inline">Send</span>
                  <svg className="w-5 h-5 md:hidden group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === "discover" && (
          <div className="flex-1 overflow-y-auto animate-fade-in-up custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
              {["Global", "Gaming 🎮", "Music 🎵", "Tech Talk 💻", "Chill Zone ☕", "Movies 🍿", "Art 🎨", "Fitness 🏃"].map(room => (
                <button 
                  key={room} 
                  onClick={() => switchRoom(room)}
                  className={`p-6 rounded-3xl text-left transition-all duration-300 border border-white/5 ${activeRoom === room && !activeDM ? 'bg-gradient-to-br from-pink-500 to-orange-400 shadow-xl scale-[1.03] rotate-1' : `${panelBg} hover:bg-white/20 hover:scale-[1.02] shadow-md`}`}
                >
                  <h3 className="text-xl font-bold mb-2">{room}</h3>
                  <p className="opacity-70 text-sm">Join the conversation and meet new friends.</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "friends" && (
          <div className="flex-1 overflow-y-auto animate-fade-in-up custom-scrollbar pb-8">
            <div className={`${panelBg} backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/5`}>
              <p className="opacity-70 mb-6 font-medium">Click on any online user to start a private conversation.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(onlineUsers).filter(([id]) => id !== socket.id).map(([id, userObj]) => (
                  <div key={id} onClick={() => startDM(id, userObj.username)} className={`p-4 rounded-2xl cursor-pointer transition-all flex items-center gap-4 border border-transparent hover:border-white/20 shadow-md ${darkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-white/10 hover:bg-white/20'}`}>
                    <Avatar url={userObj.avatar} name={userObj.username} size="w-14 h-14" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate">{userObj.username}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        <span className="text-xs opacity-70">Online</span>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(onlineUsers).length <= 1 && (
                  <div className="col-span-full text-center p-12 opacity-50 bg-white/5 rounded-2xl border border-dashed border-white/20">
                    <p className="text-lg">No other users are online right now.</p>
                    <p className="text-sm mt-2">Invite some friends to join!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "moments" && (
          <div className="flex-1 flex flex-col animate-fade-in-up overflow-hidden">
            <div className={`${panelBg} backdrop-blur-md p-4 rounded-3xl mb-6 flex flex-col sm:flex-row gap-3 items-center shadow-lg border border-white/5 shrink-0`}>
              <input 
                className={`flex-1 w-full sm:w-auto p-3.5 rounded-xl ${darkMode ? 'bg-gray-700 focus:bg-gray-600' : 'bg-white/10 focus:bg-white/20'} outline-none transition-all placeholder-white/50 shadow-inner`} 
                placeholder="Write a caption for your moment..." 
                value={momentCaption}
                onChange={(e) => setMomentCaption(e.target.value)}
              />
              <label className="w-full sm:w-auto justify-center px-8 py-3.5 bg-gradient-to-r from-pink-500 to-orange-400 rounded-xl hover:shadow-pink-500/30 transition-all font-bold shadow-lg flex items-center gap-2 cursor-pointer shrink-0 hover:scale-[1.02]">
                <span className="text-lg">📸</span>
                <span>Upload</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, "moment")} />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar pb-8">
              {momentsFeed.length === 0 ? (
                <div className="text-center p-16 opacity-50 bg-white/5 rounded-3xl border border-dashed border-white/20 mt-4">
                  <p className="text-xl">Be the first to share a moment!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {momentsFeed.map(moment => {
                    const hasLiked = moment.likes?.includes(username);
                    return (
                      <div key={moment._id} className={`${darkMode ? 'bg-gray-800' : 'bg-white/10'} backdrop-blur-md rounded-3xl overflow-hidden shadow-xl border border-white/10 flex flex-col`}>
                        <div className="h-64 relative group bg-black/20">
                          <img src={moment.image} alt="Moment" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100 flex items-end p-4">
                            <div className="flex items-center gap-3 w-full">
                              <Avatar url={moment.userAvatar} name={moment.user} size="w-10 h-10" />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-white truncate drop-shadow-md">{moment.user}</h3>
                                <p className="text-xs text-white/80 drop-shadow-md">{new Date(moment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-5 flex flex-col flex-1">
                          {moment.caption && <p className="text-sm font-medium mb-4 leading-relaxed">{moment.caption}</p>}
                          
                          <div className="flex items-center gap-4 mb-4 border-t border-white/10 pt-4 mt-auto">
                            <button 
                              onClick={() => socket.emit("likeMoment", moment._id)}
                              className={`flex items-center gap-1.5 transition-colors ${hasLiked ? 'text-pink-500' : 'hover:text-pink-400'}`}
                            >
                              <span className="text-xl">{hasLiked ? '❤️' : '🤍'}</span>
                              <span className="font-bold">{moment.likes?.length || 0}</span>
                            </button>
                            <div className="flex items-center gap-1.5 opacity-70">
                              <span className="text-xl">💬</span>
                              <span className="font-bold">{moment.comments?.length || 0}</span>
                            </div>
                          </div>

                          <div className="space-y-3 mb-4 max-h-32 overflow-y-auto custom-scrollbar">
                            {moment.comments?.map((c, i) => (
                              <div key={i} className="flex gap-2 text-sm">
                                <Avatar url={c.userAvatar} name={c.user} size="w-6 h-6 mt-0.5" />
                                <div className={`p-2 rounded-xl rounded-tl-sm flex-1 ${darkMode ? 'bg-gray-700' : 'bg-white/5'}`}>
                                  <span className="font-bold text-xs opacity-70 block mb-0.5">{c.user}</span>
                                  <span>{c.text}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2 mt-auto relative">
                            <input
                              className={`flex-1 p-2.5 px-4 rounded-xl text-sm ${darkMode ? 'bg-gray-700' : 'bg-white/5'} focus:bg-white/10 outline-none transition-all placeholder-white/40 border border-white/5 focus:border-white/20`}
                              placeholder="Add a comment..."
                              value={commentInputs[moment._id] || ""}
                              onChange={(e) => handleCommentChange(moment._id, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && submitComment(moment._id)}
                            />
                            <button onClick={() => submitComment(moment._id)} className="px-4 bg-white/10 hover:bg-white/20 rounded-xl transition text-sm font-bold">
                              Post
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="flex-1 overflow-y-auto animate-fade-in-up pb-8 custom-scrollbar">
            <div className={`max-w-2xl mx-auto ${panelBg} backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/5 relative overflow-hidden`}>
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-80 z-0"></div>
              
              <div className="relative z-10 flex flex-col items-center mt-12">
                <div className="relative group">
                  <Avatar url={userProfile.avatar} name={username} size="w-32 h-32 border-4 border-white shadow-2xl" />
                  <label className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <span className="text-white font-bold text-sm">Change</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, "avatar")} />
                  </label>
                </div>
                
                <h2 className="text-3xl font-bold mt-4 mb-1">{username}</h2>
                <p className="opacity-60 text-sm mb-8">Joined recently</p>

                <div className="w-full space-y-5">
                  <div>
                    <label className="block text-sm font-bold opacity-70 mb-2 uppercase tracking-wider">About Me (Bio)</label>
                    <textarea 
                      className={`w-full p-4 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-white/5'} focus:bg-white/10 outline-none transition-all border border-white/10 resize-none`}
                      rows="4"
                      placeholder="Write something nice about yourself..."
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                    ></textarea>
                  </div>
                  
                  <button onClick={saveProfile} className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl font-bold shadow-lg hover:shadow-pink-500/25 hover:scale-[1.01] transition-all">
                    Save Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
