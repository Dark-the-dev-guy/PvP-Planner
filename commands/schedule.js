// Commands/schedule.js

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
    await interaction.deferReply();

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
        content: "❌ Invalid time format. Please use HH:MM in 24-hour format.",
        ephemeral: true,
      });
    }

    // Parse the date and time into a JavaScript Date object
    const [month, day, year] = dateInput.split("-").map(Number);
    const [hour, minute] = timeInput.split(":").map(Number);
    const sessionDateTime = new Date(`20${year}`, month - 1, day, hour, minute);

    if (isNaN(sessionDateTime.getTime())) {
      return interaction.editReply({
        content: "❌ Invalid date or time. Please check your inputs.",
        ephemeral: true,
      });
    }

    // Generate a unique session ID
    const sessionId = generateSessionId();

    // Create a new session with an empty gamers array
    const newSession = new Session({
      sessionId,
      gameMode,
      date: sessionDateTime,
      host: interaction.user.id, // Storing user ID
      notes,
      gamers: [], // Initialize as empty array
    });

    try {
      await newSession.save();
    } catch (error) {
      console.error("Error saving new session:", error);
      return interaction.editReply({
        content:
          "❌ There was an error scheduling the session. Please try again.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(
        `${gameMode.toUpperCase()} on ${dateInput} @ ${formatTime(sessionDateTime)} ET`
      )
      .setColor(0x1e90ff)
      .addFields(
        { name: "Game Mode", value: gameMode.toUpperCase(), inline: true },
        { name: "Date", value: dateInput, inline: true },
        {
          name: "Time",
          value: `${formatTime(sessionDateTime)} ET`,
          inline: true,
        },
        { name: "Host", value: `<@${newSession.host}>`, inline: true },
        { name: "Notes", value: notes, inline: false },
        { name: "Gamers", value: "0", inline: true },
        { name: "Gamer List", value: "None", inline: false },
        { name: "Session ID", value: `${newSession.sessionId}`, inline: false } // Moved to bottom
      )
      .setTimestamp()
    
