// utils/sessionDisplayService.js
const Session = require("../models/Session");
const GuildConfig = require("../models/GuildConfig");
const logger = require("./logger");

/**
 * Update the session display in all configured channels
 * @param {Client} client - Discord client
 * @param {string|Object} sessionIdOrObject - Session ID to update or session object
 * @returns {Promise<void>}
 */
async function updateSessionDisplay(client, sessionIdOrObject) {
  try {
    // Variable to hold the session
    let session;
    let sessionId;

    // Check if we received a session object or just an ID
    if (typeof sessionIdOrObject === 'object' && sessionIdOrObject !== null) {
      // We received a session object directly
      session = sessionIdOrObject;
      sessionId = session.sessionId;
      logger.info(`Using provided session object for ${sessionId}`);
    } else {
      // We received a session ID, need to fetch from database
      sessionId = sessionIdOrObject;
      session = await Session.findOne({ sessionId });
      
      if (!session) {
        logger.error(`Cannot update display: Session ${sessionId} not found`);
        return;
      }
      logger.info(`Fetched session ${sessionId} from database`);
    }
    
    logger.info(`Updating session display for ${sessionId} with ${session.gamers?.length || 0} gamers`);
    
    // Debug log to check gamer data
    const attending = session.gamers?.filter(gamer => gamer?.status === "attending") || [];
    logger.info(`Session has ${attending.length} attending gamers`);
    
    // Get display channels for this guild
    let displayChannelIds = [];
    
    // Get guild config for this session
    try {
      const guildConfig = await GuildConfig.findOne({ guildId: session.guildId });
      
      if (guildConfig && guildConfig.displayChannels && guildConfig.displayChannels.length > 0) {
        displayChannelIds = guildConfig.displayChannels;
        logger.info(`Using ${displayChannelIds.length} display channels from guild config`);
      } else if (guildConfig && guildConfig.channels && guildConfig.channels.eventsChannelId) {
        // If no display channels but events channel is set, use that
        displayChannelIds = [guildConfig.channels.eventsChannelId];
        logger.info(`Using events channel from guild config: ${displayChannelIds[0]}`);
      }
    } catch (configError) {
      logger.error(`Error getting guild config for ${session.guildId}:`, configError);
    }
    
    // If no channels found in guild config, fall back to environment variables
    if (displayChannelIds.length === 0) {
      if (process.env.DISPLAY_CHANNEL_IDS) {
        displayChannelIds = process.env.DISPLAY_CHANNEL_IDS.split(',').map(id => id.trim());
        logger.info(`Using display channels from environment: ${displayChannelIds.join(', ')}`);
      } else if (process.env.DISPLAY_CHANNEL_ID) {
        displayChannelIds = [process.env.DISPLAY_CHANNEL_ID];
        logger.info(`Using display channel from environment: ${displayChannelIds[0]}`);
      }
    }
    
    // Ensure we have channels to update
    if (displayChannelIds.length === 0) {
      logger.error(`No display channels configured for session ${sessionId} in guild ${session.guildId}`);
      return;
    }
    
    // Import modules dynamically to avoid circular dependencies
    const { createSessionButtons } = require("../events/handlers/sessionHandlers");
    const { constructSessionEmbed } = require("../events/handlers/embedBuilder");

    // Create the embed and buttons - ENHANCED ERROR HANDLING
    let sessionButtons = [];
    let embed;
    
    // Create session buttons with enhanced error handling
    try {
      logger.info(`Creating session buttons for session ${sessionId}`);
      sessionButtons = createSessionButtons(sessionId);
      
      // Validate that we got proper buttons
      if (!sessionButtons || !Array.isArray(sessionButtons) || sessionButtons.length === 0) {
        logger.warn(`Session buttons array is invalid for ${sessionId}, creating fallback buttons`);
        sessionButtons = createFallbackButtons(sessionId);
      } else {
        logger.info(`Successfully created ${sessionButtons.length} button rows for session ${sessionId}`);
      }
    } catch (buttonError) {
      logger.error(`Error creating buttons for session ${sessionId}:`, buttonError);
      // Create fallback buttons if the main function fails
      sessionButtons = createFallbackButtons(sessionId);
      logger.info(`Using fallback buttons for session ${sessionId}`);
    }
    
    // Create embed with enhanced error handling
    try {
      logger.info(`Creating session embed for session ${sessionId}`);
      embed = await constructSessionEmbed(client, session);
      logger.info(`Successfully created embed for session ${sessionId}`);
    } catch (embedError) {
      logger.error(`Error constructing embed for session ${sessionId}:`, embedError);
      // Create a fallback embed if the main function fails
      embed = createFallbackEmbed(session);
      logger.info(`Using fallback embed for session ${sessionId}`);
    }
    
    // Get the category and game mode for content message
    const category = session.meta?.category || inferCategoryFromGameMode(session.gameMode) || "pvp";
    let contentText;
    
    if (category === "pvp" && session.gameMode === "RBGs" && session.meta?.rbgTier) {
      contentText = `**${session.gameMode} Session (${session.meta.rbgTier.toUpperCase()} RUN)** | <@${session.host}> is organizing`;
    } else {
      contentText = `**${session.gameMode} Session** | <@${session.host}> is organizing`;
    }
    
    // Try to find existing messages in each channel
    for (const channelId of displayChannelIds) {
      try {
        logger.info(`Processing channel ${channelId} for session ${sessionId}`);
        
        const channel = await client.channels.fetch(channelId).catch(err => {
          logger.error(`Error fetching channel ${channelId}:`, err);
          return null;
        });
        
        if (!channel) {
          logger.warn(`Could not fetch display channel ${channelId}`);
          continue;
        }
        
        // Check if the bot has permission to send messages in this channel
        const permissions = channel.permissionsFor(client.user);
        if (!permissions || !permissions.has('SendMessages')) {
          logger.warn(`Missing permission to send messages in channel ${channelId}`);
          continue;
        }
        
        // Fetch recent messages and see if any contain this session
        const messages = await channel.messages.fetch({ limit: 50 }).catch(err => {
          logger.error(`Error fetching messages in channel ${channelId}:`, err);
          return null;
        });
        
        if (!messages) {
          logger.warn(`Could not fetch messages from channel ${channelId}`);
          continue;
        }
        
        // Find existing session message
        const sessionMessage = messages.find(msg => 
          msg.embeds.length > 0 && 
          msg.embeds[0].footer && 
          msg.embeds[0].footer.text && 
          msg.embeds[0].footer.text.includes(sessionId)
        );
        
        if (sessionMessage) {
          // Update existing message with enhanced error handling
          logger.info(`Updating existing message for session ${sessionId} in channel ${channelId}`);
          
          // Validate components before sending
          if (!sessionButtons || sessionButtons.length === 0) {
            logger.warn(`No session buttons available for ${sessionId}, creating emergency fallback`);
            sessionButtons = createEmergencyFallbackButtons(sessionId);
          }
          
          try {
            await sessionMessage.edit({
              content: contentText,
              embeds: [embed],
              components: sessionButtons
            });
            logger.info(`✅ Successfully updated message for session ${sessionId} in channel ${channelId}`);
          } catch (editError) {
            logger.error(`❌ Error editing message for session ${sessionId} in channel ${channelId}:`, editError);
            
            // Enhanced retry logic
            await handleMessageUpdateError(sessionMessage, contentText, embed, sessionButtons, sessionId, editError);
          }
        } else {
          // Create new message with enhanced error handling
          logger.info(`Creating new message for session ${sessionId} in channel ${channelId}`);
          
          // Validate components before sending
          if (!sessionButtons || sessionButtons.length === 0) {
            logger.warn(`No session buttons available for ${sessionId}, creating emergency fallback`);
            sessionButtons = createEmergencyFallbackButtons(sessionId);
          }
          
          try {
            await channel.send({
              content: contentText,
              embeds: [embed],
              components: sessionButtons
            });
            logger.info(`✅ Successfully created new message for session ${sessionId} in channel ${channelId}`);
          } catch (sendError) {
            logger.error(`❌ Error sending message for session ${sessionId} in channel ${channelId}:`, sendError);
            
            // Enhanced retry logic for new messages
            await handleMessageSendError(channel, contentText, embed, sessionButtons, sessionId, sendError);
          }
        }
      } catch (channelError) {
        logger.error(`Error updating session in channel ${channelId}:`, channelError);
      }
    }
    
    logger.info(`Session display update completed for ${sessionId}`);
  } catch (error) {
    logger.error(`Error updating session display:`, error);
  }
}

/**
 * Enhanced error handling for message updates
 */
async function handleMessageUpdateError(message, content, embed, buttons, sessionId, error) {
  logger.info(`Attempting to recover from message update error for session ${sessionId}`);
  
  // Try with simplified components first
  try {
    const simplifiedButtons = buttons && buttons.length > 0 ? [buttons[0]] : createEmergencyFallbackButtons(sessionId);
    await message.edit({
      content: content,
      embeds: [embed],
      components: simplifiedButtons
    });
    logger.info(`✅ Recovered with simplified components for session ${sessionId}`);
    return;
  } catch (retryError) {
    logger.error(`❌ Simplified components retry failed for session ${sessionId}:`, retryError);
  }
  
  // Try with no components as last resort
  try {
    await message.edit({
      content: content,
      embeds: [embed],
      components: []
    });
    logger.warn(`⚠️ Updated message without components for session ${sessionId}`);
  } catch (finalError) {
    logger.error(`❌ Final fallback failed for session ${sessionId}:`, finalError);
  }
}

/**
 * Enhanced error handling for message sends
 */
async function handleMessageSendError(channel, content, embed, buttons, sessionId, error) {
  logger.info(`Attempting to recover from message send error for session ${sessionId}`);
  
  // Try with simplified components first
  try {
    const simplifiedButtons = buttons && buttons.length > 0 ? [buttons[0]] : createEmergencyFallbackButtons(sessionId);
    await channel.send({
      content: content,
      embeds: [embed],
      components: simplifiedButtons
    });
    logger.info(`✅ Recovered with simplified components for session ${sessionId}`);
    return;
  } catch (retryError) {
    logger.error(`❌ Simplified components retry failed for session ${sessionId}:`, retryError);
  }
  
  // Try with no components as last resort
  try {
    await channel.send({
      content: content,
      embeds: [embed],
      components: []
    });
    logger.warn(`⚠️ Sent message without components for session ${sessionId}`);
  } catch (finalError) {
    logger.error(`❌ Final fallback failed for session ${sessionId}:`, finalError);
  }
}

/**
 * Creates fallback buttons when the main function fails
 * @param {string} sessionId - Session ID
 * @returns {Array} - Array with a single ActionRowBuilder
 */
function createFallbackButtons(sessionId) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
  
  try {
    logger.info(`Creating fallback buttons for session ${sessionId}`);
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`manage_signup_${sessionId}`)
          .setLabel("Manage My Signup")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⚙️")
      );
    
    return [row];
  } catch (error) {
    logger.error(`Error creating fallback buttons for ${sessionId}:`, error);
    return createEmergencyFallbackButtons(sessionId);
  }
}

/**
 * Creates emergency fallback buttons when even fallback fails
 * @param {string} sessionId - Session ID
 * @returns {Array} - Array with minimal buttons or empty array
 */
function createEmergencyFallbackButtons(sessionId) {
  try {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    
    logger.warn(`Creating emergency fallback buttons for session ${sessionId}`);
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`manage_signup_${sessionId}`)
          .setLabel("Join Event")
          .setStyle(ButtonStyle.Primary)
      );
    
    return [row];
  } catch (error) {
    logger.error(`Emergency fallback buttons failed for ${sessionId}:`, error);
    return []; // Return empty array as absolute last resort
  }
}

/**
 * Creates a fallback embed when the main function fails
 * @param {Object} session - Session object
 * @returns {EmbedBuilder} - Basic embed with session info
 */
function createFallbackEmbed(session) {
  const { EmbedBuilder } = require("discord.js");
  
  try {
    const date = session.date ? new Date(session.date) : new Date();
    const dateString = date.toLocaleString();
    
    return new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`${session.gameMode} Session`)
      .setDescription(`Hosted by <@${session.host}>\nScheduled for: ${dateString}`)
      .setFooter({ text: `Session ID: ${session.sessionId} • PvP Planner` })
      .setTimestamp();
  } catch (error) {
    logger.error(`Error creating fallback embed:`, error);
    
    // Return an extremely simple embed if even the fallback fails
    return new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle("Session Display Error")
      .setDescription("There was an error displaying this session. Please try again.");
  }
}

/**
 * Infer category from game mode
 * @param {string} gameMode - Game mode
 * @returns {string} - Category
 */
function inferCategoryFromGameMode(gameMode) {
  if (!gameMode) return "pvp";
  
  if (["2v2", "3v3", "RBGs"].includes(gameMode)) return "pvp";
  if (["Mythic+", "Raid"].includes(gameMode)) return "pve";
  if (["One Shot", "Campaign"].includes(gameMode)) return "dnd";
  return "custom";
}

module.exports = {
  updateSessionDisplay
};