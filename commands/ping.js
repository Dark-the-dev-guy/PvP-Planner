// commands/ping.js

const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),

  async execute(interaction) {
    await interaction.deferReply(); // Acknowledge the command early
    await interaction.editReply("Pong!");
    // Optionally, log the successful execution
  },
};
