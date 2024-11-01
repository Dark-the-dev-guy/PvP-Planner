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
    type: String,
    required: true,
  },
  participants: {
    type: [String],
    default: [],
  },
  notes: {
    type: String,
    default: "No notes",
  },
});

module.exports = mongoose.model("Session", sessionSchema);
