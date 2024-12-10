// Commands/edit.js

const { SlashCommandBuilder } = require("discord.js");
const Session = require("../models/Session");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit an existing PvP session.")
    .addStringOption((option) =>
      option
        .setName("session_id")
        .setDescription("The ID of the session to edit.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("game_mode")
        .setDescription("New game mode for the session.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("New date for the session in YYYY-MM-DD format.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("New time for the session in HH:MM format (24-hour).")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("New notes for the session.")
        .setRequired(false)
    ),

  async execute(interaction) {
    const sessionId = interaction.options.getString("session_id");
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return interaction.reply({
        content: `❌ No session found with ID: \`${sessionId}\``,
        ephemeral: true,
      });
    }

    if (session.host !== interaction.user.id) {
      return interaction.reply({
        content: "❌ You are not authorized to edit this session.",
        ephemeral: true,
      });
    }

    const gameMode = interaction.options.getString("game_mode");
    const dateInput = interaction.options.getString("date");
    const timeInput = interaction.options.getString("time");
    const notes = interaction.options.getString("notes");

    // Update fields if provided
    if (gameMode) session.gameMode = gameMode;

    if (dateInput) {
      const dateParts = dateInput.split("-");
      if (dateParts.length !== 3) {
        return interaction.reply({
          content: "❌ Please provide the date in `YYYY-MM-DD` format.",
          ephemeral: true,
        });
      }
      const [year, month, day] = dateParts.map(Number);
      session.date.setFullYear(year, month - 1, day);
    }

    if (timeInput) {
      const timeParts = timeInput.split(":");
      if (timeParts.length !== 2) {
        return interaction.reply({
          content: "❌ Please provide the time in `HH:MM` format.",
          ephemeral: true,
        });
      }
      const [hours, minutes] = timeParts.map(Number);
      session.date.setHours(hours, minutes, 0, 0);
    }

    if (notes !== undefined) session.notes = notes;

    await session.save();

    await interaction.reply(
      `✅ Session with ID: \`${sessionId}\` has been updated.`
    );
  },
};
