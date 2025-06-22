// utils/compatUtils.js
const GuildConfig = require('../models/GuildConfig');
const UserPreferences = require('../models/UserPreferences');
const logger = require('./logger');

/**
 * Get guild ID from message or interaction, with fallback to environment variable
 * @param {Object} messageOrInteraction - Discord message or interaction
 * @returns {string} - Guild ID or default
 */
function getGuildId(messageOrInteraction) {
  // Try to get guild ID from message/interaction
  const guildId = messageOrInteraction?.guild?.id || 
                 messageOrInteraction?.guildId || 
                 process.env.GUILD_ID || 
                 'default';
  
  logger.info(`Resolved guild ID: ${guildId}`);
  return guildId;
}

/**
 * Get guild configuration with fallback to environment variables
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - Guild configuration
 */
async function getGuildConfigWithFallback(guildId) {
  try {
    // Try to get config from database
    return await GuildConfig.getDefaultConfig(guildId);
  } catch (error) {
    logger.warn(`Failed to get guild config for ${guildId}, using fallbacks:`, error);
    
    // Create a fallback config using environment variables
    return {
      guildId,
      personality: { 
        sassLevel: process.env.SASS_LEVEL ? parseInt(process.env.SASS_LEVEL) : 3,
        persona: process.env.PERSONA || "tavernkeeper"
      },
      alerts: { 
        enableChannelReminders: true,
        channelReminderTime: process.env.REMINDER_TIME ? parseInt(process.env.REMINDER_TIME) : 15,
        enableDMReminders: false,
        reminderChannelId: process.env.REMINDER_CHANNEL_ID || process.env.DISPLAY_CHANNEL_ID || ""
      },
      display: { 
        logoUrl: "https://images.squarespace-cdn.com/content/6535b6bd0791df2c118f65a2/de408d56-27ef-43c0-9b41-7581faa3dc66/ChatGPT+Image+Apr+13%2C+2025%2C+04_56_29+PM.png?content-type=image%2Fpng",
        dateFormat: "MM-DD"
      },
      optOutOptions: {
        allowDMOptOut: true,
        allowMentionOptOut: false
      }
    };
  }
}

/**
 * Get user preferences with fallback to defaults
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - User preferences
 */
async function getUserPreferencesWithFallback(userId, guildId) {
  try {
    // Try to get preferences from database
    return await UserPreferences.getOrCreate(userId, guildId);
  } catch (error) {
    logger.warn(`Failed to get user preferences for ${userId} in ${guildId}, using defaults:`, error);
    
    // Return default preferences
    return {
      userId,
      guildId,
      notifications: {
        optOutDMs: false,
        optOutMentions: false,
        optOutReminders: false
      },
      defaults: {
        role: "",
        wowClass: "",
        wowSpec: ""
      }
    };
  }
}

/**
 * Feature flag check for multi-guild features
 * @returns {boolean} - Whether multi-guild features are enabled
 */
function isMultiGuildEnabled() {
  return process.env.ENABLE_MULTI_GUILD === 'true';
}

module.exports = {
  getGuildId,
  getGuildConfigWithFallback,
  getUserPreferencesWithFallback,
  isMultiGuildEnabled
};