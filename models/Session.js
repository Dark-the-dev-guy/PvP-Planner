// models/Session.js

const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    unique: true,
    default: function () {
      return this._id.toString();
    },
  },
  gameMode: {
    type: String,
    required: true,
    enum: ["2v2", "3v3", "rbg"],
  },
  date: {
    type: Date,
    required: true,
  },
  host: {
    type: String, // Storing Discord user ID as a string
    required: false, // Allows for 'Unknown Host'
  },
  participants: {
    type: [String], // Array of Discord user IDs
    default: [],
  },
  notes: {
    type: String,
    default: "No notes",
  },
});

module.exports = mongoose.model("Session", SessionSchema);
