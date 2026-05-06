const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  user: String,
  image: String,
  caption: String,
  likes: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Post", postSchema);
