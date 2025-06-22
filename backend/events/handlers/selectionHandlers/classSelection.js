// events/handlers/selectionHandlers/classSelection.js
const Session = require('../../../models/Session');
const {
  formatSpecSelectionPrompt,
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  logClassUpdate,
  updateCharacterPreferences
} = require('../utils');
const { createClassSelectionMenu } = require('../components/menus');
const logger = require('../../../utils/logger');
const emojiManager = require('../../../utils/emojiManager');

/**
 * Send class selection menu to user
 * @param {Object} interaction - Discord interaction
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} role - Selected role
 * @param {string} category - Session category
 * @returns {Promise<void>}
 */
async function sendClassSelection(interaction, sessionId, userId, role, category) {
  try {
    // Create class selection menu
    const row = createClassSelectionMenu(
      sessionId, 
      userId, 
      role, 
      category, 
      interaction.client,
      emojiManager
    );
    
    // Add the components to the existing message
    return interaction.editReply({
      components: [row]
    });
  } catch (error) {
    logger.error(`Error sending class selection: ${error.message}`, error);
    return interaction.editReply({
      content: "❌ An error occurred while loading class options. Please try again.",
      components: []
    });
  }
}

/**
 * Handle class selection from dropdown menu
 * @param {Object} interaction - Discord interaction
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} selectedClass - Selected WoW class
 * @returns {Promise<void>}
 */
async function handleClassSelection(interaction, sessionId, userId, selectedClass) {
  try {
    // First, acknowledge the interaction to prevent timeout
    await interaction.deferUpdate();
    
    // Extract role and category from customId if available
    const customIdParts = interaction.customId.split('_');
    const role = customIdParts.length >= 4 ? customIdParts[3] : null;
    const category = customIdParts.length >= 5 ? customIdParts[4] : "pvp"; // Default to pvp if not specified
    
    // Fetch the session
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return handleSessionNotFound(interaction, sessionId, true);
    }

    // Determine character type (main or alt) from session metadata
    const charType = session.meta && session.meta.rbgTier ? session.meta.rbgTier : 'main';

    // Find the gamer and update their class
    const gamer = session.gamers.find(g => g.userId === userId);
    
    if (!gamer) {
      return handleUserNotInSession(interaction, sessionId, true);
    }

    // Update class
    gamer.wowClass = selectedClass;
    await session.save();
    logClassUpdate(userId, sessionId, selectedClass);
    
    // Store the user's preference for this character type
    try {
      await updateCharacterPreferences(userId, session.guildId, charType, undefined, selectedClass);
    } catch (prefError) {
      logger.error(`Error saving ${charType} class preference for ${userId}:`, prefError);
      // Continue even if saving preferences fails
    }
    
    // Check if we should auto-select a spec based on role and class
    if (role) {
      // Import dynamically to avoid circular dependencies
      const { getRoleSpecsForClass } = require('../components/menus');
      
      // Get available specs for this class and role
      const availableSpecs = getRoleSpecsForClass(selectedClass, role);
      
      // If there's only one spec available for this role, auto-select it
      if (availableSpecs.length === 1) {
        // Update spec
        gamer.wowSpec = availableSpecs[0];
        await session.save();
        logger.info(`Auto-selected spec for user ${userId} in session ${session.sessionId}: '${availableSpecs[0]}'`);
        
        // Also update user preferences with the spec
        try {
          await updateCharacterPreferences(userId, session.guildId, charType, undefined, undefined, availableSpecs[0]);
          logger.info(`Saved ${charType} spec preference for user ${userId}: ${availableSpecs[0]}`);
        } catch (prefError) {
          logger.error(`Error saving ${charType} spec preference for ${userId}:`, prefError);
          // Continue even if saving preferences fails
        }
        
        // Get the class emoji
        const classEmoji = emojiManager.getClassEmoji(gamer.wowClass, interaction.client) || "";
        const specEmoji = emojiManager.getSpecEmoji(gamer.wowClass, availableSpecs[0], interaction.client) || "";
        const roleEmoji = emojiManager.getRoleEmoji(gamer.role, interaction.client) || "";
        
        // Import the formatters
        const { formatSpecName, formatCompleteSelectionMessage } = require('../utils');
        
        // Format spec name for display
        const formattedSpecName = formatSpecName(availableSpecs[0]);
        
        // FIX: Fetch a fresh session from the database before updating the display
        const freshSession = await Session.findOne({ sessionId });
        if (!freshSession) {
          logger.error(`Failed to fetch fresh session ${sessionId} after save`);
          // Fall back to the in-memory session if we can't fetch a fresh one
          await updateSessionDisplay(interaction.client, session);
        } else {
          // Use the fresh session for display update
          const { updateSessionDisplay } = require("../../../utils/sessionDisplayService");
          await updateSessionDisplay(interaction.client, freshSession);
          logger.info(`Session display updated with fresh session data for ${sessionId}`);
        }
        
        // Get a formatted message
        const completionMessage = formatCompleteSelectionMessage(
          formattedSpecName,
          selectedClass,
          role,
          charType
        );
        
        // Update the interaction instead of replying
        await interaction.editReply({
          content: completionMessage,
          components: [] // Clear the spec selection
        });
        
        return;
      }
      
      // If we have multiple specs available, send spec selection filtered by role
      // Import dynamically to avoid circular dependencies
      const { sendRoleFilteredSpecSelection } = require('./specSelection');
      return sendRoleFilteredSpecSelection(interaction, sessionId, userId, selectedClass, role, category);
    }
    
    // Otherwise do normal spec selection
    // Import dynamically to avoid circular dependencies
    const { sendSpecSelection } = require('./specSelection');
    
    // Use the formatter util
    const prompt = formatSpecSelectionPrompt(selectedClass);
    
    // Update content to inform user
    await interaction.editReply({
      content: prompt,
      components: [] // Will be added by sendSpecSelection
    });
    
    return sendSpecSelection(interaction, sessionId, userId, selectedClass, category);
  } catch (error) {
    return handleInteractionError(interaction, error, 'generic', true);
  }
}

module.exports = {
  sendClassSelection,
  handleClassSelection
};