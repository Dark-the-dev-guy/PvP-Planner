// events/interactionCreate.js

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.isCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(
          `Error executing ${interaction.commandName} command:`,
          error
        );
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ There was an error executing that command!",
            ephemeral: true,
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: "❌ There was an error executing that command!",
          });
        }
      }
    } else if (interaction.isButton()) {
      const [action, sessionId] = interaction.customId.split("_");

      if (!sessionId) {
        return interaction.reply({
          content: "❌ Invalid session ID.",
          ephemeral: true,
        });
      }

      const Session = require("../models/Session");
      const session = await Session.findById(sessionId);

      if (!session) {
        return interaction.reply({
          content: "❌ Session not found.",
          ephemeral: true,
        });
      }

      if (action === "letsgo") {
        if (session.participants.includes(interaction.user.id)) {
          return interaction.reply({
            content: "✅ You are already participating in this session.",
            ephemeral: true,
          });
        }

        session.participants.push(interaction.user.id);
        await session.save();

        await interaction.reply({
          content: "✅ You have joined the session!",
          ephemeral: true,
        });
      } else if (action === "cantmakeit") {
        if (!session.participants.includes(interaction.user.id)) {
          return interaction.reply({
            content: "✅ You are not participating in this session.",
            ephemeral: true,
          });
        }

        session.participants = session.participants.filter(
          (id) => id !== interaction.user.id
        );
        await session.save();

        await interaction.reply({
          content: "✅ You have left the session.",
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: "❌ Invalid action.",
          ephemeral: true,
        });
      }

      // Update the original message with the updated participant list
      const participantCount = session.participants.length;
      let participantList = "None";

      if (participantCount > 0) {
        const userMentions = session.participants
          .map((id) => `<@${id}>`)
          .join(", ");
        participantList = userMentions;
      }

      const formattedTime = `${formatTime(session.date)} ET`;
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

      if (hostUser) {
        embed.setThumbnail(hostUser.displayAvatarURL({ dynamic: true }));
      }

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

      // Edit the original message
      const message = interaction.message;
      await message.edit({ embeds: [embed], components: [row] });
    }
  },
};

function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}
