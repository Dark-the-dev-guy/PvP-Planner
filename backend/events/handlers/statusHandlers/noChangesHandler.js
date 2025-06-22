// events/handlers/statusHandlers/noChangesHandler.js

/**
 * Handle "No Changes" user interactions
 * Used when a user clicks a button or submits a selection that doesn't require any updates.
 * @param {import('discord.js').Interaction} interaction - The Discord interaction object
 * @returns {Promise<void>}
 */
async function handleNoChanges(interaction) {
  try {
    await interaction.deferUpdate(); // Prevent interaction timeout
    await interaction.editReply({
      content: "✅ No changes were made to your session preferences.",
      components: [] // Optionally clear UI components
    });
  } catch (error) {
    console.error(`Error in handleNoChanges: ${error.message}`, error);
    try {
      await interaction.editReply({
        content: "❌ Something went wrong while confirming no changes.",
        components: []
      });
    } catch (followupError) {
      console.error(`Failed to send fallback error in handleNoChanges: ${followupError.message}`);
    }
  }
}

module.exports = handleNoChanges;
