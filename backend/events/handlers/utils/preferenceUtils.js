// events/handlers/utils/preferenceUtils.js
const UserPreferences = require('../../../models/UserPreferences');
const logger = require('../../../utils/logger');

/**
 * Get or create user preferences for a user
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - User preferences object
 */
async function getUserPreferences(userId, guildId) {
  try {
    const userPrefs = await UserPreferences.getOrCreate(userId, guildId);
    return userPrefs;
  } catch (error) {
    logger.error(`Error fetching user preferences for ${userId}:`, error);
    throw error;
  }
}

/**
 * Get preferences for a specific character type
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} charType - Character type (main or alt)
 * @returns {Promise<Object>} - Preferences for specified character type
 */
async function getCharacterPreferences(userId, guildId, charType = 'main') {
  try {
    const userPrefs = await getUserPreferences(userId, guildId);
    return userPrefs.getPreferences(charType);
  } catch (error) {
    logger.error(`Error getting ${charType} preferences for ${userId}:`, error);
    return { role: '', wowClass: '', wowSpec: '' };
  }
}

/**
 * Update preferences for a specific character type
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} charType - Character type (main or alt)
 * @param {string} role - Role to save (optional)
 * @param {string} wowClass - WoW class to save (optional)
 * @param {string} wowSpec - WoW spec to save (optional)
 * @returns {Promise<boolean>} - Success status
 */
async function updateCharacterPreferences(userId, guildId, charType = 'main', role, wowClass, wowSpec) {
  try {
    const userPrefs = await getUserPreferences(userId, guildId);
    
    // Only update fields that are provided
    await userPrefs.updatePreferences(
      charType,
      role !== undefined ? role : undefined,
      wowClass !== undefined ? wowClass : undefined,
      wowSpec !== undefined ? wowSpec : undefined
    );
    
    logger.info(`Saved ${charType} preferences for user ${userId}: ${role}, ${wowClass}, ${wowSpec}`);
    return true;
  } catch (error) {
    logger.error(`Error saving ${charType} preferences for ${userId}:`, error);
    return false;
  }
}

/**
 * Apply saved preferences to a gamer object if fields are missing
 * @param {Object} gamer - Gamer object
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} charType - Character type (main or alt)
 * @param {string} category - Event category (pvp, pve, dnd, custom)
 * @returns {Promise<Object>} - Updated gamer object
 */
async function applyPreferencesToGamer(gamer, userId, guildId, charType = 'main', category = 'pvp') {
  try {
    // Skip if gamer already has complete preferences
    if (gamer.role && gamer.wowClass && gamer.wowSpec) {
      return gamer;
    }
    
    const prefs = await getCharacterPreferences(userId, guildId, charType);
    
    // Apply preferences ONLY if they're appropriate for the event category
    if (!gamer.role && prefs.role) {
      // Check if the preferred role is appropriate for this category
      if (category === "pvp" || category === "pve") {
        // Only apply tank, healer, or dps roles for WoW categories
        if (["tank", "healer", "dps"].includes(prefs.role)) {
          gamer.role = prefs.role;
          logger.info(`Applied role ${prefs.role} to user ${userId} for ${category} session`);
        } else {
          logger.info(`Ignored incompatible role ${prefs.role} for ${category} session`);
        }
      } else if (category === "dnd") {
        // Only apply dm or player roles for D&D
        if (["dm", "player"].includes(prefs.role)) {
          gamer.role = prefs.role;
          logger.info(`Applied role ${prefs.role} to user ${userId} for ${category} session`);
        } else {
          logger.info(`Ignored incompatible role ${prefs.role} for ${category} session`);
        }
      } else if (category === "custom") {
        // For custom events, default to participant
        gamer.role = "participant";
        logger.info(`Applied participant role to user ${userId} for custom session`);
      }
    }
    
    // Only apply class/spec for WoW categories (pvp/pve)
    if ((category === "pvp" || category === "pve")) {
      if (!gamer.wowClass && prefs.wowClass) gamer.wowClass = prefs.wowClass;
      if (!gamer.wowSpec && prefs.wowSpec) gamer.wowSpec = prefs.wowSpec;
    }
    
    return gamer;
  } catch (error) {
    logger.error(`Error applying preferences for ${userId}:`, error);
    return gamer; // Return original gamer if there's an error
  }
}

/**
 * Check if user has complete preferences for a character type
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} charType - Character type (main or alt)
 * @param {string} category - Event category (pvp, pve, dnd, custom)
 * @returns {Promise<boolean>} - Whether user has complete preferences
 */
async function hasCompletePreferences(userId, guildId, charType = 'main', category = 'pvp') {
  try {
    const prefs = await getCharacterPreferences(userId, guildId, charType);
    
    // Check if required fields are present based on category
    let hasRole = false;
    
    if (category === 'pvp' || category === 'pve') {
      // For WoW categories, check if role is tank, healer, or dps
      hasRole = Boolean(prefs.role) && ["tank", "healer", "dps"].includes(prefs.role);
      
      // WoW categories need class and spec
      return hasRole && Boolean(prefs.wowClass) && Boolean(prefs.wowSpec);
    } else if (category === 'dnd') {
      // For D&D, check if role is dm or player
      hasRole = Boolean(prefs.role) && ["dm", "player"].includes(prefs.role);
      
      // D&D only needs role
      return hasRole;
    } else {
      // Other categories only need role
      return Boolean(prefs.role);
    }
  } catch (error) {
    logger.error(`Error checking preferences for ${userId}:`, error);
    return false;
  }
}

module.exports = {
  getUserPreferences,
  getCharacterPreferences,
  updateCharacterPreferences,
  applyPreferencesToGamer,
  hasCompletePreferences
};