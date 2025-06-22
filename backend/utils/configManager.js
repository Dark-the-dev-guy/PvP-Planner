// utils/configManager.js
const GuildConfig = require('../models/GuildConfig');
const UserPreferences = require('../models/UserPreferences');
const logger = require('./logger');

/**
 * Get guild configuration, creating default if not exists
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - Guild configuration object
 */
async function getGuildConfig(guildId) {
  try {
    return await GuildConfig.getDefaultConfig(guildId);
  } catch (error) {
    logger.error(`Error getting guild config for ${guildId}:`, error);
    throw error;
  }
}

/**
 * Update guild configuration
 * @param {string} guildId - Discord guild ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated guild configuration
 */
async function updateGuildConfig(guildId, updates) {
  try {
    const config = await getGuildConfig(guildId);
    
    // Apply updates to the config object
    Object.keys(updates).forEach(key => {
      if (key.includes('.')) {
        // Handle nested properties like 'personality.sassLevel'
        const parts = key.split('.');
        let current = config;
        
        // Navigate to the deepest object
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        
        // Set the value
        current[parts[parts.length - 1]] = updates[key];
      } else {
        // Handle top-level properties
        config[key] = updates[key];
      }
    });
    
    await config.save();
    logger.info(`Updated config for guild ${guildId}`);
    return config;
  } catch (error) {
    logger.error(`Error updating guild config for ${guildId}:`, error);
    throw error;
  }
}

/**
 * Get user preferences, creating defaults if not exists
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - User preferences object
 */
async function getUserPreferences(userId, guildId) {
  try {
    return await UserPreferences.getOrCreate(userId, guildId);
  } catch (error) {
    logger.error(`Error getting user preferences for ${userId} in ${guildId}:`, error);
    throw error;
  }
}

/**
 * Update user preferences
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated user preferences
 */
async function updateUserPreferences(userId, guildId, updates) {
  try {
    const prefs = await getUserPreferences(userId, guildId);
    
    // Apply updates to the preferences object
    Object.keys(updates).forEach(key => {
      if (key.includes('.')) {
        // Handle nested properties
        const parts = key.split('.');
        let current = prefs;
        
        // Navigate to the deepest object
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        
        // Set the value
        current[parts[parts.length - 1]] = updates[key];
      } else {
        // Handle top-level properties
        prefs[key] = updates[key];
      }
    });
    
    await prefs.save();
    logger.info(`Updated preferences for user ${userId} in guild ${guildId}`);
    return prefs;
  } catch (error) {
    logger.error(`Error updating user preferences for ${userId} in ${guildId}:`, error);
    throw error;
  }
}

module.exports = {
  getGuildConfig,
  updateGuildConfig,
  getUserPreferences,
  updateUserPreferences
};