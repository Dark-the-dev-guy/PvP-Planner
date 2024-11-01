// events/interactionCreate.js

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    console.log(`Received interaction: ${interaction.type}`);

    if (!interaction.isCommand()) {
      console.log("Interaction is not a command.");
      return;
    }

    const command = interaction.client.commands.get(interaction.commandName);
    console.log(`Handling command: ${interaction.commandName}`);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    try {
      await command.execute(interaction);
      console.log(`Executed command: ${interaction.commandName}`);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "There was an error executing that command!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error executing that command!",
          ephemeral: true,
        });
      }
    }
  },
};
