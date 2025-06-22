// Commands/edit.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Session = require("../models/Session");
const dateUtils = require("../utils/dateUtils");

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
        .addChoices(
          { name: "2v2", value: "2v2" },
          { name: "3v3", value: "3v3" },
          { name: "RBGs", value: "RBGs" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("New date for the session in MM-DD-YY format.")
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
    // Get the notes option directly to check if it was provided
    const notesOption = interaction.options.get("notes");

    let dateChanged = false;
    let timeChanged = false;
    let updatedDate = new Date(session.date);

    // Update fields if provided
    if (gameMode) session.gameMode = gameMode;

    try {
      // Handle date and time updates using our dateUtils
      if (dateInput && timeInput) {
        // If both date and time are provided, parse a new date
        const newDate = dateUtils.parseUserDateTime(dateInput, timeInput);
        console.log(`Parsed new date (both): ${newDate.toISOString()} from ${dateInput} ${timeInput}`);
        session.date = newDate;
        dateChanged = true;
        timeChanged = true;
      } else if (dateInput) {
        // If only date is changed, extract time from existing date
        const existingDate = new Date(session.date);
        
        // Extract hours and minutes directly from UTC to avoid timezone issues
        const hours = existingDate.getUTCHours().toString().padStart(2, '0');
        const minutes = existingDate.getUTCMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        
        console.log(`Using existing time: ${timeString} with new date: ${dateInput}`);
        
        // Create a new date with the new date but same time
        const newDate = dateUtils.parseUserDateTime(dateInput, timeString);
        console.log(`Parsed new date (date only): ${newDate.toISOString()}`);
        session.date = newDate;
        dateChanged = true;
      } else if (timeInput) {
        // If only time is changed, keep the same date
        const existingDate = new Date(session.date);
        
        // Extract month, day, year directly from UTC to avoid timezone issues
        const month = (existingDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = existingDate.getUTCDate().toString().padStart(2, '0');
        const year = existingDate.getUTCFullYear() % 100;
        const dateString = `${month}-${day}-${year}`;
        
        console.log(`Using existing date: ${dateString} with new time: ${timeInput}`);
        
        // Create a new date with the same date but new time
        const newDate = dateUtils.parseUserDateTime(dateString, timeInput);
        console.log(`Parsed new date (time only): ${newDate.toISOString()}`);
        session.date = newDate;
        timeChanged = true;
      }

      // Only update notes if the option was explicitly provided (not just undefined)
      if (notesOption) {
        console.log(`Updating notes from "${session.notes}" to "${notesOption.value}"`);
        session.notes = notesOption.value;
      } else {
        console.log(`Notes option not provided, keeping existing notes: "${session.notes}"`);
      }

      // Reset the reminder flag if date or time has changed
      if (dateChanged || timeChanged) {
        console.log("Date/time changed, resetting reminderSent flag");
        session.reminderSent = false;
      }

      // For debugging
      console.log(`Final session date after edits: ${session.date.toISOString()}`);
      console.log(`Current time: ${new Date().toISOString()}`);
      console.log(`Is session in future: ${session.date > new Date()}`);

      // Save the updated session
      await session.save();

      // Get formatted date/time for display in feedback
      const { month, day, year, formattedTime } = dateUtils.formatDateForDisplay(session.date);
      const formattedDate = `${month}-${day}-${String(year).slice(-2)}`;

      // Provide more detailed feedback
      const fields = [];
      if (gameMode) fields.push(`Game Mode: ${gameMode}`);
      if (dateChanged) fields.push(`Date: ${formattedDate}`);
      if (timeChanged) fields.push(`Time: ${formattedTime}`);
      if (notesOption) fields.push(`Notes: ${notesOption.value || "(none)"}`);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle("Session Updated Successfully")
        .setDescription(`The following changes have been made to session \`${sessionId}\`:`)
        .addFields(
          fields.map(field => ({ name: field.split(': ')[0], value: field.split(': ')[1], inline: true }))
        )
        .setFooter({ text: "Use /viewcalendar to see all upcoming sessions" })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      // Trigger update in the event channel
      try {
        const { updateSessionDisplay } = require("../utils/sessionDisplayService");
        await updateSessionDisplay(interaction.client, sessionId);
        console.log(`Session ${sessionId} display updated after edit`);
      } catch (error) {
        console.error("Could not update session display:", error);
      }
    } catch (error) {
      console.error("Error editing session:", error);
      return interaction.reply({
        content: `❌ Error updating session: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};