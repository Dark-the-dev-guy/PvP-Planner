// Commands/schedule.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Session = require("../models/Session");
const { v4: uuidv4 } = require("uuid");
// Import emoji manager
const emojiManager = require("../utils/emojiManager");
const { getGuildConfig } = require("../utils/configManager");
const dateUtils = require("../utils/dateUtils");
// Import session handlers for buttons
const { createSessionButtons } = require("../events/handlers/sessionHandlers");
// Import embed builder
const { constructSessionEmbed } = require("../events/handlers/embedBuilder");
const logger = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Schedule a new session.")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("The category of event to schedule")
        .setRequired(true)
        .addChoices(
          { name: "PvP (World of Warcraft)", value: "pvp" },
          { name: "PvE (World of Warcraft)", value: "pve" },
          { name: "D&D (Tabletop RPG)", value: "dnd" },
          { name: "Custom Event", value: "custom" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("game_mode")
        .setDescription("The specific mode for this session")
        .setRequired(true)
        .addChoices(
          // Default choices - these will be filtered based on category at runtime
          { name: "2v2 Arena", value: "2v2" },
          { name: "3v3 Arena", value: "3v3" },
          { name: "Rated Battlegrounds", value: "RBGs" },
          { name: "Mythic+", value: "Mythic+" },
          { name: "Raid", value: "Raid" },
          { name: "One Shot", value: "One Shot" },
          { name: "Campaign", value: "Campaign" },
          { name: "Custom Event", value: "Event" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("The date of the session in MM-DD-YY format.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("The time of the session in HH:MM format (24-hour).")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("Any additional notes for the session.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("For PvP: specify if this is a Main or Alt run.")
        .setRequired(false)
        .addChoices(
          { name: "Main Run", value: "main" },
          { name: "Alt Run", value: "alt" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("group_size")
        .setDescription("Number of total participants (for PvE Raids or Custom events).")
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(40)
    ),
 async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const config = await getGuildConfig(guildId);
      
      // Get selected category and game mode
      const category = interaction.options.getString("category");
      const gameMode = interaction.options.getString("game_mode");
      
      // Validate that the game mode belongs to the selected category
      // This is needed because Discord slash commands don't support dynamic choices yet
      const validModes = config.gameConfig?.modes?.[category] || 
                         getDefaultModesForCategory(category);
      
      if (!validModes.includes(gameMode)) {
        logger.warn(`User selected invalid mode ${gameMode} for category ${category} in guild ${guildId}`);
        
        // We'll still allow it but log a warning
        // In a future version we could reject invalid combinations
      }
      
      // Get the other parameters
      const dateInput = interaction.options.getString("date");
      const timeInput = interaction.options.getString("time");
      const notes = interaction.options.getString("notes") || "";
      const tier = interaction.options.getString("tier") || "main";
      const groupSize = interaction.options.getInteger("group_size");
      
      const host = interaction.user;
      const sessionId = uuidv4();
      
      try {
        // Use our dateUtils to parse and convert the user's date/time input
        // Pass the guild config to use the guild's timezone
        const sessionDate = dateUtils.parseUserDateTime(dateInput, timeInput, config);
        
        // Log for debugging
        logger.info(`Creating session at: ${sessionDate.toISOString()} (input: ${dateInput} ${timeInput}, category: ${category}, game mode: ${gameMode})`);
        
        if (isNaN(sessionDate.getTime())) {
          return interaction.reply({
            content: "❌ Invalid date or time provided.",
            ephemeral: true,
          });
        }
        
        // Create session object with base data
        const newSessionData = {
          sessionId,
          guildId,
          gameMode,
          date: sessionDate,
          host: host.id,
          notes,
          gamers: [],
          meta: {
            category // Always include the category in meta
          }
        };
        
        // Add category-specific metadata
        if (category === "pvp") {
          // For PvP, include tier information for RBGs
          if (gameMode === "RBGs") {
            newSessionData.meta.rbgTier = tier;
          }
          
          // Set default role requirements for PvP
          newSessionData.meta.roleRequirements = config.gameConfig?.roleRequirements?.pvp || 
                         { tank: 1, healer: 3, dps: 6 };
        } 
        else if (category === "pve") {
          // For PvE, include group size if specified
          if (groupSize) {
            newSessionData.meta.groupSize = groupSize;
          }
          
          // Set default role requirements for PvE
          newSessionData.meta.roleRequirements = config.gameConfig?.roleRequirements?.pve || 
                         { tank: 2, healer: 3, dps: 5 };
        }
        else if (category === "dnd") {
          // For D&D, set role requirements
          newSessionData.meta.roleRequirements = config.gameConfig?.roleRequirements?.dnd || 
                         { dm: 1, player: 5 };
        }
        else if (category === "custom") {
          // For custom events, include group size
          newSessionData.meta.groupSize = groupSize || 10;
          
          // Set participant requirements
          newSessionData.meta.roleRequirements = { participant: groupSize || 10 };
        }
        
        const newSession = new Session(newSessionData);
        
        await newSession.save();
        
        // Get formatted time for confirmation message
        const { formattedTime } = dateUtils.formatDateForDisplay(sessionDate, config);
        
        // Create confirmation message based on category and game mode
        let confirmMessage = `✅ New ${formatCategoryName(category)} ${gameMode} session scheduled for ${formattedTime}!`;
        
        // Add tier information for RBGs
        if (category === "pvp" && gameMode === "RBGs") {
          confirmMessage = `✅ New ${gameMode} session (${tier.toUpperCase()} run) scheduled for ${formattedTime}!`;
        }
        
        confirmMessage += " Check the events channel for details.";
        
        // Send confirmation to the user who executed the command
        await interaction.reply({
          content: confirmMessage,
          ephemeral: true
        });
    
        // Now display the session details in all designated channels
        try {
          // Use the updateSessionDisplay function to post to all configured channels
          const { updateSessionDisplay } = require("../utils/sessionDisplayService");
          await updateSessionDisplay(interaction.client, sessionId);
          
          logger.info(`Session display created for session ${sessionId} in all configured channels`);
        } catch (error) {
          logger.error("Error creating session display:", error);
          
          // Fallback to just the primary channel if needed
          try {
            const displayChannelId = process.env.DISPLAY_CHANNEL_ID || process.env.DISPLAY_CHANNEL_IDS?.split(',')[0];
            if (!displayChannelId) {
              logger.error("No DISPLAY_CHANNEL_ID environment variable is set");
              return;
            }
      
            const displayChannel = await interaction.client.channels.fetch(displayChannelId)
              .catch(err => {
                logger.error("Error fetching display channel:", err);
                return null;
              });
      
            if (!displayChannel) {
              logger.error("Display channel not found");
              return;
            }
      
            // Get session buttons
            const sessionButtons = createSessionButtons(sessionId);
      
            // Create and send the embed
            const embed = await constructSessionEmbed(interaction.client, newSession);
            
            // Create content text based on category and game mode
            let contentText = `**New ${formatCategoryName(category)} ${gameMode} Session** | <@${host.id}> is organizing`;
            
            // Add tier information for RBGs
            if (category === "pvp" && gameMode === "RBGs" && tier) {
              contentText = `**New ${gameMode} Session (${tier.toUpperCase()} RUN)** | <@${host.id}> is organizing`;
            }
            
            await displayChannel.send({ 
              content: contentText,
              embeds: [embed],
              components: sessionButtons
            });
      
            logger.info(`Session display created for session ${sessionId} in channel ${displayChannel.name} (fallback method)`);
          } catch (fallbackError) {
            logger.error("Error in fallback session display creation:", fallbackError);
          }
        }
      } catch (error) {
        logger.error("Error creating session:", error);
        return interaction.reply({
          content: `❌ Error creating session: ${error.message}`,
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error("Unexpected error in schedule command:", error);
      return interaction.reply({
        content: "❌ An unexpected error occurred while scheduling. Please try again or contact an administrator.",
        ephemeral: true,
      });
    }
  },
};

// Helper function to get default modes for a category
function getDefaultModesForCategory(category) {
  switch(category) {
    case "pvp":
      return ["2v2", "3v3", "RBGs"];
    case "pve":
      return ["Mythic+", "Raid"];
    case "dnd":
      return ["One Shot", "Campaign"];
    case "custom":
      return ["Event"];
    default:
      return ["2v2", "3v3", "RBGs"];
  }
}

// Helper function to format category names for display
function formatCategoryName(category) {
  switch(category) {
    case "pvp":
      return "PvP";
    case "pve":
      return "PvE";
    case "dnd":
      return "D&D";
    case "custom":
      return "Custom";
    default:
      return category.toUpperCase();
  }
}