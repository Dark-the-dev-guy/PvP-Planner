// events/interactionCreate.js

const Session = require("../models/Session");
const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    const [action, sessionId] = interaction.customId.split("_");

    if (action === "join") {
      try {
        const session = await Session.findOne({ sessionId });

        if (!session) {
          return interaction.reply({
            content: "Session not found.",
            ephemeral: true,
          });
        }

        const userTag = `${interaction.user.username}#${interaction.user.discriminator}`;

        if (session.participants.includes(userTag)) {
          // User is already a participant, offer to leave
          const leaveButton = new MessageButton()
            .setCustomId(`leave_${session.sessionId}`)
            .setLabel("Leave Session")
            .setStyle("DANGER");

          const row = new MessageActionRow().addComponents(leaveButton);

          return interaction.reply({
            content: "You have already joined this session. Click to leave.",
            components: [row],
            ephemeral: true,
          });
        }

        // Add user to participants
        session.participants.push(userTag);
        await session.save();

        // Check if session can proceed (e.g., minimum participants)
        // Define your own criteria here

        await interaction.reply({
          content: `You have successfully joined the session!`,
          ephemeral: true,
        });

        // Optionally, update the original embed to reflect the new participant count
        // This requires fetching the message and editing the embed
        // For simplicity, we'll skip this step for now
      } catch (error) {
        console.error(error);
        interaction.reply({
          content: "There was an error joining the session. Please try again.",
          ephemeral: true,
        });
      }
    } else if (action === "leave") {
      try {
        const session = await Session.findOne({ sessionId });

        if (!session) {
          return interaction.reply({
            content: "Session not found.",
            ephemeral: true,
          });
        }

        const userTag = `${interaction.user.username}#${interaction.user.discriminator}`;

        if (!session.participants.includes(userTag)) {
          return interaction.reply({
            content: "You are not a participant of this session.",
            ephemeral: true,
          });
        }

        // Remove user from participants
        session.participants = session.participants.filter(
          (participant) => participant !== userTag
        );
        await session.save();

        await interaction.reply({
          content: `You have successfully left the session.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error(error);
        interaction.reply({
          content: "There was an error leaving the session. Please try again.",
          ephemeral: true,
        });
      }
    }
  },
};
