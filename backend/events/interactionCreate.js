// events/interactionCreate.js
const { InteractionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { constructSessionEmbed } = require("./handlers/embedBuilder");
const Session = require("../models/Session");
const GuildConfig = require("../models/GuildConfig");
const logger = require("../utils/logger");
const configCommand = require("../commands/config");

// Import all handlers from the main sessionHandlers module
const {
  // Status handlers
  handleJoin,
  handleLate,
  handleTentative,
  handleBackup,
  handleCantMakeIt,
  handleNoChanges,
  
  // Selection handlers  
  handleRoleSelection,
  handleClassSelection,
  handleSpecSelection,
  handleUpdateSelection,
  
  // Component creators
  createSessionButtons,
  createUserControlPanel
} = require("./handlers/sessionHandlers");

// Import updateSessionDisplay directly from the service
const { updateSessionDisplay } = require("../utils/sessionDisplayService");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        // Log all command invocations for debugging
        logger.info(`Command invoked: ${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in ${interaction.guild?.name || 'DM'} (${interaction.guild?.id || 'DM'})`);
        
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
          logger.warn(`No command matching ${interaction.commandName} was found.`);
          return;
        }

        try {
          await command.execute(interaction);
          logger.info(`Successfully executed command: ${interaction.commandName} by ${interaction.user.tag}`);
        } catch (error) {
          logger.error(`Error executing command: ${interaction.commandName}`, error);
          
          const errorContent = error.message || "An error occurred while executing this command.";
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: `❌ ${errorContent}`,
              ephemeral: true,
            }).catch(err => {
              logger.error(`Could not send error followUp for ${interaction.commandName}:`, err);
            });
          } else {
            await interaction.reply({
              content: `❌ ${errorContent}`,
              ephemeral: true,
            }).catch(err => {
              logger.error(`Could not send error reply for ${interaction.commandName}:`, err);
            });
          }
        }
      }
      
      // Handle buttons
      else if (interaction.isButton()) {
        try {
          const customId = interaction.customId;
          logger.info(`Button clicked: ${customId} by ${interaction.user.tag} (${interaction.user.id})`);
          
          // Handle control panel buttons
          if (customId.startsWith('control_')) {
            return handleControlPanelButton(interaction);
          }
          
          // FIXED: Handle config-related buttons specifically
          if (customId.startsWith('config_') && !customId.includes('select')) {
            logger.info(`Config button clicked: ${customId}`);
            return configCommand.handleConfigButton(interaction);
          }
          
          // NEW: Handle the new manage signup button
          if (customId.startsWith("manage_signup_")) {
            const sessionId = customId.replace("manage_signup_", "");
            const session = await Session.findOne({ sessionId });
            
            if (!session) {
              return interaction.reply({
                content: "❌ This session no longer exists.",
                ephemeral: true
              });
            }
            
            // Check if user is already in session
            const existingGamer = session.gamers.find((gamer) => gamer.userId === interaction.user.id);
            
            if (existingGamer) {
              // User is already signed up - give them their control panel
              const { createUserControlPanel } = require('./handlers/components/userControlPanel');
              const controlPanel = createUserControlPanel(sessionId, interaction.user.id, session, interaction.message.id);
              
              return interaction.reply({
                ...controlPanel,
                ephemeral: true
              });
            } else {
              // User is not signed up - give them signup options
              const signupRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`user_letsgo_${sessionId}_${interaction.user.id}`)
                    .setLabel("I'm In!")
                    .setStyle(ButtonStyle.Success),
                  new ButtonBuilder()
                    .setCustomId(`user_late_${sessionId}_${interaction.user.id}`)
                    .setLabel("I'll be Late")
                    .setStyle(ButtonStyle.Primary)
                );
              
              const signupRow2 = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`user_backup_${sessionId}_${interaction.user.id}`)
                    .setLabel("Sign as Backup")
                    .setStyle(ButtonStyle.Primary),
                  new ButtonBuilder()
                    .setCustomId(`user_tentative_${sessionId}_${interaction.user.id}`)
                    .setLabel("I'll Try")
                    .setStyle(ButtonStyle.Secondary)
                );
              
              const signupRow3 = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`user_cantmakeit_${sessionId}_${interaction.user.id}`)
                    .setLabel("Can't Make It")
                    .setStyle(ButtonStyle.Danger)
                );
              
              return interaction.reply({
                content: "### Choose your signup status for this event:",
                components: [signupRow, signupRow2, signupRow3],
                ephemeral: true
              });
            }
          }

          // NEW: Handle user-specific status buttons
          if (customId.startsWith("user_letsgo_")) {
            const parts = customId.split("_");
            const sessionId = parts[2];
            const buttonUserId = parts[3];
            
            // Ensure the button is clicked by the right user
            if (buttonUserId !== interaction.user.id) {
              return interaction.reply({
                content: "❌ This button is not for you.",
                ephemeral: true,
              });
            }
            
            const session = await Session.findOne({ sessionId });
            if (!session) {
              return interaction.reply({
                content: "❌ This session no longer exists.",
                ephemeral: true
              });
            }
            
            return handleJoin(
              interaction,
              session,
              interaction.user.id,
              interaction.user.username || interaction.user.tag
            );
          }

          if (customId.startsWith("user_late_")) {
            const parts = customId.split("_");
            const sessionId = parts[2];
            const buttonUserId = parts[3];
            
            if (buttonUserId !== interaction.user.id) {
              return interaction.reply({
                content: "❌ This button is not for you.",
                ephemeral: true,
              });
            }
            
            const session = await Session.findOne({ sessionId });
            if (!session) {
              return interaction.reply({
                content: "❌ This session no longer exists.",
                ephemeral: true
              });
            }
            
            return handleLate(
              interaction,
              session,
              interaction.user.id,
              interaction.user.username || interaction.user.tag
            );
          }

          if (customId.startsWith("user_tentative_")) {
            const parts = customId.split("_");
            const sessionId = parts[2];
            const buttonUserId = parts[3];
            
            if (buttonUserId !== interaction.user.id) {
              return interaction.reply({
                content: "❌ This button is not for you.",
                ephemeral: true,
              });
            }
            
            const session = await Session.findOne({ sessionId });
            if (!session) {
              return interaction.reply({
                content: "❌ This session no longer exists.",
                ephemeral: true
              });
            }
            
            return handleTentative(
              interaction,
              session,
              interaction.user.id,
              interaction.user.username || interaction.user.tag
            );
          }

          if (customId.startsWith("user_backup_")) {
            const parts = customId.split("_");
            const sessionId = parts[2];
            const buttonUserId = parts[3];
            
            if (buttonUserId !== interaction.user.id) {
              return interaction.reply({
                content: "❌ This button is not for you.",
                ephemeral: true,
              });
            }
            
            const session = await Session.findOne({ sessionId });
            if (!session) {
              return interaction.reply({
                content: "❌ This session no longer exists.",
                ephemeral: true
              });
            }
            
            return handleBackup(
              interaction,
              session,
              interaction.user.id,
              interaction.user.username || interaction.user.tag
            );
          }

          if (customId.startsWith("user_cantmakeit_")) {
            const parts = customId.split("_");
            const sessionId = parts[2];
            const buttonUserId = parts[3];
            
            if (buttonUserId !== interaction.user.id) {
              return interaction.reply({
                content: "❌ This button is not for you.",
                ephemeral: true,
              });
            }
            
            const session = await Session.findOne({ sessionId });
            if (!session) {
              return interaction.reply({
                content: "❌ This session no longer exists.",
                ephemeral: true
              });
            }
            
            return handleCantMakeIt(
              interaction,
              session,
              interaction.user.id,
              interaction.user.username || interaction.user.tag
            );
          }
  
          // UPDATED: Handle user-specific role selection buttons with new prefix
          if (customId.startsWith("userrole_")) {
            const parts = customId.split("_");
            if (parts.length !== 4) {
              logger.error(`Invalid userrole button format: ${customId}`);
              return interaction.reply({
                content: "❌ Invalid button format. Please try refreshing the message.",
                ephemeral: true,
              });
            }
            
            const role = parts[1];         // tank, healer, dps, dm, player, participant
            const sessionId = parts[2];    // session ID
            const buttonUserId = parts[3]; // user ID from button
            
            // STRICT VALIDATION: Ensure the button is clicked by the right user
            if (buttonUserId !== interaction.user.id) {
              logger.warn(`User ${interaction.user.id} tried to click role button for user ${buttonUserId}`);
              return interaction.reply({
                content: "❌ This button is not for you. Please use your own signup buttons.",
                ephemeral: true,
              });
            }
            
            logger.info(`User ${interaction.user.id} selected role ${role} for session ${sessionId}`);
            
            return handleRoleSelection(
              interaction,
              sessionId,
              interaction.user.id, // Use actual user ID, not button user ID
              role
            );
          }
          
          // UPDATED: Handle user-specific update buttons with new prefix
          if (customId.startsWith("userupdate_")) {
            const parts = customId.split("_");
            if (parts.length !== 3) {
              logger.error(`Invalid userupdate button format: ${customId}`);
              return interaction.reply({
                content: "❌ Invalid button format. Please try refreshing the message.",
                ephemeral: true,
              });
            }
            
            const sessionId = parts[1];
            const buttonUserId = parts[2];
            
            // Ensure the button is clicked by the right user
            if (buttonUserId !== interaction.user.id) {
              logger.warn(`User ${interaction.user.id} tried to click update button for user ${buttonUserId}`);
              return interaction.reply({
                content: "❌ This button is not for you. Please use your own buttons.",
                ephemeral: true,
              });
            }
            
            return handleUpdateSelection(
              interaction,
              sessionId,
              interaction.user.id
            );
          }

          // UPDATED: Handle user-specific no changes buttons with new prefix
          if (customId.startsWith("usernochanges_")) {
            const parts = customId.split("_");
            if (parts.length !== 3) {
              logger.error(`Invalid usernochanges button format: ${customId}`);
              return interaction.reply({
                content: "❌ Invalid button format. Please try refreshing the message.",
                ephemeral: true,
              });
            }
            
            const sessionId = parts[1];
            const buttonUserId = parts[2];
            
            // Ensure the button is clicked by the right user
            if (buttonUserId !== interaction.user.id) {
              logger.warn(`User ${interaction.user.id} tried to click no changes button for user ${buttonUserId}`);
              return interaction.reply({
                content: "❌ This button is not for you. Please use your own buttons.",
                ephemeral: true,
              });
            }
            
            return handleNoChanges(interaction);
          }

          // If we got here, it's an unhandled button
          logger.warn(`Unhandled button interaction: ${customId}`);
          
          // Provide feedback for unhandled buttons
          await interaction.reply({
            content: "❌ This button interaction is not recognized. Please try refreshing the message.",
            ephemeral: true
          });
          
        } catch (error) {
          logger.error("Error handling button interaction:", error);
          
          // Always provide feedback to the user
          try {
            if (interaction.deferred) {
              return interaction.editReply({
                content: "❌ Something went wrong while processing your request. Please try again.",
                components: []
              });
            } else {
              return interaction.reply({
                content: "❌ Something went wrong while processing your request. Please try again.",
                ephemeral: true
              });
            }
          } catch (followupError) {
            logger.error("Error sending error feedback:", followupError);
          }
        }
      }
      
      // Handle select menus
      else if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        logger.info(`Select menu used: ${customId} by ${interaction.user.tag}`);
        
        // FIXED: Handle config-related select menus specifically
        if (customId.startsWith('config_')) {
          logger.info(`Config select menu used: ${customId}`);
          return configCommand.handleConfigSelect(interaction);
        }
        
        // Handle class selection
        if (customId.startsWith("classselect_")) {
          const parts = customId.split("_");
          if (parts.length < 3) {
            logger.error(`Invalid classselect format: ${customId}`);
            return interaction.reply({
              content: "❌ Invalid menu format. Please try refreshing the message.",
              ephemeral: true
            });
          }
          
          const sessionId = parts[1];
          const userId = parts[2];
          const selectedWowClass = interaction.values[0];
          
          // Ensure the menu is used by the right user
          if (userId !== interaction.user.id) {
            logger.warn(`User ${interaction.user.id} tried to use class selection for user ${userId}`);
            return interaction.reply({
              content: "❌ This selection menu is not for you.",
              ephemeral: true,
            });
          }
          
          return handleClassSelection(
            interaction,
            sessionId,
            userId,
            selectedWowClass
          );
        }
        
        // Handle spec selection
        if (customId.startsWith("specselect_")) {
          const parts = customId.split("_");
          if (parts.length < 3) {
            logger.error(`Invalid specselect format: ${customId}`);
            return interaction.reply({
              content: "❌ Invalid menu format. Please try refreshing the message.",
              ephemeral: true
            });
          }
          
          const sessionId = parts[1];
          const userId = parts[2];
          const selectedSpec = interaction.values[0];
          
          // Ensure the menu is used by the right user
          if (userId !== interaction.user.id) {
            logger.warn(`User ${interaction.user.id} tried to use spec selection for user ${userId}`);
            return interaction.reply({
              content: "❌ This selection menu is not for you.",
              ephemeral: true,
            });
          }
          
          return handleSpecSelection(
            interaction,
            sessionId,
            userId,
            selectedSpec
          );
        }
        
        // If we got here, it's an unhandled select menu
        logger.warn(`Unhandled select menu interaction: ${customId}`);
        
        await interaction.reply({
          content: "❌ This selection menu is not recognized. Please try refreshing the message.",
          ephemeral: true
        });
      }
      
    } catch (error) {
      logger.error("Error in interaction handler:", error);
      // Try to respond with an error message if possible
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred while processing your interaction.",
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: "❌ An error occurred while processing your interaction.",
            ephemeral: true,
          });
        }
      } catch (replyError) {
        logger.error("Error sending error response:", replyError);
      }
    }
  },
  
  // Export updateSessionDisplay for backward compatibility
  updateSessionDisplay
};

/**
 * Handle control panel button interactions
 * @param {Object} interaction - The Discord interaction
 * @returns {Promise<void>}
 */
async function handleControlPanelButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const action = parts[1]; // role, status, info
    const sessionId = parts[2];
    const userId = parts[3];
    const messageId = parts[4] || '0';
    
    // Ensure the user is clicking their own panel
    if (userId !== interaction.user.id) {
      logger.warn(`User ${interaction.user.id} tried to use control panel for user ${userId}`);
      return interaction.reply({
        content: "❌ This control panel is not for you.",
        ephemeral: true
      });
    }
    
    // Fetch the session
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return interaction.reply({
        content: "❌ This event no longer exists.",
        ephemeral: true
      });
    }
    
    // Info button does nothing (it's just an indicator)
    if (action === 'info') {
      return interaction.deferUpdate();
    }
    
    // Handle "Update Role" button
    if (action === 'role') {
      await interaction.deferUpdate();
      
      // Get category from session
      const category = session.meta?.category || "pvp";
      
      // Import dynamically to avoid circular dependencies
      const { sendRoleSelection } = require('./handlers/selectionHandlers');
      return sendRoleSelection(interaction, sessionId, userId, category, false);
    }
    
    // Handle "Update Signup" button
    if (action === 'status') {
      // Create buttons for status update with user-specific IDs
      const statusRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`user_letsgo_${sessionId}_${userId}`)
            .setLabel("I'm In!")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`user_late_${sessionId}_${userId}`)
            .setLabel("I'll be Late")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`user_tentative_${sessionId}_${userId}`)
            .setLabel("I'll Try")
            .setStyle(ButtonStyle.Secondary)
        );
      
      const secondRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`user_backup_${sessionId}_${userId}`)
            .setLabel("Sign as Backup")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`user_cantmakeit_${sessionId}_${userId}`)
            .setLabel("Can't Make It")
            .setStyle(ButtonStyle.Danger)
        );
      
      return interaction.update({
        content: "### Update Your Signup Status\nChoose your new status for this event:",
        components: [statusRow, secondRow],
        ephemeral: true
      });
    }
    
    // If we get here, it's an unknown action
    return interaction.reply({
      content: "❌ Unknown control panel action.",
      ephemeral: true
    });
    
  } catch (error) {
    logger.error("Error handling control panel button:", error);
    return interaction.reply({
      content: "❌ An error occurred while processing your control panel action.",
      ephemeral: true
    });
  }
}