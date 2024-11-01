// models/Session.js

const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  gameMode: {
    type: String,
    enum: ["2v2", "3v3", "rbg"],
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  host: {
    type: String, // Storing user ID
    required: true,
  },
  participants: {
    type: [String], // Storing user IDs
    default: [],
  },
  notes: {
    type: String,
    default: "No notes",
  },
});

module.exports = mongoose.model("Session", sessionSchema);
