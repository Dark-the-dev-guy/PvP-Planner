// models/GuildConfig.js

const mongoose = require("mongoose");

const GuildConfigSchema = new mongoose.Schema({
  // Core identification
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Personality settings
  personality: {
    sassLevel: {
      type: Number,
      default: 3,
      min: 0,
      max: 5,
    },
    persona: {
      type: String,
      enum: ["tavernkeeper", "bard", "cleric", "warlock", "strategist", "unhinged", "dungeonmaster"],
      default: "tavernkeeper",
    },
    personaTone: {
      type: String,
      enum: ["neutral", "male", "female"],
      default: "neutral",
    },
    isPremium: {
      type: Boolean,
      default: false,
    }
  },
  
  // Alert settings
  alerts: {
    enableChannelReminders: {
      type: Boolean,
      default: true,
    },
    channelReminderTime: {
      type: Number, // Minutes before event
      default: 15,
      min: 5,
      max: 60,
    },
    enableDMReminders: {
      type: Boolean,
      default: false,
    },
    dmReminderTime: {
      type: Number, // Minutes before event
      default: 15,
      min: 5,
      max: 60,
    },
    reminderChannelId: {
      type: String,
      default: "", // Empty means use the display channel
    },
  },
  
  // Channel settings
  channels: {
    scheduleChannelId: {
      type: String,
      default: "",
    },
    eventsChannelId: {
      type: String,
      default: "",
    },
    regularChannelId: {
      type: String,
      default: "",
    },
  },
  
  // Opt-out settings
  optOutOptions: {
    allowDMOptOut: {
      type: Boolean,
      default: true,
    },
    allowMentionOptOut: {
      type: Boolean,
      default: false,
    },
  },
  
  // Display settings
  display: {
    dateFormat: {
      type: String,
      enum: ["MM-DD", "DD-MM"],
      default: "MM-DD",
    },
    timezone: {
      type: String,
      default: "America/New_York", // Default to Eastern Time
    },
    logoUrl: {
      type: String,
      default: "https://images.squarespace-cdn.com/content/6535b6bd0791df2c118f65a2/de408d56-27ef-43c0-9b41-7581faa3dc66/ChatGPT+Image+Apr+13%2C+2025%2C+04_56_29+PM.png?content-type=image%2Fpng",
    },
    colors: {
      twos: {
        type: String,
        default: "0x00AAFF", // Blue
      },
      threes: {
        type: String,
        default: "0x9932CC", // Purple
      },
      rbgs: {
        type: String,
        default: "0xFF5500", // Orange
      },
      pve: {
        type: String, 
        default: "0x2ECC71", // Green
      },
      dnd: {
        type: String,
        default: "0xD63031", // Red
      },
      custom: {
        type: String,
        default: "0xF39C12", // Yellow/Orange
      },
    },
  },
  
  // Game configuration schema - Enhanced for multiple event types
  gameConfig: {
    allowedTypes: {
      type: [String],
      enum: ["pvp", "pve", "dnd", "custom"],
      default: ["pvp", "pve", "dnd", "custom"]
    },
    modes: {
      pvp: {
        type: [String],
        default: ["2v2", "3v3", "RBGs"]
      },
      pve: {
        type: [String],
        default: ["Mythic+", "Raid"]
      },
      dnd: {
        type: [String],
        default: ["One Shot", "Campaign"]
      },
      custom: {
        type: [String],
        default: ["Event"]
      }
    },
    // Default role requirements per category
    roleRequirements: {
      pvp: {
        tank: { type: Number, default: 1 },
        healer: { type: Number, default: 3 },
        dps: { type: Number, default: 6 }
      },
      pve: {
        tank: { type: Number, default: 2 },
        healer: { type: Number, default: 3 },
        dps: { type: Number, default: 5 }
      },
      dnd: {
        dm: { type: Number, default: 1 },
        player: { type: Number, default: 5 }
      },
      custom: {
        participant: { type: Number, default: 10 }
      }
    },
    // Mode-specific settings
    modeSettings: {
      "Mythic+": {
        groupSize: { type: Number, default: 5 },
        roles: {
          tank: { type: Number, default: 1 },
          healer: { type: Number, default: 1 },
          dps: { type: Number, default: 3 }
        }
      },
      "Raid": {
        groupSize: { type: Number, default: 20 },
        roles: {
          tank: { type: Number, default: 2 },
          healer: { type: Number, default: 4 },
          dps: { type: Number, default: 14 }
        }
      },
      "One Shot": {
        groupSize: { type: Number, default: 6 },
        roles: {
          dm: { type: Number, default: 1 },
          player: { type: Number, default: 5 }
        }
      },
      "Campaign": {
        groupSize: { type: Number, default: 6 },
        roles: {
          dm: { type: Number, default: 1 },
          player: { type: Number, default: 5 }
        }
      }
    }
  },
  
  // Game mode settings (legacy, maintained for backward compatibility)
  gameModes: {
    defaultMode: {
      type: String,
      enum: ["pvp", "pve", "dnd", "custom"],
      default: "pvp",
    },
    pvpRoles: {
      tanks: {
        type: Number,
        default: 1,
      },
      healers: {
        type: Number,
        default: 3,
      },
      dps: {
        type: Number,
        default: 6,
      },
    },
    pveRoles: {
      tanks: {
        type: Number,
        default: 2,
      },
      healers: {
        type: Number,
        default: 3,
      },
      dps: {
        type: Number,
        default: 5,
      },
    },
    dndRoles: {
      dm: {
        type: Number,
        default: 1,
      },
      player: {
        type: Number,
        default: 5,
      }
    },
  },
  
  // Display channel settings
  displayChannels: {
    type: [String],
    default: [],
  },
  
  // Creation timestamp
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  // Last updated timestamp
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the 'updatedAt' field on save
GuildConfigSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

// Helper method to get default config for a guild
GuildConfigSchema.statics.getDefaultConfig = async function(guildId) {
  let config = await this.findOne({ guildId });
  
  if (!config) {
    // Create a new default config
    config = new this({
      guildId: guildId
      // All other fields will use schema defaults
    });
    await config.save();
  }
  
  return config;
};

module.exports = mongoose.model("GuildConfig", GuildConfigSchema);