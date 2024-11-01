// commands/ping.js

const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),

  async execute(interaction) {
    try {
      await interaction.deferReply(); // Optional for quick commands
      await interaction.editReply("Pong!");
      console.log("Responded with Pong!");
    } catch (error) {
      console.error("Error executing ping command:", error);
      await interaction.editReply({
        content: "❌ There was an error executing the ping command.",
        ephemeral: true,
      });
    }
  },
};
