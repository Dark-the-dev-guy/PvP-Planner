// Commands/schedule.js

const { SlashCommandBuilder } = require("discord.js");
const Session = require("../models/Session");
const { v4: uuidv4 } = require("uuid");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Schedule a new PvP session.")
    .addStringOption((option) =>
      option
        .setName("game_mode")
        .setDescription("The game mode for the session.")
        .setRequired(true)
        .addChoices(
          { name: "2v2", value: "2v2" },
          { name: "3v3", value: "3v3" },
          { name: "RBGs", value: "RBGs" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("The date of the session in MM-DD-YY format.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("The time of the session in HH:MM format (24-hour).")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("Any additional notes for the session.")
        .setRequired(false)
    ),

  async execute(interaction) {
    const gameMode = interaction.options.getString("game_mode");
    const dateInput = interaction.options.getString("date");
    const timeInput = interaction.options.getString("time");
    const notes = interaction.options.getString("notes") || "";
    const host = interaction.user.id;
    const sessionId = uuidv4();

    // Validate and parse date and time (MM-DD-YY)
    const dateParts = dateInput.split("-");
    const timeParts = timeInput.split(":");

    if (dateParts.length !== 3 || timeParts.length !== 2) {
      return interaction.reply({
        content:
          "❌ Please provide the date in `MM-DD-YY` format and time in `HH:MM` format.",
        ephemeral: true,
      });
    }

    let [month, day, year] = dateParts.map(Number);
    // Adjust year for 2-digit format
    year += year < 50 ? 2000 : 1900;
    const [hours, minutes] = timeParts.map(Number);
    const sessionDate = new Date(year, month - 1, day, hours, minutes);

    if (isNaN(sessionDate.getTime())) {
      return interaction.reply({
        content: "❌ Invalid date or time provided.",
        ephemeral: true,
      });
    }

    const newSession = new Session({
      sessionId,
      gameMode,
      date: sessionDate,
      host,
      notes,
      gamers: [],
    });

    await newSession.save();

    await interaction.reply(
      `✅ New session scheduled with ID: \`${sessionId}\``
    );
  },
};
