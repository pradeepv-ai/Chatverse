const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  user: String,
  userAvatar: String, // Store avatar at time of posting
  image: String,
  caption: String,
  likes: [String], // Array of usernames
  comments: [{
    user: String,
    userAvatar: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Post", postSchema);
