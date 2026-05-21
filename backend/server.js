const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
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
let moments = [];

io.on("connection", (socket) => {
  console.log("🔥 User connected:", socket.id);

  // Send existing moments to the newly connected user
  socket.emit("momentsList", moments);

  socket.on("join", (username) => {
    users[socket.id] = username;
    
    // Broadcast online users
    io.emit("onlineUsers", users);
    
    // Announce join
    io.emit("message", {
      user: "System",
      text: `${username} joined the chat 🎉`
    });
  });

  socket.on("sendMessage", (message) => {
    io.emit("message", {
      user: users[socket.id],
      text: message
    });
  });

  // Private Messaging
  socket.on("privateMessage", ({ toUserId, message }) => {
    socket.to(toUserId).emit("privateMessage", {
      user: users[socket.id],
      text: message
    });
  });

  // Typing Indicator
  socket.on("typing", () => {
    socket.broadcast.emit("typing", users[socket.id]);
  });

  // Share Moment
  socket.on("shareMoment", ({ image, caption }) => {
    const newMoment = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      user: users[socket.id] || "Anonymous",
      image,
      caption,
      createdAt: new Date().toISOString()
    };
    moments.unshift(newMoment);
    if (moments.length > 50) moments.pop(); // Keep memory usage bounded
    
    io.emit("newMoment", newMoment);
  });

  socket.on("disconnect", () => {
    if (users[socket.id]) {
      io.emit("message", {
        user: "System",
        text: `${users[socket.id]} left ❌`
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
