// commands/cancel.js

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Session = require("../models/Session");
const logger = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cancel")
    .setDescription("Cancel a scheduled PvP gaming session.")
    .addStringOption((option) =>
      option
        .setName("sessionid")
        .setDescription("The ID of the session to cancel")
        .setRequired(false)
    )
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("Cancel all sessions hosted by a specific user")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true }); // Acknowledge the command

      const sessionId = interaction.options.getString("sessionid");
      const hostUser = interaction.options.getUser("host");

      let query = {};

      if (sessionId) {
        query._id = sessionId;
      } else if (hostUser) {
        query.host = `${hostUser.username}#${hostUser.discriminator}`;
      } else {
        // Default: Cancel sessions hosted by the command user
        query.host = `${interaction.user.username}#${interaction.user.discriminator}`;
      }

      const sessions = await Session.find(query);

      if (sessions.length === 0) {
        return interaction.editReply({
          content: "No matching sessions found to cancel.",
        });
      }

      // If multiple sessions are found when canceling by host
      if (sessions.length > 1 && sessionId === null && hostUser) {
        // Optional: Implement permission checks here if necessary
      }

      // Cancel all found sessions
      const cancelledSessions = await Session.deleteMany(query);

      // Prepare confirmation embed
      const embed = new EmbedBuilder()
        .setTitle("📅 Session(s) Canceled")
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: "PvP Planner" });

      sessions.forEach((session) => {
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
          {
            name: "Time",
            value: `${formatTime(session.date)} ET`,
            inline: true,
          },
          { name: "Host", value: session.host, inline: false },
          { name: "Notes", value: session.notes || "No notes", inline: false }
        );
      });

      await interaction.editReply({
        content: "✅ The session(s) have been canceled successfully.",
        embeds: [embed],
      });
      logger.info(
        `Session(s) canceled by ${interaction.user.tag}: ${sessions.map((s) => s._id).join(", ")}`
      );
    } catch (error) {
      console.error("Error executing cancel command:", error);
      logger.error("Error executing cancel command:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content:
            "❌ There was an error canceling the session(s). Please try again later.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content:
            "❌ There was an error canceling the session(s). Please try again later.",
          ephemeral: true,
        });
      }
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
