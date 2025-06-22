// Commands/ping.js

const { SlashCommandBuilder } = require("discord.js");
const logger = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong! and latency."),
    
  async execute(interaction) {
    try {
      const sent = await interaction.reply({
        content: "Pong!",
        fetchReply: true,
      });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply(`Pong! Latency is ${latency}ms.`);
      
      // Log the successful execution of the command
      logger.info("Ping command executed by %s with latency %dms", interaction.user.tag, latency);
    } catch (error) {
      logger.error("Error executing ping command: %o", error);
      // Optionally, notify the user if an error occurs
      interaction.editReply("❌ An error occurred while executing the ping command.");
    }
  },
};
