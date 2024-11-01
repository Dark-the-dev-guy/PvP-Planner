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
      await interaction.deferReply({ ephemeral: true }); // Acknowledge the command early

      const sessionId = interaction.options.getString("sessionid");
      const hostUser = interaction.options.getUser("host");

      let query = {};

      if (sessionId) {
        query._id = sessionId;
      } else if (hostUser) {
        query.host = `${hostUser.username}#${hostUser.discriminator}`;
      } else {
        // If no session ID or host is provided, list sessions for the user
        query.host = `${interaction.user.username}#${interaction.user.discriminator}`;
      }

      const sessions = await Session.find(query);

      if (sessions.length === 0) {
        return interaction.editReply({
          content: "No matching sessions found to cancel.",
        });
      }

      // If multiple sessions are found, list them and prompt for specific cancellation
      if (sessions.length > 1) {
        let sessionList =
          "Please specify which session you want to cancel by providing the **Session ID**:\n\n";
        sessions.forEach((session) => {
          sessionList += `**ID:** ${session._id}\n**Game Mode:** ${session.gameMode.toUpperCase()}\n**Date:** ${session.date.toLocaleDateString()}\n**Time:** ${formatTime(session.date)} ET\n**Host:** ${session.host}\n\n`;
        });

        return interaction.editReply({ content: sessionList });
      }

      // If only one session is found, proceed to cancel it
      const session = sessions[0];
      await Session.deleteOne({ _id: session._id });

      const embed = new EmbedBuilder()
        .setTitle("📅 Session Canceled")
        .setColor(0xff0000)
        .addFields(
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
        )
        .setTimestamp()
        .setFooter({ text: "PvP Planner" });

      await interaction.editReply({
        content: "✅ The session has been canceled successfully.",
        embeds: [embed],
      });
      logger.info(
        `Session canceled by ${interaction.user.tag}: ${session._id}`
      );
    } catch (error) {
      console.error("Error executing cancel command:", error);
      logger.error("Error executing cancel command:", error);
      await interaction.editReply({
        content:
          "❌ There was an error canceling the session. Please try again later.",
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
