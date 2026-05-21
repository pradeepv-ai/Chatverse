const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  user: String,
  text: String,
  room: String,
  toUserId: String, // For private messages
  isPrivate: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);
