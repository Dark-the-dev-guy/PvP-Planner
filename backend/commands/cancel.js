// Commands/cancel.js

const { SlashCommandBuilder } = require("discord.js");
const Session = require("../models/Session");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cancel")
    .setDescription("Cancel a scheduled PvP session.")
    .addStringOption((option) =>
      option
        .setName("session_id")
        .setDescription("The ID of the session to cancel.")
        .setRequired(true)
    ),

  async execute(interaction) {
    const sessionId = interaction.options.getString("session_id");
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return interaction.reply({
        content: `❌ No session found with ID: \`${sessionId}\``,
        ephemeral: true,
      });
    }

    if (session.host !== interaction.user.id) {
      return interaction.reply({
        content: "❌ You are not authorized to cancel this session.",
        ephemeral: true,
      });
    }

    await Session.deleteOne({ sessionId });

    await interaction.reply(
      `✅ Session with ID: \`${sessionId}\` has been canceled.`
    );
  },
};
