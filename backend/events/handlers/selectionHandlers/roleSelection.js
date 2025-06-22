// events/handlers/selectionHandlers/roleSelection.js
const Session = require('../../../models/Session');
const {
  formatRoleForDisplay,
  formatRoleSelectionMessage,
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  handleRoleFull,
  logRoleUpdate,
  updateCharacterPreferences
} = require('../utils');
const { createRoleButtons } = require('../components/buttons');
const { updateSessionDisplay } = require("../../../utils/sessionDisplayService");
const logger = require('../../../utils/logger');
const emojiManager = require('../../../utils/emojiManager');

/**
 * Send role selection buttons to a user
 * @param {Object} interaction - Discord interaction
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} category - Session category
 * @param {boolean} followUp - Whether to send as followUp (true) or edit reply (false)
 * @returns {Promise<void>}
 */
async function sendRoleSelection(interaction, sessionId, userId, category, followUp = true) {
  try {
    // Ensure we're using the correct category
    if (!category) {
      // Try to fetch the session to get the category
      const session = await Session.findOne({ sessionId });
      if (session) {
        category = session.meta?.category || "pvp";
      } else {
        category = "pvp"; // Default to pvp if we can't determine
      }
    }
    
    // Log the category we're using
    logger.info(`Sending role selection for category: ${category}`);
    
    // Create role selection buttons based on category
    const row = createRoleButtons(sessionId, userId, category, interaction.client, emojiManager);

    // Send role selection message
    if (followUp) {
      return interaction.followUp({
        components: [row],
        flags: 64  // ephemeral flag
      });
    } else {
      // Just add the components to the existing message
      return interaction.editReply({
        components: [row],
      });
    }
  } catch (error) {
    logger.error(`Error sending role selection: ${error.message}`, error);
    
    // Handle error response
    if (followUp) {
      await interaction.followUp({
        content: "❌ Something went wrong while processing your request. Please try again.",
        flags: 64  // ephemeral flag
      });
    } else {
      await interaction.editReply({
        content: "❌ Something went wrong while processing your request. Please try again.",
        components: []
      });
    }
  }
}

/**
 * Handle role selection button click
 * @param {Object} interaction - Discord interaction
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} role - Selected role
 * @returns {Promise<void>}
 */
async function handleRoleSelection(interaction, sessionId, userId, role) {
  try {
    // Defer the interaction to prevent timeout
    await interaction.deferUpdate();
    
    logger.info(`Processing role selection: ${role} for user ${userId} in session ${sessionId}`);
    
    // Fetch the session
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return handleSessionNotFound(interaction, sessionId, true);
    }

    // Get category from session.meta or default to pvp for backward compatibility
    const category = session.meta?.category || "pvp";
    
    // Validate that the role is appropriate for this category
    let isValidRole = false;
    
    if (category === "pvp" || category === "pve") {
      isValidRole = ["tank", "healer", "dps"].includes(role);
    } else if (category === "dnd") {
      isValidRole = ["dm", "player"].includes(role);
    } else if (category === "custom") {
      isValidRole = role === "participant";
    }
    
    if (!isValidRole) {
      return interaction.editReply({
        content: `❌ The role "${role}" is not valid for this event type. Please select an appropriate role.`,
        components: []
      });
    }
    
    // Find the gamer and update their role
    const gamer = session.gamers.find(g => g.userId === userId);
    
    if (!gamer) {
      return handleUserNotInSession(interaction, sessionId, true);
    }

    // Get role requirements from session metadata
    const roleReqs = session.meta?.roleRequirements || {};

    // For WoW categories, check role slots
    if (category === "pvp" || category === "pve") {
      // Count current players in this role (excluding the current user)
      const roleCount = session.gamers.filter(g => 
        g.status === "attending" && 
        g.role === role && 
        g.userId !== userId
      ).length;
      
      // Get max count for this role from session requirements
      const maxForRole = roleReqs[role] || 
                        (category === "pvp" ? 
                          (role === "tank" ? 1 : role === "healer" ? 3 : 6) : 
                          (role === "tank" ? 2 : role === "healer" ? 3 : 5));
      
      logger.info(`Role requirements for ${role}: ${roleCount}/${maxForRole}`);
      
      // Check if role is full
      if (roleCount >= maxForRole) {
        return handleRoleFull(interaction, role, category, true);
      }
    }
    else if (category === "dnd" && role === "dm") {
      // For D&D, check DM slots from session requirements
      const dmCount = session.gamers.filter(g => 
        g.status === "attending" && 
        g.role === "dm" && 
        g.userId !== userId
      ).length;
      
      // Get max DM count (default 1 if not specified)
      const maxDM = roleReqs.dm || 1;
      
      if (dmCount >= maxDM) {
        return interaction.editReply({
          content: `❌ Sorry, this session already has a Dungeon Master. You can sign up as a Player instead.`,
          components: []
        });
      }
    }

    // Determine character type (main or alt) from session metadata
    const charType = session.meta && session.meta.rbgTier ? session.meta.rbgTier : 'main';

    // Update role
    gamer.role = role;
    
    // If changing to a role that doesn't match the current class/spec, reset those fields
    if (category === "pvp" || category === "pve") {
      // For tank role, check if current class/spec can tank
      if (role === "tank") {
        const tankClasses = ['warrior', 'paladin', 'druid', 'deathknight', 'demonhunter', 'monk'];
        if (!tankClasses.includes(gamer.wowClass)) {
          gamer.wowClass = '';
          gamer.wowSpec = '';
        } else if (gamer.wowClass) {
          // Check if current spec is valid for this role
          const tankSpecs = {
            'warrior': ['protection'],
            'paladin': ['protection'],
            'druid': ['guardian'],
            'deathknight': ['blood'],
            'demonhunter': ['vengeance'],
            'monk': ['brewmaster']
          };
          const validSpecs = tankSpecs[gamer.wowClass] || [];
          if (!validSpecs.includes(gamer.wowSpec)) {
            gamer.wowSpec = '';
          }
        }
      }
      // For healer role, check if current class/spec can heal
      else if (role === "healer") {
        const healerClasses = ['priest', 'paladin', 'druid', 'monk', 'shaman', 'evoker'];
        if (!healerClasses.includes(gamer.wowClass)) {
          gamer.wowClass = '';
          gamer.wowSpec = '';
        } else if (gamer.wowClass) {
          // Check if current spec is valid for this role
          const healerSpecs = {
            'priest': ['discipline', 'holy'],
            'paladin': ['holy'],
            'druid': ['restoration'],
            'monk': ['mistweaver'],
            'shaman': ['restoration'],
            'evoker': ['preservation']
          };
          const validSpecs = healerSpecs[gamer.wowClass] || [];
          if (!validSpecs.includes(gamer.wowSpec)) {
            gamer.wowSpec = '';
          }
        }
      }
    }
    
    // Save session before updating display
    await session.save();
    logRoleUpdate(userId, sessionId, role);
    
    // Store the user's preference for this character type
    try {
      await updateCharacterPreferences(userId, session.guildId, charType, role);
    } catch (prefError) {
      logger.error(`Error saving ${charType} role preference for ${userId}:`, prefError);
      // Continue even if saving preferences fails
    }
    
    // Format role display
    const roleDisplay = formatRoleForDisplay(role, category);
    
    // Use formatter utility for message
    const roleMessage = formatRoleSelectionMessage(charType, role, category);
    
    // ENHANCED: Update session display with better error handling
    logger.info(`Updating session display for ${sessionId} after role selection`);
    try {
      // Fetch a fresh session from the database before updating the display
      const freshSession = await Session.findOne({ sessionId });
      if (!freshSession) {
        logger.error(`Failed to fetch fresh session ${sessionId} after save`);
        // Fall back to the in-memory session if we can't fetch a fresh one
        await updateSessionDisplay(interaction.client, session);
      } else {
        // Use the fresh session for display update
        await updateSessionDisplay(interaction.client, freshSession);
        logger.info(`✅ Session display updated successfully for ${sessionId}`);
      }
    } catch (displayError) {
      logger.error(`❌ Error updating session display for ${sessionId}:`, displayError);
      // Continue with the user interaction even if display update fails
    }
    
    // Update the user's ephemeral message (this should NOT affect the main session display)
    await interaction.editReply({
      content: roleMessage,
      components: [] // Clear components from the ephemeral message - this is fine
    });
    
    // For WoW categories, ask for class selection
    if ((category === "pvp" || category === "pve")) {
      // Import dynamically to avoid circular dependencies
      const { sendClassSelection } = require('./classSelection');
      await sendClassSelection(interaction, sessionId, userId, role, category);
    } else {
      // For non-WoW categories, we're done after role selection
      logger.info(`Role selection complete for non-WoW category ${category} in session ${sessionId}`);
    }
  } catch (error) {
    logger.error(`Error in handleRoleSelection for ${sessionId}:`, error);
    return handleInteractionError(interaction, error, 'generic', true);
  }
}

module.exports = {
  sendRoleSelection,
  handleRoleSelection
};