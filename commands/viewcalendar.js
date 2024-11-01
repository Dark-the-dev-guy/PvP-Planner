// commands/viewcalendar.js

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
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

      for (const session of sessions) {
        const formattedTime = `${formatTime(session.date)} ET`;
        const participantCount = session.participants.length;
        let participantList = "None";

        if (participantCount > 0) {
          const userMentions = session.participants
            .map((id) => `<@${id}>`)
            .join(", ");
          participantList = userMentions;
        }

        // Fetch host's avatar
        const hostUser = await interaction.client.users.fetch(session.host);
        const hostAvatar = hostUser.displayAvatarURL({
          dynamic: true,
          size: 64,
        });

        embed.addFields(
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
          { name: "Host", value: `<@${session.host}>`, inline: false },
          { name: "Participants", value: `${participantCount}`, inline: true },
          { name: "Participant List", value: participantList, inline: false },
          { name: "Notes", value: session.notes || "No notes", inline: false },
          { name: "Session ID", value: `${session._id}`, inline: false } // Moved to bottom
        );

        // Optionally, add buttons for editing or cancellation if applicable
      }

      await interaction.editReply({ embeds: [embed] });
      logger.info(`ViewCalendar command executed by ${interaction.user.tag}`);
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
