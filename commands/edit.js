// commands/edit.js

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Session = require("../models/Session");
const logger = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit details of a scheduled PvP gaming session.")
    .addStringOption((option) =>
      option
        .setName("sessionid")
        .setDescription("The ID of the session to edit")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("gamemode")
        .setDescription("New game mode")
        .setRequired(false)
        .addChoices(
          { name: "2v2", value: "2v2" },
          { name: "3v3", value: "3v3" },
          { name: "RBGs", value: "rbg" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("New date of the session (MM-DD-YY)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("New time of the session (HH:MM, 24-hour)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("New notes for the session")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true }); // Acknowledge the command early

      const sessionId = interaction.options.getString("sessionid");
      const newGameMode = interaction.options.getString("gamemode");
      const newDateInput = interaction.options.getString("date");
      const newTimeInput = interaction.options.getString("time");
      const newNotes = interaction.options.getString("notes");

      // Fetch the session
      const session = await Session.findById(sessionId);

      if (!session) {
        return interaction.editReply({ content: "❌ Session not found." });
      }

      // Check if the user is the host
      if (session.host !== interaction.user.id) {
        return interaction.editReply({
          content: "❌ You do not have permission to edit this session.",
          ephemeral: true,
        });
      }

      // Prepare updates
      const updates = {};

      if (newGameMode) {
        updates.gameMode = newGameMode;
      }

      if (newDateInput || newTimeInput) {
        const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-\d{2}$/; // MM-DD-YY
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24-hour

        let sessionDateTime = session.date;

        if (newDateInput) {
          if (!dateRegex.test(newDateInput)) {
            return interaction.editReply({
              content: "❌ Invalid date format. Please use MM-DD-YY.",
              ephemeral: true,
            });
          }
          const [month, day, year] = newDateInput.split("-").map(Number);
          sessionDateTime = new Date(
            `20${year}`,
            month - 1,
            day,
            sessionDateTime.getHours(),
            sessionDateTime.getMinutes()
          );
        }

        if (newTimeInput) {
          if (!timeRegex.test(newTimeInput)) {
            return interaction.editReply({
              content:
                "❌ Invalid time format. Please use HH:MM in 24-hour format.",
              ephemeral: true,
            });
          }
          const [hour, minute] = newTimeInput.split(":").map(Number);
          sessionDateTime.setHours(hour, minute);
        }

        if (isNaN(sessionDateTime.getTime())) {
          return interaction.editReply({
            content: "❌ Invalid date or time. Please check your inputs.",
            ephemeral: true,
          });
        }

        updates.date = sessionDateTime;
      }

      if (newNotes) {
        updates.notes = newNotes;
      }

      if (Object.keys(updates).length === 0) {
        return interaction.editReply({
          content: "❌ No changes provided to update.",
          ephemeral: true,
        });
      }

      // Update the session
      await Session.updateOne({ _id: sessionId }, { $set: updates });

      // Fetch updated session
      const updatedSession = await Session.findById(sessionId);

      const embed = new EmbedBuilder()
        .setTitle("📅 Session Updated")
        .setColor(0x00ff00)
        .addFields(
          { name: "Session ID", value: `${updatedSession._id}`, inline: true },
          {
            name: "Game Mode",
            value: updatedSession.gameMode.toUpperCase(),
            inline: true,
          },
          {
            name: "Date",
            value: updatedSession.date.toLocaleDateString(),
            inline: true,
          },
          {
            name: "Time",
            value: `${formatTime(updatedSession.date)} ET`,
            inline: true,
          },
          { name: "Host", value: `<@${updatedSession.host}>`, inline: false },
          {
            name: "Notes",
            value: updatedSession.notes || "No notes",
            inline: false,
          },
          {
            name: "Participants",
            value: `${updatedSession.participants.length}`,
            inline: true,
          },
          {
            name: "Participant List",
            value:
              updatedSession.participants.length > 0
                ? updatedSession.participants.map((id) => `<@${id}>`).join(", ")
                : "None",
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: "PvP Planner" });

      await interaction.editReply({
        content: "✅ The session has been updated successfully.",
        embeds: [embed],
      });
      logger.info(
        `Session edited by ${interaction.user.tag}: ${updatedSession._id}`
      );
    } catch (error) {
      console.error("Error executing edit command:", error);
      logger.error("Error executing edit command:", error);
      await interaction.editReply({
        content:
          "❌ There was an error editing the session. Please try again later.",
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
