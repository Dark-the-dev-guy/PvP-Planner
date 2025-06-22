// events/handlers/utils/errorHandlers.js
const logger = require('../../../utils/logger');
const { formatErrorMessage } = require('./formatterUtils');

/**
 * Handle interaction errors consistently
 * @param {Object} interaction - Discord interaction object
 * @param {Error} error - Error object
 * @param {string} errorType - Type of error (for formatting)
 * @param {boolean} isDeferred - Whether interaction is already deferred
 * @returns {Promise<void>}
 */
async function handleInteractionError(interaction, error, errorType = 'generic', isDeferred = false) {
  logger.error(`Error handling ${interaction.customId || 'interaction'}:`, error);
  
  try {
    // Get formatted error message
    const errorMessage = formatErrorMessage(errorType);
    
    // Reply to the interaction based on its state
    if (isDeferred || interaction.deferred) {
      await interaction.editReply({
        content: errorMessage,
        components: []
      });
    } else if (interaction.replied) {
      await interaction.followUp({
        content: errorMessage,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      });
    }
  } catch (followupError) {
    logger.error(`Error sending error response:`, followupError);
  }
}

/**
 * Handle session not found error
 * @param {Object} interaction - Discord interaction object
 * @param {string} sessionId - Session ID that wasn't found
 * @param {boolean} isDeferred - Whether interaction is already deferred
 * @returns {Promise<void>}
 */
async function handleSessionNotFound(interaction, sessionId, isDeferred = false) {
  logger.warn(`Session ${sessionId} not found for user ${interaction.user.id}`);
  
  try {
    const errorMessage = formatErrorMessage('session');
    
    if (isDeferred || interaction.deferred) {
      await interaction.editReply({
        content: errorMessage,
        components: []
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      });
    }
  } catch (error) {
    logger.error(`Error handling session not found:`, error);
  }
}

/**
 * Handle user not found in session error
 * @param {Object} interaction - Discord interaction object
 * @param {string} sessionId - Session ID
 * @param {boolean} isDeferred - Whether interaction is already deferred
 * @returns {Promise<void>}
 */
async function handleUserNotInSession(interaction, sessionId, isDeferred = false) {
  logger.warn(`User ${interaction.user.id} not found in session ${sessionId}`);
  
  try {
    const errorMessage = "❌ You are not signed up for this session. Please join first.";
    
    if (isDeferred || interaction.deferred) {
      await interaction.editReply({
        content: errorMessage,
        components: []
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      });
    }
  } catch (error) {
    logger.error(`Error handling user not in session:`, error);
  }
}

/**
 * Handle role full error
 * @param {Object} interaction - Discord interaction object
 * @param {string} role - Role that is full
 * @param {string} category - Session category
 * @param {boolean} isDeferred - Whether interaction is already deferred
 * @returns {Promise<void>}
 */
async function handleRoleFull(interaction, role, category, isDeferred = false) {
  logger.warn(`Role ${role} is full for session`);
  
  try {
    // Import formatRoleForDisplay from formatterUtils
    const { formatRoleForDisplay } = require('./formatterUtils');
    
    const roleDisplay = formatRoleForDisplay(role, category);
    const errorMessage = `❌ Sorry, all ${roleDisplay} slots are full. Try a different role.`;
    
    if (isDeferred || interaction.deferred) {
      await interaction.editReply({
        content: errorMessage,
        components: []
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      });
    }
  } catch (error) {
    logger.error(`Error handling role full:`, error);
  }
}

/**
 * Handle wrong button owner (when someone clicks another user's button)
 * @param {Object} interaction - Discord interaction object
 * @returns {Promise<void>}
 */
async function handleWrongButtonOwner(interaction) {
  try {
    await interaction.reply({
      content: "❌ This button is not for you. Please use your own signup buttons.",
      ephemeral: true
    });
  } catch (error) {
    logger.error(`Error handling wrong button owner:`, error);
  }
}

/**
 * Check if a user is authorized to click a button
 * @param {Object} interaction - Discord interaction object
 * @param {string} targetUserId - Target user ID from button
 * @returns {Promise<boolean>} - Whether user is authorized
 */
async function validateButtonOwner(interaction, targetUserId) {
  if (targetUserId !== interaction.user.id) {
    await handleWrongButtonOwner(interaction);
    return false;
  }
  return true;
}

module.exports = {
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  handleRoleFull,
  handleWrongButtonOwner,
  validateButtonOwner
};