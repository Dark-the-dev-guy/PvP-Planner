// events/handlers/embedBuilder.js
const { EmbedBuilder } = require("discord.js");
const dateUtils = require("../../utils/dateUtils");
const emojiManager = require("../../utils/emojiManager");
const logger = require("../../utils/logger");

/**
 * Construct an embed for displaying session information
 * @param {Client} client - Discord client for resolving emojis
 * @param {Object} session - Session object
 * @returns {Promise<EmbedBuilder>} - Constructed embed
 */
async function constructSessionEmbed(client, session) {
  try {
    // Validate session object - FIX: Added validation
    if (!session || !session.sessionId) {
      logger.error("Invalid session object provided to constructSessionEmbed");
      throw new Error("Invalid session object");
    }

    // Log session data for debugging - FIX: Added detailed logging
    logger.info(`Constructing embed for session ${session.sessionId} (${session.gameMode}) with ${session.gamers?.length || 0} gamers`);
    
    // Get the host user - FIX: Added better error handling
    const hostUser = await client.users
      .fetch(session.host)
      .catch((error) => {
        logger.warn(`Could not fetch host user ${session.host}: ${error.message}`);
        return null;
      });
    
    // Logo URL
    const logoUrl = "https://images.squarespace-cdn.com/content/6535b6bd0791df2c118f65a2/de408d56-27ef-43c0-9b41-7581faa3dc66/ChatGPT+Image+Apr+13%2C+2025%2C+04_56_29+PM.png?content-type=image%2Fpng";
    
    // Get category from meta or infer from gameMode if missing - FIX: Improved category detection
    const category = getSessionCategory(session);
    
    logger.info(`Using category "${category}" for session ${session.sessionId}, game mode ${session.gameMode}`);
    
    // Debug log to see what's coming in for session.gamers
    logger.info(`[EMBED] Session ${session.sessionId} has ${session.gamers?.length || 0} gamers`);
    if (session.gamers?.length > 0) {
      logger.info(`[EMBED] Gamers attending: ${session.gamers.filter(gamer => gamer.status === "attending").length}`);
    }
    
    // Ensure gamers array exists - FIX: Added null check and defensive coding
    const gamers = session.gamers || [];
    
    // Get users by status - FIX: Added defensive filtering
    const attending = gamers.filter(gamer => gamer && gamer.status === "attending");
    const late = gamers.filter(gamer => gamer && gamer.status === "late");
    const tentative = gamers.filter(gamer => gamer && gamer.status === "tentative");
    const backup = gamers.filter(gamer => gamer && gamer.status === "backup");
    const notAttending = gamers.filter(gamer => gamer && gamer.status === "not attending");

    // Group attending users by role based on the category
    let roleGroupings = {};
    
    if (category === "pvp" || category === "pve") {
      // Debug log to see what role values are present
      logger.info(`[EMBED] Attending users roles: ${attending.map(g => g.role || 'none').join(', ')}`);
      
      // Standard WoW roles for PvP and PvE
      roleGroupings = {
        tanks: attending.filter(g => g && g.role === 'tank'),
        healers: attending.filter(g => g && g.role === 'healer'),
        dps: attending.filter(g => g && g.role === 'dps'),
        noRole: attending.filter(g => !g || !g.role || g.role === '')
      };
      
      // Debug log for role counts
      logger.info(`[EMBED] Role counts - Tanks: ${roleGroupings.tanks.length}, Healers: ${roleGroupings.healers.length}, DPS: ${roleGroupings.dps.length}, No Role: ${roleGroupings.noRole.length}`);
    } 
    else if (category === "dnd") {
      // D&D specific roles
      roleGroupings = {
        dm: attending.filter(g => g && g.role === 'dm'),
        players: attending.filter(g => !g || !g.role || g.role === 'player'),
      };
      
      logger.info(`[EMBED] DnD role counts - DM: ${roleGroupings.dm.length}, Players: ${roleGroupings.players.length}`);
    }
    else {
      // Custom events - just participants
      roleGroupings = {
        participants: attending
      };
    }
    
    // Get embed color based on category and game mode
    let embedColor = getEmbedColor(category, session.gameMode);
    
    // Format date for display - FIX: Added error handling for date formatting
    let dateDisplay = { dayOfWeek: "Unknown", month: 1, day: 1, formattedTime: "Unknown time" };
    try {
      dateDisplay = dateUtils.formatDateForDisplay(session.date);
    } catch (dateError) {
      logger.error(`Error formatting date for session ${session.sessionId}:`, dateError);
    }
    
    const { dayOfWeek, month, day, formattedTime } = dateDisplay;
    
    // Format date in MM/DD format for the title
    const formattedDate = `${dayOfWeek} (${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')})`;
    
    // Get emoji for each category
    const categoryEmoji = getCategoryEmoji(category);
    
    // Get WoW emojis or fallback to unicode - FIX: Added safe emoji getters
    const readyEmoji = safeGetEmoji('ready', client, "🎮");
    const lateEmoji = safeGetEmoji('late', client, "⏰");
    const cantEmoji = safeGetEmoji('cantmake', client, "👎");
    const notesEmoji = safeGetEmoji('notes', client, "📝");
    const rosterEmoji = safeGetEmoji('roster', client, "👥");
    
    // Get role emojis based on category - FIX: Added safe role emoji getters
    let roleEmojis = {};
    
    if (category === "pvp" || category === "pve") {
      roleEmojis = {
        tank: safeGetRoleEmoji('tank', client, "🛡️"),
        healer: safeGetRoleEmoji('healer', client, "💚"),
        dps: safeGetRoleEmoji('dps', client, "⚔️"),
      };
    } else if (category === "dnd") {
      roleEmojis = {
        dm: "🎲", // Dice emoji for DM
        player: "🧙", // Wizard emoji for players
      };
    } else {
      roleEmojis = {
        participant: "👤", // Person emoji for generic participants
      };
    }
    
    // Format players by role with spec emoji only - FIX: Added safer player formatting
    const formatPlayer = (gamer, roleType = null) => {
      if (!gamer || !gamer.userId) {
        return "• Unknown player";
      }
      
      // Only use class/spec formatting for WoW categories
      if ((category === "pvp" || category === "pve") && gamer.wowClass) {
        let classEmoji = '';
        let specEmoji = '';
        
        try {
          classEmoji = emojiManager.getClassEmoji(gamer.wowClass, client) || '';
        } catch (error) {
          logger.warn(`Error getting class emoji for ${gamer.wowClass}:`, error);
        }
        
        if (gamer.wowSpec) {
          try {
            specEmoji = emojiManager.getSpecEmoji(gamer.wowClass, gamer.wowSpec, client) || '';
          } catch (error) {
            logger.warn(`Error getting spec emoji for ${gamer.wowClass}-${gamer.wowSpec}:`, error);
          }
        }
        
        // Combine emojis and mention - REMOVED spec name
        let prefix = '';
        if (specEmoji) {
          prefix = `${specEmoji} `;
        } else if (classEmoji) {
          prefix = `${classEmoji} `;
        }
        
        return `• ${prefix}<@${gamer.userId}>`;
      }
      // For D&D or Custom, simpler formatting
      else {
        // Get appropriate emoji based on category and role
        let roleEmoji = "";
        if (category === "dnd") {
          roleEmoji = gamer.role === "dm" ? roleEmojis.dm : roleEmojis.player;
        } else {
          roleEmoji = roleEmojis.participant;
        }
        
        return `• ${roleEmoji} <@${gamer.userId}>`;
      }
    };
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setColor(embedColor);
    
    // Set the title with appropriate formatting based on category - FIX: Improved title formatting for RBGs
    if (category === "pvp" && session.gameMode === "RBGs" && session.meta?.rbgTier) {
      embed.setTitle(`${categoryEmoji} ${session.gameMode} (${session.meta.rbgTier.toUpperCase()} RUN) on ${formattedDate} at ${formattedTime}`);
    } else {
      embed.setTitle(`${categoryEmoji} ${session.gameMode} on ${formattedDate} at ${formattedTime}`);
    }
    
    embed.setDescription(`Hosted by ${hostUser ? `<@${hostUser.id}>` : "Unknown Host"}`)
      .setThumbnail(logoUrl);
    
    // Add roster status appropriate to the category - FIX: Better role requirements handling
    if (category === "pvp" || category === "pve") {
      // Get role requirements (defaults if not specified)
      const roleReqs = getRoleRequirements(session, category);
      
      embed.addFields({ 
        name: `${rosterEmoji} Roster Status`, 
        value: `**Tank:** ${roleGroupings.tanks.length}/${roleReqs.tank} | **Healers:** ${roleGroupings.healers.length}/${roleReqs.healer} | **DPS:** ${roleGroupings.dps.length}/${roleReqs.dps}${roleGroupings.noRole.length > 0 ? ` | **No Role:** ${roleGroupings.noRole.length}` : ''}`, 
        inline: false 
      });
      
      // Add tanks - Only add if there are players or tanks are required
      if (roleReqs.tank > 0) {
        if (roleGroupings.tanks.length > 0) {
          embed.addFields({ 
            name: `${roleEmojis.tank} Tank${roleReqs.tank > 1 ? 's' : ''}`, 
            value: roleGroupings.tanks.map(g => formatPlayer(g, 'tank')).join('\n'), 
            inline: false 
          });
        } else {
          embed.addFields({ 
            name: `${roleEmojis.tank} Tank${roleReqs.tank > 1 ? 's' : ''}`, 
            value: "No tanks signed up yet", 
            inline: false 
          });
        }
      }
      
      // Add healers - Only add if there are players or healers are required
      if (roleReqs.healer > 0) {
        if (roleGroupings.healers.length > 0) {
          embed.addFields({ 
            name: `${roleEmojis.healer} Healer${roleReqs.healer > 1 ? 's' : ''}`, 
            value: roleGroupings.healers.map(g => formatPlayer(g, 'healer')).join('\n'), 
            inline: false 
          });
        } else {
          embed.addFields({ 
            name: `${roleEmojis.healer} Healer${roleReqs.healer > 1 ? 's' : ''}`, 
            value: "No healers signed up yet", 
            inline: false 
          });
        }
      }
      
      // Add DPS - FIX: Simplified DPS layout to avoid column issues
      if (roleReqs.dps > 0) {
        if (roleGroupings.dps.length > 0) {
          // Just use a single field for all DPS players to prevent formatting issues
          embed.addFields({ 
            name: `${roleEmojis.dps} DPS`, 
            value: roleGroupings.dps.map(g => formatPlayer(g, 'dps')).join('\n'), 
            inline: false 
          });
        } else {
          embed.addFields({ 
            name: `${roleEmojis.dps} DPS`, 
            value: "No DPS signed up yet", 
            inline: false 
          });
        }
      }
      
      // Add no-role players - Only add if there are players without roles
      if (roleGroupings.noRole.length > 0) {
        embed.addFields({ 
          name: `❓ No Role Selected Yet`, 
          value: roleGroupings.noRole.map(g => formatPlayer(g)).join('\n'), 
          inline: false 
        });
      }
    } 
    else if (category === "dnd") {
      // D&D specific formatting
      const roleReqs = getRoleRequirements(session, category);
      
      embed.addFields({ 
        name: `${rosterEmoji} Party Status`, 
        value: `**DM:** ${roleGroupings.dm.length}/${roleReqs.dm} | **Players:** ${roleGroupings.players.length}/${roleReqs.player}`, 
        inline: false 
      });
      
      // Add DM - Only add if there are players or DM is required
      if (roleReqs.dm > 0) {
        if (roleGroupings.dm.length > 0) {
          embed.addFields({ 
            name: `${roleEmojis.dm} Dungeon Master${roleReqs.dm > 1 ? 's' : ''}`, 
            value: roleGroupings.dm.map(g => formatPlayer(g, 'dm')).join('\n'), 
            inline: false 
          });
        } else {
          embed.addFields({ 
            name: `${roleEmojis.dm} Dungeon Master${roleReqs.dm > 1 ? 's' : ''}`, 
            value: "No DM yet", 
            inline: false 
          });
        }
      }
      
      // Add players - Only add if there are players or players are required
      if (roleReqs.player > 0) {
        if (roleGroupings.players.length > 0) {
          embed.addFields({ 
            name: `${roleEmojis.player} Players`, 
            value: roleGroupings.players.map(g => formatPlayer(g, 'player')).join('\n'), 
            inline: false 
          });
        } else {
          embed.addFields({ 
            name: `${roleEmojis.player} Players`, 
            value: "No players yet", 
            inline: false 
          });
        }
      }
    }
    else {
      // Custom event formatting
      const groupSize = session.meta?.groupSize || 10;
      const roleReqs = getRoleRequirements(session, category);
      
      embed.addFields({ 
        name: `${rosterEmoji} Attendance`, 
        value: `**Participants:** ${roleGroupings.participants.length}/${roleReqs.participant || groupSize}`, 
        inline: false 
      });
      
      // Add participants - Only add if there are participants
      if (roleGroupings.participants.length > 0) {
        embed.addFields({ 
          name: `${roleEmojis.participant} Participants`, 
          value: roleGroupings.participants.map(g => formatPlayer(g, 'participant')).join('\n'), 
          inline: false 
        });
      } else {
        embed.addFields({ 
          name: `${roleEmojis.participant} Participants`, 
          value: "No participants yet", 
          inline: false 
        });
      }
    }
    
    // Add late players - common for all categories - Only add if there are late players
    if (late.length > 0) {
      embed.addFields({ 
        name: `${lateEmoji} Running Late (${late.length})`, 
        value: late.map(g => formatPlayer(g)).join('\n'), 
        inline: false 
      });
    }
    
    // Add tentative players - common for all categories - Only add if there are tentative players
    if (tentative.length > 0) {
      embed.addFields({ 
        name: `🤔 Will Try to Make It (${tentative.length})`, 
        value: tentative.map(g => formatPlayer(g)).join('\n'), 
        inline: false 
      });
    }
    
    // Add backup players - common for all categories - Only add if there are backup players
    if (backup.length > 0) {
      embed.addFields({ 
        name: `🔄 Backup Players (${backup.length})`, 
        value: backup.map(g => formatPlayer(g)).join('\n'), 
        inline: false 
      });
    }
    
    // Add not attending players - common for all categories - Only add if there are not attending players
    if (notAttending.length > 0) {
      embed.addFields({ 
        name: `${cantEmoji} Who Sucks (${notAttending.length})`, 
        value: notAttending.map(g => `• <@${g.userId}>`).join('\n'), 
        inline: false 
      });
    }
    
    // Add notes - common for all categories
    embed.addFields({ 
      name: `${notesEmoji} Notes`, 
      value: session.notes?.length > 0 ? session.notes : "No notes. Winging it as usual.", 
      inline: false 
    });
    
    // Add footer and timestamp
    embed.setFooter({ text: `Session ID: ${session.sessionId} • Category: ${formatCategoryName(category)}` })
      .setTimestamp();
    
    return embed;
  } catch (error) {
    logger.error("Error constructing session embed:", error);
    
    // Return a basic embed if something goes wrong
    return new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle("Error displaying session details")
      .setDescription("There was an error displaying this session. Please try again or contact an administrator.")
      .setFooter({ text: `Session ID: ${session?.sessionId || 'unknown'} • PvP Planner` })
      .setTimestamp();
  }
}

// Helper function to get emoji for each category
function getCategoryEmoji(category) {
  switch(category) {
    case "pvp":
      return "⚔️"; // Crossed swords for PvP
    case "pve":
      return "🐉"; // Dragon for PvE
    case "dnd":
      return "🎲"; // Dice for D&D
    case "custom":
      return "🎮"; // Game controller for custom events
    default:
      return "📆"; // Calendar for unknown categories
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
      return "Custom Event";
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

// FIX: Added helper for safer emoji retrieval
function safeGetEmoji(key, client, fallback = "") {
  try {
    return emojiManager.getEmoji(key, client) || fallback;
  } catch (error) {
    logger.warn(`Error getting emoji ${key}:`, error);
    return fallback;
  }
}

// FIX: Added helper for safer role emoji retrieval
function safeGetRoleEmoji(role, client, fallback = "") {
  try {
    return emojiManager.getRoleEmoji(role, client) || fallback;
  } catch (error) {
    logger.warn(`Error getting role emoji ${role}:`, error);
    return fallback;
  }
}

// FIX: Added helper to get embed color
function getEmbedColor(category, gameMode) {
  if (category === "pvp") {
    switch(gameMode) {
      case "2v2": 
        return 0x00AAFF; // Blue
      case "3v3": 
        return 0x9932CC; // Purple
      case "RBGs": 
        return 0xFF5500; // Orange
      default: 
        return 0x0099FF; // Default blue for PvP
    }
  } else if (category === "pve") {
    return 0x2ECC71; // Green for PvE
  } else if (category === "dnd") {
    return 0xD63031; // Red for D&D
  } else {
    return 0xF39C12; // Yellow/Orange for custom events
  }
}

// FIX: Added helper to determine session category
function getSessionCategory(session) {
  // First check if category is already in the metadata
  if (session.meta?.category) {
    return session.meta.category;
  }
  
  // Otherwise infer from game mode
  const gameMode = session.gameMode;
  
  if (["2v2", "3v3", "RBGs"].includes(gameMode)) {
    return "pvp";
  } else if (["Mythic+", "Raid"].includes(gameMode)) {
    return "pve";
  } else if (["One Shot", "Campaign"].includes(gameMode)) {
    return "dnd";
  } else {
    return "custom";
  }
}

// FIX: Added helper to get role requirements
function getRoleRequirements(session, category) {
  // First try to get role requirements from session metadata
  if (session.meta?.roleRequirements) {
    return session.meta.roleRequirements;
  }
  
  // Otherwise use defaults based on category
  switch (category) {
    case "pvp":
      return { tank: 1, healer: 3, dps: 6 };
    case "pve":
      return { tank: 2, healer: 3, dps: 5 };
    case "dnd":
      return { dm: 1, player: 5 };
    case "custom":
      return { participant: session.meta?.groupSize || 10 };
    default:
      return { tank: 1, healer: 3, dps: 6 };
  }
}

module.exports = {
  constructSessionEmbed
};