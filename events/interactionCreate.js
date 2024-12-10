// events/interactionCreate.js

const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const Session = require("../models/Session");
const logger = require("../utils/logger"); // Assuming you have a logger utility

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton()) {
      const { customId } = interaction;
      const userId = interaction.user.id;
      const username = interaction.user.tag;

      // Expected customId formats:
      // 'letsgo_<sessionId>' or 'cantmakeit_<sessionId>'
      const [action, sessionId] = customId.split("_");

      if (!sessionId) {
        return interaction.reply({
          content: "❌ Invalid button interaction.",
          ephemeral: true,
        });
      }

      // Fetch the session by sessionId
      const session = await Session.findOne({ sessionId });

      if (!session) {
        return interaction.reply({
          content: "❌ Session not found.",
          ephemeral: true,
        });
      }

      if (action === "letsgo") {
        // Handle "Let's Go!" button
        await handleJoin(interaction, session, userId, username);
      } else if (action === "cantmakeit") {
        // Handle "Can't make it, cause I suck!" button
        // Prompt user to specify if they're not attending or late via a modal
        const modal = new ModalBuilder()
          .setCustomId(`cantmakeit_modal_${sessionId}`)
          .setTitle("Can't Make It");

        const statusInput = new TextInputBuilder()
          .setCustomId("status_input")
          .setLabel("Please specify your status")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Type 'not attending' or 'late'")
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId("reason_input")
          .setLabel("Please provide a reason (optional)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Optional")
          .setRequired(false);

        const firstActionRow = new ActionRowBuilder().addComponents(
          statusInput
        );
        const secondActionRow = new ActionRowBuilder().addComponents(
          reasonInput
        );

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
      }
    } else if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      // Handle the modal submission
      if (customId.startsWith("cantmakeit_modal_")) {
        const sessionId = customId.split("_")[2];
        const session = await Session.findOne({ sessionId });

        if (!session) {
          return interaction.reply({
            content: "❌ Session not found.",
            ephemeral: true,
          });
        }

        const statusInput = interaction.fields
          .getTextInputValue("status_input")
          .toLowerCase();
        const reasonInput =
          interaction.fields.getTextInputValue("reason_input");

        if (!["not attending", "late"].includes(statusInput)) {
          return interaction.reply({
            content:
              "❌ Invalid status. Please type 'not attending' or 'late'.",
            ephemeral: true,
          });
        }

        // Update or add the participant's status
        const existingGamer = session.gamers.find(
          (gamer) => gamer.userId === interaction.user.id
        );

        if (existingGamer) {
          existingGamer.status =
            statusInput === "late" ? "late" : "not attending";
          existingGamer.reason = reasonInput || "";
        } else {
          session.gamers.push({
            userId: interaction.user.id,
            username: interaction.user.tag,
            status: statusInput === "late" ? "late" : "not attending",
            reason: reasonInput || "",
          });
        }

        await session.save();

        await interaction.reply({
          content: `✅ Your status has been updated to **${capitalize(statusInput)}**.${reasonInput ? `\n**Reason:** ${reasonInput}` : ""}`,
          ephemeral: true,
        });

        // Update the session display embed
        await updateSessionDisplay(interaction.client, sessionId);
      }
    }
  },
};

// Handler Functions

async function handleJoin(interaction, session, userId, username) {
  const existingGamer = session.gamers.find((gamer) => gamer.userId === userId);

  if (existingGamer) {
    if (existingGamer.status === "attending") {
      return interaction.reply({
        content: "✅ You are already marked as attending the session.",
        ephemeral: true,
      });
    } else {
      existingGamer.status = "attending";
      existingGamer.reason = "";
      await session.save();
      await interaction.reply({
        content: "✅ Your status has been updated to attending the session.",
        ephemeral: true,
      });
    }
  } else {
    session.gamers.push({
      userId,
      username,
      status: "attending",
      reason: "",
    });
    await session.save();
    await interaction.reply({
      content: "✅ You have joined the session as a Gamer!",
      ephemeral: true,
    });
  }

  // Update the session display embed
  await updateSessionDisplay(interaction.client, session.sessionId);
}
