// events/handlers/statusHandlers/cantMakeItHandler.js
const Session = require('../../../models/Session');
const {
  formatCantMakeItMessage,
  handleInteractionError,
  handleSessionNotFound,
  logStatusUpdate
} = require('../utils');
const { createUserControlPanel } = require('../components/userControlPanel');
const { updateSessionDisplay } = require("../../../utils/sessionDisplayService");
const logger = require('../../../utils/logger');

/**
 * Handle "Can't Make It Cause I Suck" button click
 * @param {Object} interaction - Discord interaction
 * @param {Object} session - Session object
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @returns {Promise<void>}
 */
async function handleCantMakeIt(interaction, session, userId, username) {
  try {
    // Defer the reply to prevent timeout
    await interaction.deferUpdate({ flags: 64 });
    
    // If session doesn't exist, handle the error
    if (!session) {
      return await handleSessionNotFound(interaction, "unknown", true);
    }
    
    // Store the original message ID for reference in the ephemeral panel
    const messageId = interaction.message.id;
    
    const existingGamer = session.gamers.find((gamer) => gamer.userId === userId);

    if (existingGamer) {
      if (existingGamer.status === "not attending") {
        // Create user control panel for existing user
        const controlPanel = createUserControlPanel(session.sessionId, userId, session, messageId);

        // Return ephemeral message that references the original message
        return interaction.editReply({
          ...controlPanel,
          ephemeral: true
        });
      } else {
        existingGamer.status = "not attending";
        existingGamer.reason = ""; // Clear any previous reasons
        await session.save();
        logStatusUpdate(userId, session.sessionId, 'not attending', {
          previousStatus: existingGamer.status
        });
        
        // FIX: Fetch a fresh session from the database before updating the display
        const freshSession = await Session.findOne({ sessionId: session.sessionId });
        if (!freshSession) {
          logger.error(`Failed to fetch fresh session ${session.sessionId} after save`);
          // Fall back to the in-memory session if we can't fetch a fresh one
          await updateSessionDisplay(interaction.client, session);
        } else {
          // Use the fresh session for display update
          await updateSessionDisplay(interaction.client, freshSession);
          logger.info(`Session display updated with fresh session data for ${session.sessionId}`);
        }
        
        // Create user control panel
        const controlPanel = createUserControlPanel(session.sessionId, userId, session, messageId);
        
        // Return ephemeral message that references the original message
        return interaction.editReply({
          ...controlPanel,
          ephemeral: true
        });
      }
    } else {
      session.gamers.push({
        userId,
        username,
        status: "not attending",
        reason: "",
      });
      await session.save();
      logStatusUpdate(userId, session.sessionId, 'not attending', {
        isNew: true
      });
      
      // FIX: Fetch a fresh session from the database before updating the display
      const freshSession = await Session.findOne({ sessionId: session.sessionId });
      if (!freshSession) {
        logger.error(`Failed to fetch fresh session ${session.sessionId} after save`);
        // Fall back to the in-memory session if we can't fetch a fresh one
        await updateSessionDisplay(interaction.client, session);
      } else {
        // Use the fresh session for display update
        await updateSessionDisplay(interaction.client, freshSession);
        logger.info(`Session display updated with fresh session data for ${session.sessionId}`);
      }
      
      // Create user control panel
      const controlPanel = createUserControlPanel(session.sessionId, userId, session, messageId);
      
      // Return ephemeral message that references the original message
      return interaction.editReply({
        ...controlPanel,
        ephemeral: true
      });
    }
  } catch (error) {
    return handleInteractionError(interaction, error, 'generic', true);
  }
}

module.exports = handleCantMakeIt;