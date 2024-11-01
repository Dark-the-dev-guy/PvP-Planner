// commands/viewcalendar.js

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
    .setName("viewcalendar")
    .setDescription("View all scheduled PvP sessions."),

  async execute(interaction) {
    await interaction.deferReply();

    const sessions = await Session.find().sort({ date: 1 });

    if (sessions.length === 0) {
      return interaction.editReply("📅 No sessions scheduled.");
    }

    for (const session of sessions) {
      const formattedTime = `${formatTime(session.date)} ET`;
      const participantCount = session.participants.length;
      let participantList = "None";

      if (participantCount > 0) {
        const userMentions = session.participants
          .map((id) => `<@${id}>`)
          .join(", ");
        participantList = userMentions;
      }

      // Fetch host's avatar
      const hostUser = await interaction.client.users
        .fetch(session.host)
        .catch(() => null);
      const hostDisplay = hostUser ? `<@${hostUser.id}>` : "Unknown Host";

      const embed = new EmbedBuilder()
        .setTitle(
          `${session.gameMode.toUpperCase()} on ${session.date.toLocaleDateString()} @ ${formattedTime}`
        )
        .setColor(0x1e90ff)
        .setDescription(`**Notes:** ${session.notes || "No notes"}`)
        .addFields(
          { name: "Session ID", value: `${session._id}`, inline: true },
          { name: "Host", value: hostDisplay, inline: true },
          { name: "Participants", value: `${participantCount}`, inline: true },
          { name: "Participant List", value: participantList, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: "PvP Planner" });

      // Set the host's avatar as the thumbnail
      if (hostUser) {
        embed.setThumbnail(hostUser.displayAvatarURL({ dynamic: true }));
      }

      // Add "Let's Go!" and "Can't make it, cause I suck!" buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`letsgo_${session._id}`)
          .setLabel("Let's Go!")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cantmakeit_${session._id}`)
          .setLabel("Can't make it, cause I suck!")
          .setStyle(ButtonStyle.Danger)
      );

      // Send the embed with buttons
      await interaction.followUp({ embeds: [embed], components: [row] });
    }

    // Delete the initial deferred reply to clean up
    await interaction.deleteReply();
  },
};

function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}
