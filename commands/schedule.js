// commands/schedule.js
const { SlashCommandBuilder } = require("discord.js");
const Session = require("../models/Session");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Schedule a PvP gaming session.")
    .addStringOption((option) =>
      option
        .setName("gamemode")
        .setDescription("Game Mode (e.g., Arena3v3)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Date (YYYY-MM-DD)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("time").setDescription("Time (HH:MM)").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("Additional notes")
        .setRequired(false)
    ),
  async execute(interaction) {
    const gameMode = interaction.options.getString("gamemode");
    const date = interaction.options.getString("date");
    const time = interaction.options.getString("time");
    const notes = interaction.options.getString("notes") || "No notes";

    const sessionDateTime = new Date(`${date}T${time}:00`);

    if (isNaN(sessionDateTime)) {
      return interaction.reply("Invalid date or time format.");
    }

    const newSession = new Session({
      gameMode,
      date: sessionDateTime,
      host: `${interaction.user.username}#${interaction.user.discriminator}`,
      participants: [],
      notes,
    });

    try {
      await newSession.save();
      await interaction.reply(
        `✅ Session scheduled:\n**Game Mode:** ${gameMode}\n**Date:** ${date}\n**Time:** ${time}\n**Notes:** ${notes}`
      );
    } catch (error) {
      console.error(error);
      await interaction.reply("❌ Error scheduling the session.");
    }
  },
};
