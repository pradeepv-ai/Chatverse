const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Temporary In-Memory Database to replace MongoDB (since no MONGODB_URI is provided on Render)
class MockCollection {
  constructor() { this.data = []; }
  find(query = {}) {
    let res = this.data;
    if (query.isPrivate !== undefined) res = res.filter(d => d.isPrivate === query.isPrivate);
    if (query.$or) {
      res = res.filter(d => query.$or.some(cond => {
        for (let k in cond) if (d[k] !== cond[k]) return false;
        return true;
      }));
    }
    return { sort: () => ({ limit: (n) => res.slice().reverse().slice(0, n) }) };
  }
  async findOne(query) { return this.data.find(d => d.username === query.username) || null; }
  async findById(id) { return this.data.find(d => d._id === id) || null; }
  async create(doc) {
    const newDoc = { _id: crypto.randomBytes(8).toString('hex'), ...doc, createdAt: new Date() };
    if (newDoc.likes === undefined) newDoc.likes = [];
    if (newDoc.comments === undefined) newDoc.comments = [];
    this.data.push(newDoc);
    newDoc.save = async () => {}; // mock save
    return newDoc;
  }
  async findOneAndUpdate(query, update, options) {
    let doc = await this.findOne(query);
    if (doc) { Object.assign(doc, update); return doc; }
    return null;
  }
}

const User = new MockCollection();
const Message = new MockCollection();
const Post = new MockCollection();

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

console.log("✅ Using Temporary In-Memory Database (No MongoDB required)");

// Set up Multer for image uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  res.json({ url: `${backendUrl}/uploads/${req.file.filename}` });
});


/* ================= SOCKET LOGIC ================= */

let users = {};

io.on("connection", async (socket) => {
  console.log("🔥 User connected:", socket.id);

  try {
    // Send existing moments and messages to the newly connected user
    const moments = await Post.find().sort({ createdAt: -1 }).limit(50);
    const messages = await Message.find({ isPrivate: false }).sort({ createdAt: -1 }).limit(50);
    socket.emit("momentsList", moments);
    // Send previous messages (reverse so oldest is first in the UI feed if needed, wait, frontend expects chronological, so we should reverse after fetching)
    socket.emit("messageHistory", messages.reverse());
  } catch(err) {
    console.error("Error fetching initial data", err);
  }

  socket.on("join", async (username) => {
    try {
      let userDoc = await User.findOne({ username });
      if (!userDoc) {
        userDoc = await User.create({ username, bio: "", avatar: "" });
      }
      
      users[socket.id] = { id: userDoc._id, username: userDoc.username, avatar: userDoc.avatar };
      
      // Send user profile back
      socket.emit("profileData", userDoc);
      
      // Send private messages for this user
      const privateMessages = await Message.find({
        $or: [
          { toUserId: userDoc._id.toString() },
          { fromId: userDoc._id.toString() }
        ]
      }).sort({ createdAt: -1 }).limit(50);
      if (privateMessages.length > 0) {
        socket.emit("privateMessageHistory", privateMessages.reverse());
      }
      
      // Broadcast online users
      io.emit("onlineUsers", users);
      
      // Announce join
      io.emit("message", {
        user: "System",
        text: `${username} joined the chat 🎉`
      });
    } catch(err) {
      console.error("Join error", err);
    }
  });

  socket.on("sendMessage", async (message) => {
    if(!users[socket.id]) return;
    const msgData = {
      user: users[socket.id].username,
      text: message,
      room: "Global",
      isPrivate: false
    };
    try {
      const savedMsg = await Message.create(msgData);
      io.emit("message", savedMsg);
    } catch(err) { console.error(err); }
  });

  // Private Messaging
  socket.on("privateMessage", async ({ toUserId, message }) => {
    if(!users[socket.id]) return;
    
    const msgData = {
      user: users[socket.id].username,
      text: message,
      toUserId: toUserId,
      fromId: users[socket.id].id,
      isPrivate: true
    };
    
    try {
      const savedMsg = await Message.create(msgData);
      
      // toUserId is the database ID of the target user
      const targetSocketEntry = Object.entries(users).find(([sid, u]) => u.id === toUserId);
      if (targetSocketEntry) {
        io.to(targetSocketEntry[0]).emit("privateMessage", savedMsg);
      }
    } catch(err) { console.error(err); }
  });

  // Typing Indicator
  socket.on("typing", () => {
    socket.broadcast.emit("typing", users[socket.id]);
  });

  // Share Moment
  socket.on("shareMoment", async ({ image, caption }) => {
    if(!users[socket.id]) return;
    try {
      const newMoment = await Post.create({
        user: users[socket.id].username,
        userAvatar: users[socket.id].avatar,
        image,
        caption
      });
      io.emit("newMoment", newMoment);
    } catch(err) { console.error(err); }
  });

  // Like Moment
  socket.on("likeMoment", async (momentId) => {
    if(!users[socket.id]) return;
    try {
      const post = await Post.findById(momentId);
      if (post) {
        const username = users[socket.id].username;
        if (!post.likes.includes(username)) {
          post.likes.push(username);
        } else {
          post.likes = post.likes.filter(u => u !== username);
        }
        await post.save();
        io.emit("updateMoment", post);
      }
    } catch(err) { console.error(err); }
  });

  // Comment Moment
  socket.on("commentMoment", async ({ momentId, text }) => {
    if(!users[socket.id]) return;
    try {
      const post = await Post.findById(momentId);
      if (post) {
        post.comments.push({
          user: users[socket.id].username,
          userAvatar: users[socket.id].avatar,
          text
        });
        await post.save();
        io.emit("updateMoment", post);
      }
    } catch(err) { console.error(err); }
  });

  // Update Profile
  socket.on("updateProfile", async ({ bio, avatar }) => {
    if(!users[socket.id]) return;
    try {
      const userDoc = await User.findOneAndUpdate(
        { username: users[socket.id].username },
        { bio, avatar },
        { new: true }
      );
      if (userDoc) {
        users[socket.id].avatar = avatar;
        socket.emit("profileData", userDoc);
        io.emit("onlineUsers", users); // Refresh avatars for everyone
      }
    } catch(err) { console.error(err); }
  });

  socket.on("disconnect", () => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      io.emit("message", {
        user: "System",
        text: `${username} left ❌`
      });
      delete users[socket.id];
      // Update online users list
      io.emit("onlineUsers", users);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
