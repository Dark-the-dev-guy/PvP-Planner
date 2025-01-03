// models/Session.js

const mongoose = require("mongoose");

const GamerSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["attending", "not attending", "late"],
    default: "attending",
  },
  reason: {
    type: String,
    default: "",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const SessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  gameMode: {
    type: String,
    required: true,
    enum: ["2v2", "3v3", "RBGs"], // Enforce allowed game modes
  },
  date: {
    type: Date,
    required: true,
  },
  host: {
    type: String, // Host's User ID
    required: true,
  },
  notes: {
    type: String,
    default: "",
  },
  gamers: [GamerSchema],
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Session", SessionSchema);
