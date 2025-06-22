// events/handlers/components/userControlPanel.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const logger = require('../../../utils/logger');

/**
 * Creates an ephemeral control panel for user session management
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user's ID
 * @param {Object} session - The session object
 * @param {string} messageId - The ID of the original session message
 * @returns {Object} - Object containing components and content for the ephemeral panel
 */
function createUserControlPanel(sessionId, userId, session, messageId = null) {
  try {
    // Get category from session
    const category = session.meta?.category || "pvp";
    
    // Get the user's current status in the session
    const gamer = session.gamers.find(g => g.userId === userId);
    const status = gamer ? gamer.status : null;
    
    // Create control panel buttons row
    const controlRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`control_role_${sessionId}_${userId}_${messageId || '0'}`)
          .setLabel("Update Role")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🔄"),
        new ButtonBuilder()
          .setCustomId(`control_status_${sessionId}_${userId}_${messageId || '0'}`)
          .setLabel("Update Signup")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("📝")
      );
    
    // Create status indicator row
    const statusRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`control_info_${sessionId}`)
          .setLabel(getStatusDisplay(status))
          .setStyle(getStatusStyle(status))
          .setDisabled(true) // This is just an indicator, not a functional button
      );
    
    // Create content for the ephemeral message
    let content = `### Your signup for this event\n`;
    
    if (gamer) {
      // Add details about current role/class/spec if available
      if (gamer.role) {
        content += `**Role:** ${formatRoleForDisplay(gamer.role, category)}\n`;
      }
      
      if ((category === "pvp" || category === "pve") && gamer.wowClass) {
        content += `**Class:** ${gamer.wowClass.charAt(0).toUpperCase() + gamer.wowClass.slice(1)}\n`;
        
        if (gamer.wowSpec) {
          content += `**Spec:** ${formatSpecName(gamer.wowSpec)}\n`;
        }
      }
    }
    
    content += `\nUse the buttons below to update your signup information.`;
    
    return {
      content,
      components: [controlRow, statusRow]
    };
  } catch (error) {
    logger.error(`Error creating user control panel: ${error.message}`, error);
    return {
      content: "Error creating control panel. Please try interacting with the main event message.",
      components: []
    };
  }
}

/**
 * Get a formatted display of the user's status
 * @param {string} status - The user's status in the session
 * @returns {string} - Formatted status display
 */
function getStatusDisplay(status) {
  switch(status) {
    case "attending":
      return "✅ Attending";
    case "late":
      return "⏰ Running Late";
    case "tentative":
      return "🤔 Tentative";
    case "backup":
      return "🔄 Backup";
    case "not attending":
      return "❌ Not Attending";
    default:
      return "Not Signed Up";
  }
}

/**
 * Get a button style based on status
 * @param {string} status - The user's status in the session
 * @returns {ButtonStyle} - Button style for the status
 */
function getStatusStyle(status) {
  switch(status) {
    case "attending":
      return ButtonStyle.Success;
    case "late":
    case "tentative":
    case "backup":
      return ButtonStyle.Primary;
    case "not attending":
      return ButtonStyle.Danger;
    default:
      return ButtonStyle.Secondary;
  }
}

/**
 * Format a role name for display
 * @param {string} role - The role name
 * @param {string} category - The session category
 * @returns {string} - Formatted role name
 */
function formatRoleForDisplay(role, category) {
  if (!role) return "Unknown";
  
  if (category === "pvp" || category === "pve") {
    return role.toUpperCase();
  } else if (category === "dnd") {
    return role === "dm" ? "Dungeon Master" : "Player";
  } else {
    return role === "participant" ? "Participant" : role.charAt(0).toUpperCase() + role.slice(1);
  }
}

/**
 * Format a spec name for display
 * @param {string} specName - The spec name
 * @returns {string} - Formatted spec name
 */
function formatSpecName(specName) {
  if (!specName) return "Unknown";
  
  return specName
    .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim();
}

module.exports = {
  createUserControlPanel
};