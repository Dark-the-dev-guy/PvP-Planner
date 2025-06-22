// models/ConversationLog.js
const mongoose = require("mongoose");

const ConversationLogSchema = new mongoose.Schema({
  // User and context info
  userId: {
    type: String,
    required: true,
    index: true
  },
  username: String,
  guildId: {
    type: String,
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true
  },
  
  // Message details
  userMessage: {
    type: String,
    required: true
  },
  botResponse: String,
  
  // Processing details
  detectedIntent: String,
  intentConfidence: Number,
  success: {
    type: Boolean,
    default: true
  },
  errorInfo: String,
  processingTimeMs: Number,
  
  // Time tracking
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Create indices for common queries
ConversationLogSchema.index({ guildId: 1, timestamp: -1 });
ConversationLogSchema.index({ userId: 1, timestamp: -1 });
ConversationLogSchema.index({ detectedIntent: 1, timestamp: -1 });

module.exports = mongoose.model("ConversationLog", ConversationLogSchema);