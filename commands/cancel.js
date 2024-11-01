// commands/cancel.js

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Session = require("../models/Session");

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
    await interaction.deferReply({ ephemeral: true });

    const sessionId = interaction.options.getString("sessionid");
    const hostUser = interaction.options.getUser("host");

    let query = {};

    if (sessionId) {
      query._id = sessionId;
    } else if (hostUser) {
      query.host = hostUser.id;
    } else {
      // If no session ID or host is provided, list sessions for the user
      query.host = interaction.user.id;
    }

    const sessions = await Session.find(query);

    if (sessions.length === 0) {
      return interaction.editReply({
        content: "No matching sessions found to cancel.",
      });
    }

    // If multiple sessions are found and no session ID is provided, list them
    if (sessions.length > 1 && !sessionId) {
      let sessionList =
        "Please specify which session you want to cancel by providing the **Session ID**:\n\n";
      sessions.forEach((session) => {
        sessionList += `**ID:** ${session._id}\n**Game Mode:** ${session.gameMode.toUpperCase()}\n**Date:** ${session.date.toLocaleDateString()}\n**Time:** ${formatTime(session.date)} ET\n\n`;
      });

      return interaction.editReply({ content: sessionList });
    }

    // If only one session is found or session ID is provided, proceed to cancel it
    const session = sessions[0];

    // Check if the user is the host or has Admin permissions
    const member = interaction.member;
    const adminRole = interaction.guild.roles.cache.find(
      (role) => role.name === "Admin"
    ); // Replace 'Admin' with your admin role name

    if (
      session.host !== interaction.user.id &&
      !member.roles.cache.has(adminRole?.id)
    ) {
      return interaction.editReply({
        content: "❌ You do not have permission to cancel this session.",
        ephemeral: true,
      });
    }

    await Session.deleteOne({ _id: session._id });

    const embed = new EmbedBuilder()
      .setTitle(
        `📅 Session Canceled: ${session.gameMode.toUpperCase()} on ${session.date.toLocaleDateString()} @ ${formatTime(session.date)} ET`
      )
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
        { name: "Time", value: `${formatTime(session.date)} ET`, inline: true },
        {
          name: "Host",
          value: session.host ? `<@${session.host}>` : "Unknown Host",
          inline: false,
        },
        { name: "Notes", value: session.notes || "No notes", inline: false },
        {
          name: "Participants",
          value: `${session.participants.length}`,
          inline: true,
        },
        {
          name: "Participant List",
          value:
            session.participants.length > 0
              ? session.participants.map((id) => `<@${id}>`).join(", ")
              : "None",
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({ text: "PvP Planner" });

    await interaction.editReply({
      content: "✅ The session has been canceled successfully.",
      embeds: [embed],
    });
  },
};

function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}
