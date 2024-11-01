// commands/schedule.js

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Session = require("../models/Session"); // Ensure this model is correctly defined
const logger = require("../utils/logger"); // Ensure logger.js exists and is correctly set up

module.exports = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Schedule a PvP gaming session.")
    .addStringOption((option) =>
      option
        .setName("gamemode")
        .setDescription("Select the game mode")
        .setRequired(true)
        .addChoices(
          { name: "2v2", value: "2v2" },
          { name: "3v3", value: "3v3" },
          { name: "RBGs", value: "rbg" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Date of the session (MM-DD-YY)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("Time of the session (HH:MM, 24-hour)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("Additional notes")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply(); // Acknowledge the command early

      const gameMode = interaction.options.getString("gamemode");
      const dateInput = interaction.options.getString("date");
      const timeInput = interaction.options.getString("time");
      const notes = interaction.options.getString("notes") || "No notes";

      // Validate date and time formats
      const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-\d{2}$/; // MM-DD-YY
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24-hour

      if (!dateRegex.test(dateInput)) {
        return interaction.editReply({
          content: "❌ Invalid date format. Please use MM-DD-YY.",
          ephemeral: true,
        });
      }

      if (!timeRegex.test(timeInput)) {
        return interaction.editReply({
          content:
            "❌ Invalid time format. Please use HH:MM in 24-hour format.",
          ephemeral: true,
        });
      }

      // Parse the date and time into a JavaScript Date object
      const [month, day, year] = dateInput.split("-").map(Number);
      const [hour, minute] = timeInput.split(":").map(Number);
      const sessionDateTime = new Date(
        `20${year}`,
        month - 1,
        day,
        hour,
        minute
      );

      if (isNaN(sessionDateTime.getTime())) {
        return interaction.editReply({
          content: "❌ Invalid date or time. Please check your inputs.",
          ephemeral: true,
        });
      }

      const newSession = new Session({
        gameMode,
        date: sessionDateTime,
        host: `${interaction.user.username}#${interaction.user.discriminator}`,
        participants: [],
        notes,
      });

      await newSession.save();

      const embed = new EmbedBuilder()
        .setTitle("📅 Session Scheduled")
        .setColor(0x1e90ff)
        .addFields(
          { name: "Game Mode", value: gameMode, inline: true },
          { name: "Date", value: dateInput, inline: true },
          { name: "Time", value: timeInput, inline: true },
          { name: "Host", value: newSession.host, inline: false },
          { name: "Notes", value: notes, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: "PvP Planner" });

      await interaction.editReply({ embeds: [embed] });
      logger.info(
        `New session scheduled by ${interaction.user.tag}: ${gameMode} on ${dateInput} at ${timeInput}`
      );
    } catch (error) {
      console.error(error);
      logger.error("Error scheduling session:", error);
      await interaction.editReply({
        content:
          "❌ There was an error scheduling the session. Please try again later.",
        ephemeral: true,
      });
    }
  },
};
