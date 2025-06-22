// events/handlers/selectionHandlers/specSelection.js
const Session = require('../../../models/Session');
const {
  formatSpecName,
  formatCompleteSelectionMessage,
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  logSpecUpdate,
  updateCharacterPreferences
} = require('../utils');
const { 
  createSpecSelectionMenu, 
  createRoleFilteredSpecMenu 
} = require('../components/menus');
const { updateSessionDisplay } = require("../../../utils/sessionDisplayService");
const logger = require('../../../utils/logger');
const emojiManager = require('../../../utils/emojiManager');

/**
 * Send spec selection menu to user
 * @param {Object} interaction - Discord interaction
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} selectedClass - Selected WoW class
 * @param {string} category - Session category
 * @returns {Promise<void>}
 */
async function sendSpecSelection(interaction, sessionId, userId, selectedClass, category) {
  try {
    // Create spec selection menu
    const row = createSpecSelectionMenu(
      sessionId, 
      userId, 
      selectedClass, 
      category, 
      interaction.client,
      emojiManager
    );
    
    // Edit the existing message with new content and components
    return interaction.editReply({
      components: [row]
    });
  } catch (error) {
    logger.error(`Error sending spec selection: ${error.message}`, error);
    return interaction.editReply({
      content: "❌ An error occurred while loading specializations. Please try again.",
      components: []
    });
  }
}

/**
 * Send role-filtered spec selection menu to user
 * @param {Object} interaction - Discord interaction
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} selectedClass - Selected WoW class
 * @param {string} role - Selected role
 * @param {string} category - Session category
 * @returns {Promise<void>}
 */
async function sendRoleFilteredSpecSelection(interaction, sessionId, userId, selectedClass, role, category) {
  try {
    // Create role-filtered spec selection menu
    const row = createRoleFilteredSpecMenu(
      sessionId, 
      userId, 
      selectedClass, 
      role, 
      category, 
      interaction.client,
      emojiManager
    );
    
    // Edit the existing message with new content and components
    return interaction.editReply({
      components: [row]
    });
  } catch (error) {
    logger.error(`Error sending role-filtered spec selection: ${error.message}`, error);
    return interaction.editReply({
      content: "❌ An error occurred while loading specializations. Please try again.",
      components: []
    });
  }
}

/**
 * Handle spec selection from dropdown menu
 * @param {Object} interaction - Discord interaction
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} selectedSpec - Selected WoW spec
 * @returns {Promise<void>}
 */
async function handleSpecSelection(interaction, sessionId, userId, selectedSpec) {
  try {
    // First, acknowledge the interaction to prevent timeout
    await interaction.deferUpdate();
    
    // Extract category from customId if available
    const customIdParts = interaction.customId.split('_');
    const category = customIdParts.length >= 4 ? customIdParts[3] : "pvp"; // Default to pvp if not specified
    
    // Fetch the session
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return handleSessionNotFound(interaction, sessionId, true);
    }

    // Determine character type (main or alt) from session metadata
    const charType = session.meta && session.meta.rbgTier ? session.meta.rbgTier : 'main';

    // Find the gamer and update their spec
    const gamer = session.gamers.find(g => g.userId === userId);
    
    if (!gamer) {
      return handleUserNotInSession(interaction, sessionId, true);
    }

    // Update spec
    gamer.wowSpec = selectedSpec;
    await session.save();
    logSpecUpdate(userId, sessionId, selectedSpec);
    
    // Store the user's preference for this character type
    try {
      await updateCharacterPreferences(userId, session.guildId, charType, undefined, undefined, selectedSpec);
    } catch (prefError) {
      logger.error(`Error saving ${charType} spec preference for ${userId}:`, prefError);
      // Continue even if saving preferences fails
    }
    
    // Get the class emoji
    const classEmoji = emojiManager.getClassEmoji(gamer.wowClass, interaction.client) || "";
    const specEmoji = emojiManager.getSpecEmoji(gamer.wowClass, selectedSpec, interaction.client) || "";
    const roleEmoji = emojiManager.getRoleEmoji(gamer.role, interaction.client) || "";
    
    // Format spec name for display
    const formattedSpecName = formatSpecName(selectedSpec);
    
    // FIX: Fetch a fresh session from the database before updating the display
    const freshSession = await Session.findOne({ sessionId });
    if (!freshSession) {
      logger.error(`Failed to fetch fresh session ${sessionId} after save`);
      // Fall back to the in-memory session if we can't fetch a fresh one
      await updateSessionDisplay(interaction.client, session);
    } else {
      // Use the fresh session for display update
      await updateSessionDisplay(interaction.client, freshSession);
      logger.info(`Session display updated with fresh session data for ${sessionId}`);
    }
    
    // Get a formatted message
    const completionMessage = formatCompleteSelectionMessage(
      formattedSpecName,
      gamer.wowClass,
      gamer.role,
      charType
    );
    
    // Update the interaction instead of replying
    await interaction.editReply({
      content: completionMessage,
      components: [] // Clear the spec selection
    });
  } catch (error) {
    return handleInteractionError(interaction, error, 'generic', true);
  }
}

module.exports = {
  sendSpecSelection,
  sendRoleFilteredSpecSelection,
  handleSpecSelection
};