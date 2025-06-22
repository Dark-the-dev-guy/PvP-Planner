// events/handlers/selectionHandlers/updateSelection.js

const logger = require('../../../utils/logger');
const Session = require('../../../models/Session');

/**
 * Handles user confirming that their role/class/spec selection hasn't changed
 * Used when a user clicks "No changes" after reviewing their selection
 */
async function handleUpdateSelection(interaction, sessionId, userId) {
  try {
    await interaction.deferUpdate();

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return interaction.editReply({
        content: "❌ Session not found.",
        components: []
      });
    }

    const gamer = session.gamers.find(g => g.userId === userId);
    if (!gamer) {
      return interaction.editReply({
        content: "❌ You are not signed up for this session. Please join first.",
        components: []
      });
    }

    const roleDisplay = gamer.role?.toUpperCase() || 'Unknown';
    const classDisplay = gamer.wowClass
      ? gamer.wowClass.charAt(0).toUpperCase() + gamer.wowClass.slice(1)
      : 'Unknown';
    const specDisplay = gamer.wowSpec || 'Unknown';

    const confirmationMessage = `✅ Got it! You're still signed up as a ${specDisplay} ${classDisplay} ${roleDisplay}. No changes made.`;

    logger.info(`User ${userId} confirmed no changes for session ${session.sessionId}`);

    await interaction.editReply({
      content: confirmationMessage,
      components: []
    });

  } catch (error) {
    logger.error(`Error in handleUpdateSelection: ${error.message}`, error);
    try {
      return interaction.editReply({
        content: "❌ Something went wrong while confirming your selection. Please try again.",
        components: []
      });
    } catch (followupError) {
      logger.error(`Error sending error message in handleUpdateSelection: ${followupError.message}`);
    }
  }
}

module.exports = handleUpdateSelection;
