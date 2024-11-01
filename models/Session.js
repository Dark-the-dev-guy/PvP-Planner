// models/Session.js

const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  gameMode: {
    type: String,
    required: true,
    enum: ["Arena 2v2", "Arena 3v3", "Rated Battlegrounds 10v10"],
  },
  date: { type: Date, required: true },
  timezone: { type: String, required: true },
  host: { type: String, required: true },
  participants: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  notes: { type: String },
});

// Add indexes for efficient querying
sessionSchema.index({ date: 1 });
sessionSchema.index({ sessionId: 1 });

module.exports = mongoose.model("Session", sessionSchema);
