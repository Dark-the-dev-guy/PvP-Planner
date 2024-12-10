// commands/sucks.js

const { SlashCommandBuilder } = require("@discordjs/builders");
const Sucks = require("../models/Sucks");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sucks")
    .setDescription('Manage the "Who sucks?" list')
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription('Add yourself to the "Who sucks?" list')
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Reason for not attending")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription('Remove yourself from the "Who sucks?" list')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription('View the "Who sucks?" list')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const username = interaction.user.tag;

    if (subcommand === "add") {
      const reason = interaction.options.getString("reason") || "Can't make it";

      try {
        const existing = await Sucks.findOne({ userId });
        if (existing) {
          return interaction.reply({
            content: 'You are already on the "Who sucks?" list.',
            ephemeral: true,
          });
        }

        const newSucks = new Sucks({ userId, username, reason });
        await newSucks.save();
        return interaction.reply({
          content: `✅ You have been added to the "Who sucks?" list.\n**Reason:** ${reason}`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error adding to Sucks:", error);
        return interaction.reply({
          content: "❌ There was an error adding you to the list.",
          ephemeral: true,
        });
      }
    }

    if (subcommand === "remove") {
      try {
        const removed = await Sucks.findOneAndDelete({ userId });
        if (!removed) {
          return interaction.reply({
            content: 'You are not on the "Who sucks?" list.',
            ephemeral: true,
          });
        }
        return interaction.reply({
          content: '✅ You have been removed from the "Who sucks?" list.',
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error removing from Sucks:", error);
        return interaction.reply({
          content: "❌ There was an error removing you from the list.",
          ephemeral: true,
        });
      }
    }

    if (subcommand === "list") {
      try {
        const sucksList = await Sucks.find({});
        if (sucksList.length === 0) {
          return interaction.reply({
            content: 'The "Who sucks?" list is currently empty.',
            ephemeral: true,
          });
        }

        const list = sucksList
          .map((suck) => `• **${suck.username}** - ${suck.reason}`)
          .join("\n");
        return interaction.reply({
          content: `**Who Sucks?**\n${list}`,
          ephemeral: false,
        });
      } catch (error) {
        console.error("Error fetching Sucks list:", error);
        return interaction.reply({
          content: "❌ There was an error fetching the list.",
          ephemeral: true,
        });
      }
    }
  },
};
