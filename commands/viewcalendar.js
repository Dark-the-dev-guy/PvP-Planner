// Commands/viewcalendar.js

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

    const embeds = [];
    const componentsArray = [];

    for (const session of sessions) {
      const formattedTime = `${formatTime(session.date)} ET`;
      const gamerCount = session.gamers.length;
      let gamerList = "None";

      if (gamerCount > 0) {
        const userMentions = session.gamers
          .filter((g) => g.status === "attending")
          .map((g) => `<@${g.userId}>`)
          .join(", ");
        gamerList = userMentions || "None";
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
          { name: "Host", value: hostDisplay, inline: true },
          { name: "Gamers", value: `${gamerCount}`, inline: true },
          {
            name: "Gamer List",
            value:
              session.gamers.length > 0
                ? session.gamers.map((g) => `<@${g.userId}>`).join(", ")
                : "None",
            inline: false,
          },
          { name: "Session ID", value: `${session.sessionId}`, inline: false } // Moved to bottom
        )
        .setTimestamp()
        .setFooter({ text: "PvP Planner" });

      if (hostUser) {
        embed.setThumbnail(hostUser.displayAvatarURL({ dynamic: true }));
      }

      embeds.push(embed);

      // Adding "Let's Go!" and "Can't make it, cause I suck!" buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`letsgo_${session.sessionId}`)
          .setLabel("Let's Go!")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cantmakeit_${session.sessionId}`)
          .setLabel("Can't make it, cause I suck!")
          .setStyle(ButtonStyle.Danger)
      );

      componentsArray.push(row);
    }

    // Discord allows up to 10 embeds per message
    // If more than 10 sessions, split into multiple mes
