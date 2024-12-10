// models/Sucks.js

const mongoose = require("mongoose");

const SucksSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    default: "Can't make it",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Sucks", SucksSchema);
