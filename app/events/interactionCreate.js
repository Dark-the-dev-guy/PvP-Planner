// events/interactionCreate.js

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Session = require("../models/Session");

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
        // Only reply if the interaction has not been deferred or replied to
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: "❌ There was an error executing that command.",
            ephemeral: true,
          });
        } else {
          // If already deferred, edit the reply
          await interaction.editReply({
            content: "❌ There was an error executing that command.",
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

      try {
        const session = await Session.findOne({ sessionId });

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

        // Update the original embed with the updated participant list
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
            {
              name: "Participants",
              value: `${participantCount}`,
              inline: true,
            },
            { name: "Participant List", value: participantList, inline: false },
            { name: "Session ID", value: `${session.sessionId}`, inline: false } // Moved to bottom
          )
          .setTimestamp()
          .setFooter({ text: "PvP Planner" });

        if (hostUser) {
          embed.setThumbnail(hostUser.displayAvatarURL({ dynamic: true }));
        }

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

        // Find the original message to edit
        const message = interaction.message;
        await message.edit({ embeds: [embed], components: [row] });
      } catch (error) {
        console.error("Error handling button interaction:", error);
        await interaction.reply({
          content: "❌ There was an error processing your request.",
          ephemeral: true,
        });
      }
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
