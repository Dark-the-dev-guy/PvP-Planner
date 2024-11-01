// commands/viewcalendar.js

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Session = require("../models/Session");
const logger = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("viewcalendar")
    .setDescription("View all scheduled PvP sessions."),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const sessions = await Session.find().sort({ date: 1 });

      if (sessions.length === 0) {
        return interaction.editReply("📅 No sessions scheduled.");
      }

      const embed = new EmbedBuilder()
        .setTitle("📅 Scheduled PvP Sessions")
        .setColor(0x1e90ff)
        .setTimestamp()
        .setFooter({ text: "PvP Planner" });

      sessions.forEach((session) => {
        const formattedTime = `${formatTime(session.date)} ET`;
        const participantCount = session.participants.length;
        const participants =
          participantCount > 0 ? session.participants.join(", ") : "None";

        embed.addFields(
          { name: "Session ID", value: `${session._id}`, inline: true },
          {
            name: "Game Mode",
            value: session.gameMode.toUpperCase(),
            inline: true,
          },
          {
            name: "Date",
            value: session.date.toLocaleDateString(),
            inline: true,
          },
          { name: "Time", value: formattedTime, inline: true },
          { name: "Host", value: session.host, inline: false },
          { name: "Participants", value: `${participantCount}`, inline: true },
          { name: "Participant List", value: participants, inline: false },
          { name: "Notes", value: session.notes || "No notes", inline: false }
        );
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error executing viewcalendar command:", error);
      logger.error("Error executing viewcalendar command:", error);
      await interaction.editReply({
        content: "❌ There was an error fetching the calendar.",
        ephemeral: true,
      });
    }
  },
};

// Helper function to format time
function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // Convert to 12-hour format
  return `${hours} ${ampm}`;
}
