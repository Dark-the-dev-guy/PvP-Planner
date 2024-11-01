// events/interactionCreate.js

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.isCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(
          `Error executing ${interaction.commandName} command:`,
          error
        );
        // Only reply if the interaction has not been deferred or replied to
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: "❌ There was an error executing that command.",
            ephemeral: true,
          });
        } else {
          // If already deferred, edit the reply
          await interaction.editReply({
            content: "❌ There was an error executing that command.",
          });
        }
      }
    } else if (interaction.isButton()) {
      // Handle button interactions here
      // Ensure proper error handling similar to above
    }
  },
};
