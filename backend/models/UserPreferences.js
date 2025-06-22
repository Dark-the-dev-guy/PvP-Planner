// models/UserPreferences.js
const mongoose = require("mongoose");

// Create a sub-schema for character role/class/spec defaults
const DefaultSelectionSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["tank", "healer", "dps", "dm", "player", ""],
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
}, { _id: false });

const UserPreferencesSchema = new mongoose.Schema({
  // User identification
  userId: {
    type: String,
    required: true,
  },
  
  // Guild context (to allow different preferences per guild)
  guildId: {
    type: String,
    required: true,
  },
  
  // Combined userId+guildId should be unique
  // This ensures one set of preferences per user per guild
  
  // Notification preferences
  notifications: {
    optOutDMs: {
      type: Boolean,
      default: false,
    },
    optOutMentions: {
      type: Boolean,
      default: false,
    },
    optOutReminders: {
      type: Boolean,
      default: false,
    },
  },
  
  // Default selections for signup - now with main and alt
  defaults: {
    // Main character preferences
    main: DefaultSelectionSchema,
    // Alt character preferences
    alt: DefaultSelectionSchema,
    // Legacy support for single role preference
    role: {
      type: String,
      enum: ["tank", "healer", "dps", "dm", "player", ""],
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
  },
  
  // User timezone preference (overrides guild default)
  timezone: {
    type: String,
    default: "", // Empty means use guild default
  },
  
  // Last updated timestamp
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create a compound index for userId+guildId uniqueness
UserPreferencesSchema.index({ userId: 1, guildId: 1 }, { unique: true });

// Update the 'updatedAt' field on save
UserPreferencesSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

// Helper method to get or create user preferences
UserPreferencesSchema.statics.getOrCreate = async function(userId, guildId) {
  let prefs = await this.findOne({ userId, guildId });
  
  if (!prefs) {
    // Create new preferences with defaults
    prefs = new this({
      userId,
      guildId,
      // Initialize main and alt with empty defaults
      defaults: {
        main: {},
        alt: {}
      }
      // All other fields will use schema defaults
    });
    await prefs.save();
  } else if (!prefs.defaults.main) {
    // Migrate legacy preferences to the new structure
    prefs.defaults.main = {
      role: prefs.defaults.role || "",
      wowClass: prefs.defaults.wowClass || "",
      wowSpec: prefs.defaults.wowSpec || ""
    };
    prefs.defaults.alt = {
      role: "",
      wowClass: "",
      wowSpec: ""
    };
    await prefs.save();
  }
  
  return prefs;
};

// Method to get preferences for a specific character type (main or alt)
UserPreferencesSchema.methods.getPreferences = function(charType = 'main') {
  if (charType !== 'main' && charType !== 'alt') {
    charType = 'main'; // Default to main if invalid type
  }
  
  // Return the preferences for the character type
  return this.defaults[charType] || {};
};

// Method to update preferences for a specific character type
UserPreferencesSchema.methods.updatePreferences = async function(charType, role, wowClass, wowSpec) {
  if (charType !== 'main' && charType !== 'alt') {
    charType = 'main'; // Default to main if invalid type
  }
  
  // Ensure the charType object exists
  if (!this.defaults[charType]) {
    this.defaults[charType] = {};
  }
  
  // Update the fields if provided
  if (role !== undefined) this.defaults[charType].role = role;
  if (wowClass !== undefined) this.defaults[charType].wowClass = wowClass;
  if (wowSpec !== undefined) this.defaults[charType].wowSpec = wowSpec;
  
  // Save the changes
  return this.save();
};

module.exports = mongoose.model("UserPreferences", UserPreferencesSchema);