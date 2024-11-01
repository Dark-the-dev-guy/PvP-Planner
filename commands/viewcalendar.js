// commands/viewcalendar.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Session = require("../models/Session");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("viewcalendar")
    .setDescription("View upcoming PvP gaming sessions in a calendar format."),
  async execute(interaction) {
    const sessions = await Session.find().sort({ date: 1 });

    if (sessions.length === 0) {
      return interaction.reply("No upcoming gaming sessions.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📅 Upcoming PvP Sessions")
      .setColor(0x1e90ff)
      .setFooter({ text: "PvP Planner" })
      .setTimestamp();

    sessions.forEach((session) => {
      embed.addFields({
        name: `${session.gameMode} - ${session.date.toLocaleString()}`,
        value: `**Host:** ${session.host}\n**Notes:** ${session.notes}\n**Participants:** ${session.participants.length}`,
      });
    });

    await interaction.reply({ embeds: [embed] });
  },
};
