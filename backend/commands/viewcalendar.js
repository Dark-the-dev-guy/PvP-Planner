// Commands/viewcalendar.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Session = require("../models/Session");
const { createSessionButtons } = require("../events/handlers/sessionHandlers");
const dateUtils = require("../utils/dateUtils");
const emojiManager = require("../utils/emojiManager");
const logger = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("viewcalendar")
    .setDescription("View all scheduled sessions and events.")
    .addIntegerOption((option) =>
      option
        .setName("max_events")
        .setDescription("Maximum number of events to show (default: 5)")
        .setRequired(false)
    ),

  async execute(interaction) {
    // Log that we received the command
    logger.info(`/viewcalendar command received from ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guild.name} (${interaction.guild.id})`);
    
    try {
      // Acknowledge the command to prevent timeout
      await interaction.deferReply();
      logger.info(`/viewcalendar - Reply deferred`);

      // Get max events parameter or default to 5
      const maxEvents = interaction.options.getInteger("max_events") || 5;
      
      // Current date for comparison
      const currentDate = new Date();
      logger.info(`/viewcalendar - Current date: ${currentDate.toISOString()}`);
      
      // Find future sessions for this guild
      logger.info(`/viewcalendar - Searching for sessions in guild ${interaction.guild.id} after ${currentDate.toISOString()}`);
      
      // Perform database query
      const sessions = await Session.find({ 
        date: { $gt: currentDate },
        guildId: interaction.guild.id
      }).sort({ date: 1 }).limit(maxEvents);
      
      logger.info(`/viewcalendar - Found ${sessions.length} future sessions`);
      
      // Log session details for debugging
      if (sessions.length > 0) {
        sessions.forEach((session, index) => {
          logger.info(`/viewcalendar - Session ${index + 1}: ID=${session.sessionId}, Mode=${session.gameMode}, Date=${session.date?.toISOString() || 'Invalid Date'}`);
        });
      }

      // Handle case when no sessions found
      if (sessions.length === 0) {
        logger.info(`/viewcalendar - No future sessions found, sending empty message`);
        return interaction.editReply({
          content: "📅 No future sessions scheduled. Use `/schedule` to create a new event!"
        });
      }

      // Process and display the found sessions
      logger.info(`/viewcalendar - Starting to process ${sessions.length} sessions for display`);
      
      try {
        // Display the first session
        logger.info(`/viewcalendar - Processing first session (${sessions[0].sessionId})`);
        await displaySession(interaction, sessions[0], true);
        
        // Process remaining sessions with slight delay to avoid rate limits
        for (let i = 1; i < sessions.length; i++) {
          logger.info(`/viewcalendar - Processing session ${i+1} (${sessions[i].sessionId})`);
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Display this session
          await displaySession(interaction, sessions[i], false);
        }
        
        logger.info(`/viewcalendar - Successfully displayed ${sessions.length} sessions`);
        
        // If there are more events than shown, add an informational message
        if (sessions.length === maxEvents) {
          const totalCount = await Session.countDocuments({ 
            date: { $gt: currentDate },
            guildId: interaction.guild.id
          });
          
          if (totalCount > maxEvents) {
            logger.info(`/viewcalendar - Showing limited results (${maxEvents}/${totalCount}), sending info message`);
            await interaction.followUp({
              content: `Showing ${maxEvents} of ${totalCount} upcoming events. Use \`/viewcalendar max_events:${Math.min(totalCount, 10)}\` to see more.`,
              ephemeral: true
            });
          }
        }
      } catch (processError) {
        logger.error(`/viewcalendar - Error processing sessions:`, processError);
        
        // Send error message
        if (!interaction.replied) {
          await interaction.editReply({
            content: "❌ An error occurred while processing the calendar. Please try again later or contact an administrator."
          });
        } else {
          await interaction.followUp({
            content: "❌ Some events could not be displayed due to an error. Please try again later or contact an administrator.",
            ephemeral: true
          });
        }
      }
    } catch (error) {
      logger.error(`/viewcalendar - Command execution error:`, error);
      
      // Ensure we respond to the user even if an error occurs
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred while fetching the calendar. Please try again later.",
            ephemeral: true
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: "❌ An error occurred while fetching the calendar. Please try again later."
          });
        } else {
          await interaction.followUp({
            content: "❌ An error occurred while fetching the calendar. Please try again later.",
            ephemeral: true
          });
        }
      } catch (responseError) {
        logger.error(`/viewcalendar - Error sending error response:`, responseError);
      }
    }
  },
};

/**
 * Display a session as an embed message
 * @param {Object} interaction - Discord interaction
 * @param {Object} session - Session to display
 * @param {boolean} isFirstMessage - Whether this is the first message (edit vs followUp)
 * @returns {Promise<void>}
 */
async function displaySession(interaction, session, isFirstMessage) {
  try {
    // Validate session object
    if (!session || !session.sessionId) {
      logger.warn(`/viewcalendar - Invalid session object for display`);
      return false;
    }
    
    // Log that we're displaying this session
    logger.info(`/viewcalendar - Displaying session ${session.sessionId} (${session.gameMode})`);

    // Format date for display
    let dateDisplay;
    try {
      dateDisplay = dateUtils.formatDateForDisplay(session.date);
      logger.info(`/viewcalendar - Formatted date: ${JSON.stringify(dateDisplay)}`);
    } catch (dateError) {
      logger.error(`/viewcalendar - Error formatting date:`, dateError);
      dateDisplay = { 
        dayOfWeek: "Unknown", 
        month: 1, 
        day: 1, 
        formattedTime: "Unknown time" 
      };
    }
    
    const { dayOfWeek, month, day, formattedTime } = dateDisplay;
    
    // Get category from session or infer from game mode
    const category = session.meta?.category || inferCategoryFromGameMode(session.gameMode);
    
    // Get game mode color
    const gameModeColor = getGameModeColor(session.gameMode, category);
    
    // Fetch host user
    const hostUser = await interaction.client.users.fetch(session.host).catch(() => null);
    
    // Get session buttons
    let sessionButtons;
    try {
      sessionButtons = createSessionButtons(session.sessionId);
    } catch (buttonError) {
      logger.error(`/viewcalendar - Error creating buttons:`, buttonError);
      sessionButtons = createFallbackButtons(session.sessionId);
    }
    
    // Create basic embed
    const embed = new EmbedBuilder()
      .setColor(gameModeColor)
      .setTitle(`${session.gameMode} on ${dayOfWeek} at ${formattedTime}`)
      .setDescription(`Hosted by ${hostUser ? `<@${hostUser.id}>` : "Unknown Host"}`)
      .setFooter({ text: `Session ID: ${session.sessionId} • PvP Planner` })
      .setTimestamp();
    
    // Add participants info based on category
    addParticipantsToEmbed(embed, session, category, interaction.client);
    
    // Add notes field
    embed.addFields({
      name: "📝 Notes",
      value: session.notes?.length > 0 ? session.notes : "No notes provided.",
      inline: false
    });
    
    // Send or edit the message
    if (isFirstMessage) {
      await interaction.editReply({
        embeds: [embed],
        components: sessionButtons
      });
    } else {
      await interaction.followUp({
        embeds: [embed],
        components: sessionButtons
      });
    }
    
    logger.info(`/viewcalendar - Successfully displayed session ${session.sessionId}`);
    return true;
  } catch (error) {
    logger.error(`/viewcalendar - Error displaying session:`, error);
    return false;
  }
}

/**
 * Add participants information to an embed based on category
 * @param {EmbedBuilder} embed - Embed to add fields to
 * @param {Object} session - Session object
 * @param {string} category - Session category
 * @param {Client} client - Discord client
 */
function addParticipantsToEmbed(embed, session, category, client) {
  // Ensure gamers array exists
  const gamers = session.gamers || [];
  
  // Group gamers by status
  const attending = gamers.filter(g => g && g.status === "attending");
  const late = gamers.filter(g => g && g.status === "late");
  const tentative = gamers.filter(g => g && g.status === "tentative");
  const backup = gamers.filter(g => g && g.status === "backup");
  const notAttending = gamers.filter(g => g && g.status === "not attending");
  
  // Add roster status based on category
  if (category === "pvp" || category === "pve") {
    // Group by role
    const tanks = attending.filter(g => g && g.role === "tank");
    const healers = attending.filter(g => g && g.role === "healer");
    const dps = attending.filter(g => g && g.role === "dps");
    const noRole = attending.filter(g => !g || !g.role || g.role === "");
    
    // Add roster status
    embed.addFields({
      name: "👥 Roster Status",
      value: `**Tank:** ${tanks.length}/1 | **Healers:** ${healers.length}/3 | **DPS:** ${dps.length}/6${noRole.length > 0 ? ` | **Unassigned:** ${noRole.length}` : ""}`,
      inline: false
    });
    
    // Add player lists by role
    if (tanks.length > 0) {
      embed.addFields({
        name: "🛡️ Tanks",
        value: tanks.map(g => `• <@${g.userId}>${g.wowClass ? ` (${g.wowClass}${g.wowSpec ? ` ${g.wowSpec}` : ""})` : ""}`).join('\n'),
        inline: false
      });
    }
    
    if (healers.length > 0) {
      embed.addFields({
        name: "💚 Healers",
        value: healers.map(g => `• <@${g.userId}>${g.wowClass ? ` (${g.wowClass}${g.wowSpec ? ` ${g.wowSpec}` : ""})` : ""}`).join('\n'),
        inline: false
      });
    }
    
    if (dps.length > 0) {
      embed.addFields({
        name: "⚔️ DPS",
        value: dps.map(g => `• <@${g.userId}>${g.wowClass ? ` (${g.wowClass}${g.wowSpec ? ` ${g.wowSpec}` : ""})` : ""}`).join('\n'),
        inline: false
      });
    }
    
    if (noRole.length > 0) {
      embed.addFields({
        name: "❓ Unassigned Role",
        value: noRole.map(g => `• <@${g.userId}>`).join('\n'),
        inline: false
      });
    }
  } else if (category === "dnd") {
    // Group by D&D roles
    const dms = attending.filter(g => g && g.role === "dm");
    const players = attending.filter(g => g && g.role === "player");
    
    if (dms.length > 0) {
      embed.addFields({
        name: "🎲 Dungeon Masters",
        value: dms.map(g => `• <@${g.userId}>`).join('\n'),
        inline: false
      });
    }
    
    if (players.length > 0) {
      embed.addFields({
        name: "🧙 Players",
        value: players.map(g => `• <@${g.userId}>`).join('\n'),
        inline: false
      });
    }
  } else {
    // Just list all attendees for custom events
    if (attending.length > 0) {
      embed.addFields({
        name: "👥 Participants",
        value: attending.map(g => `• <@${g.userId}>`).join('\n'),
        inline: false
      });
    }
  }
  
  // Add late players
  if (late.length > 0) {
    embed.addFields({
      name: `⏰ Running Late (${late.length})`,
      value: late.map(g => `• <@${g.userId}>`).join('\n'),
      inline: false
    });
  }
  
  // Add tentative players
  if (tentative.length > 0) {
    embed.addFields({
      name: `🤔 Will Try to Make It (${tentative.length})`,
      value: tentative.map(g => `• <@${g.userId}>`).join('\n'),
      inline: false
    });
  }
  
  // Add backup players
  if (backup.length > 0) {
    embed.addFields({
      name: `🔄 Backup Players (${backup.length})`,
      value: backup.map(g => `• <@${g.userId}>`).join('\n'),
      inline: false
    });
  }
  
  // Add not attending players
  if (notAttending.length > 0) {
    embed.addFields({
      name: `👎 Who Sucks (${notAttending.length})`,
      value: notAttending.map(g => `• <@${g.userId}>`).join('\n'),
      inline: false
    });
  }
}

/**
 * Helper function to get game mode color
 * @param {string} gameMode - Game mode
 * @param {string} category - Session category
 * @returns {number} - Color hex value
 */
function getGameModeColor(gameMode, category) {
  if (category === "pvp") {
    switch (gameMode) {
      case "2v2": return 0xFF4444;    // Red
      case "3v3": return 0xFF6600;    // Orange
      case "RBGs": return 0x8A2BE2;   // Blue Violet
      default: return 0xFF0000;       // Default red
    }
  } else if (category === "pve") {
    switch (gameMode) {
      case "Mythic+": return 0x00FF00; // Green
      case "Raid": return 0x0066FF;    // Blue
      default: return 0x00AA00;        // Default green
    }
  } else if (category === "dnd") {
    switch (gameMode) {
      case "One Shot": return 0xFFD700;  // Gold
      case "Campaign": return 0x9932CC;  // Dark Orchid
      default: return 0xDAA520;          // Golden Rod
    }
  } else {
    return 0x808080; // Gray for custom events
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

/**
 * Creates fallback buttons when the main function fails
 * @param {string} sessionId - Session ID
 * @returns {Array} - Array with a single ActionRowBuilder
 */
function createFallbackButtons(sessionId) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
  
  try {
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
    return []; // Return empty array if even fallback fails
  }
}