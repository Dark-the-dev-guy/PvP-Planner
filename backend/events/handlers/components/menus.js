// events/handlers/components/menus.js
const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const logger = require('../../../utils/logger');

/**
 * Create a class selection menu
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} role - Selected role
 * @param {string} category - Session category
 * @param {Object} client - Discord client for emoji resolution
 * @param {Object} emojiManager - Emoji manager for fetching emojis
 * @returns {ActionRowBuilder} - Action row with class selection menu
 */
function createClassSelectionMenu(sessionId, userId, role, category, client, emojiManager) {
  // Extract emoji ID from the format <:name:id> if it's a custom emoji
  const getEmojiId = (emojiString) => {
    const match = emojiString?.match(/<:(\w+):(\d+)>/);
    return match ? match[2] : null;
  };

  // Get all WoW classes
  const allClasses = emojiManager.getWowClasses();
    
  // Filter classes based on role
  let availableClasses = [];
  
  if (role === 'tank') {
    // Classes that can tank
    availableClasses = ['warrior', 'paladin', 'druid', 'deathknight', 'demonhunter', 'monk'];
  } else if (role === 'healer') {
    // Classes that can heal
    availableClasses = ['priest', 'paladin', 'druid', 'monk', 'shaman', 'evoker'];
  } else {
    // For DPS, all classes are available
    availableClasses = allClasses;
  }
  
  // Create select menu options for filtered classes
  const classOptions = availableClasses.map(className => {
    const classEmoji = emojiManager.getClassEmoji(className, client);
    const emojiId = getEmojiId(classEmoji);
    
    return {
      label: className.charAt(0).toUpperCase() + className.slice(1),
      value: className,
      emoji: emojiId || classEmoji || className.charAt(0).toUpperCase()
    };
  });
  
  // Create class selection menu
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`classselect_${sessionId}_${userId}_${role}_${category}`)
      .setPlaceholder('Select your class')
      .addOptions(classOptions)
  );
}

/**
 * Get specs for a class filtered by role
 * @param {string} className - WoW class name
 * @param {string} role - Selected role
 * @returns {Array} - Array of available specs for this class and role
 */
function getRoleSpecsForClass(className, role) {
  // Define which specs can perform each role
  const roleSpecs = {
    tank: {
      warrior: ['protection'],
      paladin: ['protection'],
      druid: ['guardian'],
      deathknight: ['blood'],
      demonhunter: ['vengeance'],
      monk: ['brewmaster']
    },
    healer: {
      priest: ['discipline', 'holy'],
      paladin: ['holy'],
      druid: ['restoration'],
      monk: ['mistweaver'],
      shaman: ['restoration'],
      evoker: ['preservation']
    },
    dps: {
      warrior: ['arms', 'fury'],
      paladin: ['retribution'],
      hunter: ['beastmastery', 'marksmanship', 'survival'],
      rogue: ['assassination', 'outlaw', 'subtlety'],
      priest: ['shadow'],
      shaman: ['elemental', 'enhancement'],
      mage: ['arcane', 'fire', 'frost'],
      warlock: ['affliction', 'demonology', 'destruction'],
      druid: ['balance', 'feral'],
      deathknight: ['frost', 'unholy'],
      monk: ['windwalker'],
      demonhunter: ['havoc'],
      evoker: ['devastation', 'augmentation']
    }
  };
  
  // Return the specs for this class and role, or an empty array if none exist
  return roleSpecs[role]?.[className] || [];
}

/**
 * Create a spec selection menu filtered by role
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} selectedClass - Selected WoW class
 * @param {string} role - Selected role
 * @param {string} category - Session category
 * @param {Object} client - Discord client for emoji resolution
 * @param {Object} emojiManager - Emoji manager for fetching emojis
 * @returns {ActionRowBuilder} - Action row with spec selection menu
 */
function createRoleFilteredSpecMenu(sessionId, userId, selectedClass, role, category, client, emojiManager) {
  // Get available specs for this class and role
  const availableSpecs = getRoleSpecsForClass(selectedClass, role);
  
  // Extract emoji ID from the format <:name:id> if it's a custom emoji
  const getEmojiId = (emojiString) => {
    const match = emojiString?.match(/<:(\w+):(\d+)>/);
    return match ? match[2] : null;
  };
  
  // Create select menu options for filtered specs
  const specOptions = availableSpecs.map(specName => {
    const specEmoji = emojiManager.getSpecEmoji(selectedClass, specName, client);
    const emojiId = getEmojiId(specEmoji);
    
    // Format the spec name for display
    const formattedSpecName = specName
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
    
    return {
      label: formattedSpecName,
      value: specName,
      emoji: emojiId || specEmoji || '⚙️'
    };
  });
  
  // Create spec selection menu
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`specselect_${sessionId}_${userId}_${category}`)
      .setPlaceholder('Select your specialization')
      .addOptions(specOptions)
  );
}

/**
 * Create a full spec selection menu for a class
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} selectedClass - Selected WoW class
 * @param {string} category - Session category
 * @param {Object} client - Discord client for emoji resolution
 * @param {Object} emojiManager - Emoji manager for fetching emojis
 * @returns {ActionRowBuilder} - Action row with spec selection menu
 */
function createSpecSelectionMenu(sessionId, userId, selectedClass, category, client, emojiManager) {
  // Get specs for the selected class
  const specs = emojiManager.getClassSpecs(selectedClass);
  
  // Extract emoji ID from the format <:name:id> if it's a custom emoji
  const getEmojiId = (emojiString) => {
    const match = emojiString?.match(/<:(\w+):(\d+)>/);
    return match ? match[2] : null;
  };
  
  // Create select menu options
  const specOptions = specs.map(specName => {
    const specEmoji = emojiManager.getSpecEmoji(selectedClass, specName, client);
    const emojiId = getEmojiId(specEmoji);
    
    // Format the spec name for display
    const formattedSpecName = specName
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
    
    return {
      label: formattedSpecName,
      value: specName,
      emoji: emojiId || specEmoji || '⚙️'
    };
  });
  
  // Create spec selection menu
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`specselect_${sessionId}_${userId}_${category}`)
      .setPlaceholder('Select your specialization')
      .addOptions(specOptions)
  );
}

module.exports = {
  createClassSelectionMenu,
  createRoleFilteredSpecMenu,
  createSpecSelectionMenu,
  getRoleSpecsForClass
};