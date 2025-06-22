// events/handlers/components/buttons.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const logger = require('../../../utils/logger');

/**
 * Creates action row buttons for session interactions - SINGLE MANAGEMENT BUTTON
 * @param {string} sessionId - The session ID
 * @returns {Array} - Array of ActionRowBuilder objects with single management button
 */
function createSessionButtons(sessionId) {
  // Single row with just a management button that gives users their personal controls
  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`manage_signup_${sessionId}`)
        .setLabel("Manage My Signup")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⚙️")
    );
    
  return [row1];
}

/**
 * Creates buttons for selecting a role - UNIQUE PER USER
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID (makes buttons unique per user)
 * @param {string} category - Session category
 * @param {Object} client - Discord client for emoji resolution
 * @param {Object} emojiManager - Emoji manager for fetching emojis
 * @returns {ActionRowBuilder} - Action row with role buttons
 */
function createRoleButtons(sessionId, userId, category, client, emojiManager) {
  let row;
  
  // Log the category and user to help debug
  logger.info(`Creating role buttons for category: ${category}, user: ${userId}, session: ${sessionId}`);
  
  // Validate inputs
  if (!sessionId || !userId || !category) {
    logger.error(`Invalid inputs for createRoleButtons: sessionId=${sessionId}, userId=${userId}, category=${category}`);
    throw new Error('Missing required parameters for role button creation');
  }
  
  if (category === "pvp" || category === "pve") {
    // WoW roles
    const tankEmoji = emojiManager.getRoleEmoji('tank', client);
    const healerEmoji = emojiManager.getRoleEmoji('healer', client);
    const dpsEmoji = emojiManager.getRoleEmoji('dps', client);
    
    // Extract emoji ID from the format <:name:id> if it's a custom emoji
    const getEmojiId = (emojiString) => {
      const match = emojiString?.match(/<:(\w+):(\d+)>/);
      return match ? match[2] : null;
    };
    
    row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`userrole_tank_${sessionId}_${userId}`)  // Changed prefix to 'userrole' for clarity
        .setLabel("Tank")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId(tankEmoji) || "🛡️"),
      new ButtonBuilder()
        .setCustomId(`userrole_healer_${sessionId}_${userId}`)
        .setLabel("Healer")
        .setStyle(ButtonStyle.Success)
        .setEmoji(getEmojiId(healerEmoji) || "💚"),
      new ButtonBuilder()
        .setCustomId(`userrole_dps_${sessionId}_${userId}`)
        .setLabel("DPS")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(getEmojiId(dpsEmoji) || "⚔️")
    );
  } 
  else if (category === "dnd") {
    // D&D roles
    row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`userrole_dm_${sessionId}_${userId}`)
        .setLabel("Dungeon Master")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎲"),
      new ButtonBuilder()
        .setCustomId(`userrole_player_${sessionId}_${userId}`)
        .setLabel("Player")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🧙")
    );
  }
  else {
    // Custom event - just participant
    row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`userrole_participant_${sessionId}_${userId}`)
        .setLabel("Participant")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("👤")
    );
  }

  // Log the created button IDs for debugging
  const buttonIds = row.components.map(button => button.data.custom_id);
  logger.info(`Created role buttons with IDs: ${buttonIds.join(', ')}`);

  return row;
}

/**
 * Creates update buttons for changing role/class/spec - UNIQUE PER USER
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID (makes buttons unique per user)
 * @returns {ActionRowBuilder} - Action row with update buttons
 */
function createUpdateButtons(sessionId, userId) {
  // Validate inputs
  if (!sessionId || !userId) {
    logger.error(`Invalid inputs for createUpdateButtons: sessionId=${sessionId}, userId=${userId}`);
    throw new Error('Missing required parameters for update button creation');
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`userupdate_${sessionId}_${userId}`)  // Changed prefix for clarity
      .setLabel("Update Role/Class/Spec")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`usernochanges_${sessionId}_${userId}`)  // Changed prefix for clarity
      .setLabel("Keep Current Selection")
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  createSessionButtons,
  createRoleButtons,
  createUpdateButtons
};