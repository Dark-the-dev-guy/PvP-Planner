// utils/reminders.js

const cron = require("node-cron");
const Session = require("../models/Session");
const { MessageEmbed } = require("discord.js");

const sendReminders = (client) => {
  // Schedule the task to run every minute
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now

    // Find sessions starting in 30 minutes
    const sessions = await Session.find({
      date: {
        $gte: new Date(reminderTime.setSeconds(0, 0)),
        $lt: new Date(reminderTime.setSeconds(59, 999)),
      },
    });

    sessions.forEach(async (session) => {
      // Fetch the channel where reminders should be sent
      const channel = client.channels.cache.get("1168218513819836446"); // Replace with your channel ID

      if (!channel) return console.error("Reminder channel not found.");

      const embed = new MessageEmbed()
        .setTitle("⏰ Upcoming PvP Gaming Session Reminder")
        .setColor("#FFA500") // Orange color
        .addField("Game Mode", session.gameMode, true)
        .addField("Date", session.date.toLocaleDateString(), true)
        .addField(
          "Time",
          session.date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          true
        )
        .addField("Host", session.host, true)
        .addField("Participants", session.participants.length, true)
        .setFooter("PvP Planner")
        .setTimestamp();

      channel.send({ embeds: [embed] });
    });
  });
};

module.exports = { sendReminders };
