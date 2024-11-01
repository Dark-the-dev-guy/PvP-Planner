// commands/viewcalendar.js

const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const Session = require("../models/Session");

module.exports = {
  name: "viewcalendar",
  description: "View upcoming gaming sessions in a calendar format",
  async execute(message, args) {
    try {
      const sessions = await Session.find().sort({ date: 1 });

      if (sessions.length === 0) {
        return message.channel.send(
          "No upcoming gaming sessions. Be the first to schedule one!"
        );
      }

      // Group sessions by date
      const sessionsByDate = sessions.reduce((acc, session) => {
        const dateKey = session.date.toLocaleDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(session);
        return acc;
      }, {});

      // Create an embed
      const embed = new MessageEmbed()
        .setTitle("📅 Upcoming PvP Gaming Sessions")
        .setColor("#1E90FF") // WoW-themed color
        .setFooter("PvP Planner")
        .setTimestamp();

      const actionRows = [];

      // Iterate over each date
      for (const [date, sessions] of Object.entries(sessionsByDate)) {
        // Sort sessions by time
        sessions.sort((a, b) => a.date - b.date);

        let sessionDetails = "";
        let buttons = [];

        sessions.forEach((session, index) => {
          const time = session.date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          sessionDetails += `**${time}** - Host: ${session.host}\nParticipants: ${session.participants.length}\n`;

          // Create a unique button ID for each session
          const buttonId = `join_${session.sessionId}`;

          // Add a button for each session
          buttons.push(
            new MessageButton()
              .setCustomId(buttonId)
              .setLabel("Join Session")
              .setStyle("PRIMARY")
          );
        });

        // Add the date and its sessions to the embed
        embed.addField(date, sessionDetails || "No sessions scheduled.", false);

        // Create action rows with buttons (max 5 buttons per row)
        for (let i = 0; i < buttons.length; i += 5) {
          const actionRow = new MessageActionRow().addComponents(
            buttons.slice(i, i + 5)
          );
          actionRows.push(actionRow);
        }
      }

      // Send the embed with buttons
      message.channel.send({ embeds: [embed], components: actionRows });
    } catch (error) {
      console.error(error);
      message.channel.send(
        "There was an error fetching the calendar. Please try again."
      );
    }
  },
};
