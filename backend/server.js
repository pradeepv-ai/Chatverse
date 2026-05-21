const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("./models/User");
const Message = require("./models/Message");
const Post = require("./models/Post");

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
  cors: {
    origin: "*"
  }
});

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chatapp";
mongoose.connect(mongoURI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("MongoDB connection error:", err));

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
      toUserId,
      isPrivate: true
    };
    try {
      const savedMsg = await Message.create(msgData);
      socket.to(toUserId).emit("privateMessage", savedMsg);
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
