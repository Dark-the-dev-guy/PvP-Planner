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
    enum: ["attending", "not attending", "late", "tentative", "backup"],
    default: "attending",
  },
  role: {
    type: String,
    enum: ["tank", "healer", "dps", "dm", "player", "participant", ""],
    default: "",
  },
  wowClass: {
    type: String,
    default: "",
  },
  wowSpec: {
    type: String,
    default: "",
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
  // Add guildId field to associate sessions with guilds
  guildId: {
    type: String,
    required: true,
    index: true, // Add index for query performance
  },
  gameMode: {
    type: String,
    required: true,
    // Extended enum for all game modes across categories
    enum: [
      // PvP modes
      "2v2", "3v3", "RBGs", 
      // PvE modes
      "Mythic+", "Raid", 
      // D&D modes
      "One Shot", "Campaign", 
      // Custom event mode
      "Event"
    ],
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
  // Added metadata field for additional session attributes
  meta: {
    // Category of the event
    category: {
      type: String,
      enum: ["pvp", "pve", "dnd", "custom"],
      default: "pvp" // Default to pvp for backward compatibility
    },
    // Tier for RBGs
    rbgTier: {
      type: String,
      enum: ["main", "alt", ""],
      default: "main" // Default to main for backward compatibility
    },
    // Group size for PvE and custom events
    groupSize: {
      type: Number,
      default: 10 // Default group size
    },
    // Role requirements for each category
    roleRequirements: {
      tank: { type: Number, default: 0 },
      healer: { type: Number, default: 0 },
      dps: { type: Number, default: 0 },
      dm: { type: Number, default: 0 },
      player: { type: Number, default: 0 },
      participant: { type: Number, default: 0 }
    }
  },
  gamers: [GamerSchema],
  timestamp: {
    type: Date,
    default: Date.now,
  },
  reminderSent: {
    type: Boolean,
    default: false,
  },
  // Track which reminders have been sent
  reminders: {
    channelReminder: {
      type: Boolean,
      default: false
    },
    dmReminder: {
      type: Boolean,
      default: false
    },
    // For multi-stage reminders (can add more as needed)
    earlyReminder: {
      type: Boolean,
      default: false
    }
  },
  // Track if the session is complete
  isComplete: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model("Session", SessionSchema);