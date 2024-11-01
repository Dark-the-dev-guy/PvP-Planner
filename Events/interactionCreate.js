// events/interactionCreate.js

const Session = require("../models/Session"); // Ensure correct path
const logger = require("../utils/logger");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.isCommand()) {
      // Handle Slash Commands
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
        logger.info(`Executed command: ${interaction.commandName}`);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        logger.error(`Error executing ${interaction.commandName}:`, error);
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: "There was an error executing that command!",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "There was an error executing that command!",
            ephemeral: true,
          });
        }
      }
    } else if (interaction.isButton()) {
      // Handle Button Interactions
      const [action, sessionId] = interaction.customId.split("_");

      if (!sessionId) {
        await interaction.reply({
          content: "Invalid session ID.",
          ephemeral: true,
        });
        return;
      }

      try {
        const session = await Session.findById(sessionId);
        if (!session) {
          await interaction.reply({
            content: "Session not found.",
            ephemeral: true,
          });
          return;
        }

        const userTag = `${interaction.user.username}#${interaction.user.discriminator}`;

        if (action === "letsgo") {
          // "Let's Go!" button
          if (session.participants.includes(userTag)) {
            await interaction.reply({
              content: "You have already joined this session.",
              ephemeral: true,
            });
            return;
          }

          session.participants.push(userTag);
          await session.save();

          await interaction.reply({
            content: "✅ You have joined the session!",
            ephemeral: true,
          });
          logger.info(`${userTag} joined session ${sessionId}`);
        } else if (action === "cantmakeit") {
          // "Can't make it. cause I suck!" button
          if (!session.participants.includes(userTag)) {
            await interaction.reply({
              content: "You are not part of this session.",
              ephemeral: true,
            });
            return;
          }

          session.participants = session.participants.filter(
            (participant) => participant !== userTag
          );
          await session.save();

          await interaction.reply({
            content: "✅ You have left the session.",
            ephemeral: true,
          });
          logger.info(`${userTag} left session ${sessionId}`);
        } else {
          await interaction.reply({
            content: "Unknown action.",
            ephemeral: true,
          });
        }

        // Optionally, update the embed to reflect participant changes
        // This requires fetching the original message and editing the embed accordingly
        // Implementation depends on how you want to display updates
      } catch (error) {
        console.error("Error handling button interaction:", error);
        logger.error("Error handling button interaction:", error);
        await interaction.reply({
          content: "❌ There was an error processing your request.",
          ephemeral: true,
        });
      }
    }
  },
};
