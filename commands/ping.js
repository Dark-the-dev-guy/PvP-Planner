// Commands/ping.js

const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong! and latency."),

  async execute(interaction) {
    const sent = await interaction.reply({
      content: "Pong!",
      fetchReply: true,
    });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    interaction.editReply(`Pong! Latency is ${latency}ms.`);
  },
};
