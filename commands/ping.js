// commands/ping.js

const { SlashCommandBuilder } = require("discord.js");
const logger = require("../utils/logger"); // Import the logger

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),

  async execute(interaction) {
    try {
      await interaction.deferReply(); // Acknowledge the command early
      await interaction.editReply("Pong!");
      logger.info("Responded with Pong!");
    } catch (error) {
      console.error("Error executing ping command:", error);
      logger.error("Error executing ping command:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ There was an error executing the ping command.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ There was an error executing the ping command.",
          ephemeral: true,
        });
      }
    }
  },
};
