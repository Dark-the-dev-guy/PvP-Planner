// events/handlers/statusHandlers/joinHandler.js
const Session = require('../../../models/Session');
const {
  formatJoinSuccessMessage,
  formatRoleForDisplay,
  getAlreadyAttendingMessage,
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  logStatusUpdate,
  getUserPreferences,
  applyPreferencesToGamer,
  hasCompletePreferences
} = require('../utils');
const { createUpdateButtons } = require('../components/buttons');
const { createUserControlPanel } = require('../components/userControlPanel');
const { updateSessionDisplay } = require("../../../utils/sessionDisplayService");
const logger = require('../../../utils/logger');

/**
 * Handle "I'm In!" button click
 * @param {Object} interaction - Discord interaction
 * @param {Object} session - Session object
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @returns {Promise<void>}
 */
async function handleJoin(interaction, session, userId, username) {
  try {
    // Defer the reply to prevent timeout
    await interaction.deferUpdate({ flags: 64 });
    
    // If session doesn't exist, handle the error
    if (!session) {
      return await handleSessionNotFound(interaction, "unknown", true);
    }
    
    // Get session category (default to pvp for backward compatibility)
    const category = session.meta?.category || "pvp";
    
    const existingGamer = session.gamers.find((gamer) => gamer.userId === userId);

    // Determine character type (main or alt) from session metadata
    const charType = session.meta && session.meta.rbgTier ? session.meta.rbgTier : 'main';

    // Store the original message ID for reference in the ephemeral panel
    const messageId = interaction.message.id;

    if (existingGamer) {
      if (existingGamer.status === "attending") {
        // Create user control panel for already attending user
        const controlPanel = createUserControlPanel(session.sessionId, userId, session, messageId);

        // Return ephemeral message that references the original message
        return interaction.editReply({
          ...controlPanel,
          ephemeral: true
        });
      } else {
        existingGamer.status = "attending";
        existingGamer.reason = "";
        
        // Reset role if it's not compatible with this event type
        if (category === "pvp" || category === "pve") {
          if (!["tank", "healer", "dps"].includes(existingGamer.role)) {
            existingGamer.role = ""; // Clear incompatible role
          }
        } else if (category === "dnd") {
          if (!["dm", "player"].includes(existingGamer.role)) {
            existingGamer.role = ""; // Clear incompatible role
          }
        } else if (category === "custom") {
          if (existingGamer.role !== "participant") {
            existingGamer.role = "participant"; // Set to participant for custom events
          }
        }
        
        // Get user preferences if they exist for this character type
        try {
          const userPrefs = await getUserPreferences(userId, session.guildId);
          const prefs = userPrefs.getPreferences(charType);
          
          // Apply preferences if they exist and are appropriate for this category
          if (category === "pvp" || category === "pve") {
            // For WoW events, only apply tank/healer/dps roles
            if (prefs.role && ["tank", "healer", "dps"].includes(prefs.role)) {
              existingGamer.role = prefs.role;
            }
            if (prefs.wowClass) existingGamer.wowClass = prefs.wowClass;
            if (prefs.wowSpec) existingGamer.wowSpec = prefs.wowSpec;
          } else if (category === "dnd") {
            // For D&D events, only apply dm/player roles
            if (prefs.role && ["dm", "player"].includes(prefs.role)) {
              existingGamer.role = prefs.role;
            }
          } else {
            // For custom events, set role to participant
            existingGamer.role = "participant";
          }
        } catch (error) {
          logger.error(`Error fetching user preferences for ${userId}:`, error);
          // Continue without preferences if there's an error
        }
        
        // Save session before updating display
        await session.save();
        logStatusUpdate(userId, session.sessionId, 'attending', {
          previousStatus: existingGamer.status,
          role: existingGamer.role,
          wowClass: existingGamer.wowClass,
          wowSpec: existingGamer.wowSpec
        });
        
        // FIX: Fetch a fresh session from the database before updating the display
        const freshSession = await Session.findOne({ sessionId: session.sessionId });
        if (!freshSession) {
          logger.error(`Failed to fetch fresh session ${session.sessionId} after save`);
          // Fall back to the in-memory session if we can't fetch a fresh one
          await updateSessionDisplay(interaction.client, session);
        } else {
          // Use the fresh session for display update
          await updateSessionDisplay(interaction.client, freshSession);
          logger.info(`Session display updated with fresh session data for ${session.sessionId}`);
        }
        
        // Create user control panel 
        const controlPanel = createUserControlPanel(session.sessionId, userId, session, messageId);
        
        // Check if user has complete role info based on category
        let hasCompleteRoleInfo = false;
        
        if (category === "pvp" || category === "pve") {
          hasCompleteRoleInfo = existingGamer.role && existingGamer.wowClass && existingGamer.wowSpec;
        } else if (category === "dnd") {
          hasCompleteRoleInfo = existingGamer.role === "dm" || existingGamer.role === "player";
        } else {
          hasCompleteRoleInfo = existingGamer.role === "participant";
        }
        
        // If we have complete role info, send ephemeral control panel
        if (hasCompleteRoleInfo) {
          return interaction.editReply({
            ...controlPanel,
            ephemeral: true
          });
        }
        
        // Otherwise, ask for role selection but keep a reference to the control panel
        await interaction.editReply({
          content: `✅ You're now attending the session with your ${charType} character. Select your role:`,
          components: [], // Will be added by sendRoleSelection
          ephemeral: true
        });
        
        // Import dynamically to avoid circular dependencies
        const { sendRoleSelection } = require('../selectionHandlers');
        return sendRoleSelection(interaction, session.sessionId, userId, category, false);
      }
    } else {
      // New player joining - check for preferences
      let hasPreferences = false;
      let role = "";
      let wowClass = "";
      let wowSpec = "";
      
      try {
        const userPrefs = await getUserPreferences(userId, session.guildId);
        const prefs = userPrefs.getPreferences(charType);
        
        // Apply preferences if they exist and are appropriate for this category
        if (category === "pvp" || category === "pve") {
          // For WoW events, only apply tank/healer/dps roles
          if (prefs.role && ["tank", "healer", "dps"].includes(prefs.role)) {
            role = prefs.role;
            hasPreferences = true;
          }
          if (prefs.wowClass) {
            wowClass = prefs.wowClass;
            hasPreferences = true;
          }
          if (prefs.wowSpec) {
            wowSpec = prefs.wowSpec;
            hasPreferences = true;
          }
        } else if (category === "dnd") {
          // For D&D events, only apply dm/player roles
          if (prefs.role && ["dm", "player"].includes(prefs.role)) {
            role = prefs.role;
            hasPreferences = true;
          }
        } else {
          // For custom events, set role to participant
          role = "participant";
          hasPreferences = true;
        }
      } catch (error) {
        logger.error(`Error fetching user preferences for ${userId}:`, error);
        // Continue without preferences if there's an error
      }
      
      // Add player to the session
      session.gamers.push({
        userId,
        username,
        status: "attending",
        role: role,
        wowClass: wowClass,
        wowSpec: wowSpec,
        reason: "",
      });
      
      // Save session before updating display
      await session.save();
      logStatusUpdate(userId, session.sessionId, 'attending', {
        isNew: true,
        role: role,
        wowClass: wowClass,
        wowSpec: wowSpec
      });
      
      // FIX: Fetch a fresh session from the database before updating the display
      const freshSession = await Session.findOne({ sessionId: session.sessionId });
      if (!freshSession) {
        logger.error(`Failed to fetch fresh session ${session.sessionId} after save`);
        // Fall back to the in-memory session if we can't fetch a fresh one
        await updateSessionDisplay(interaction.client, session);
      } else {
        // Use the fresh session for display update
        await updateSessionDisplay(interaction.client, freshSession);
        logger.info(`Session display updated with fresh session data for ${session.sessionId}`);
      }
      
      // Create user control panel
      const controlPanel = createUserControlPanel(session.sessionId, userId, session, messageId);
      
      // Check if user has complete role info based on category
      let hasCompleteRoleInfo = false;
      
      if (category === "pvp" || category === "pve") {
        hasCompleteRoleInfo = role && wowClass && wowSpec;
      } else if (category === "dnd") {
        hasCompleteRoleInfo = role === "dm" || role === "player";
      } else {
        hasCompleteRoleInfo = role === "participant";
      }
      
      // If we have complete role info, send ephemeral control panel
      if (hasPreferences && hasCompleteRoleInfo) {
        return interaction.editReply({
          ...controlPanel,
          ephemeral: true
        });
      }
      
      // Single message with role selection
      await interaction.editReply({
        content: `✅ You've joined the session with your ${charType} character! Select your role:`,
        components: [], // Will be added by sendRoleSelection
        ephemeral: true
      });
      
      // Ask for role selection
      // Import dynamically to avoid circular dependencies
      const { sendRoleSelection } = require('../selectionHandlers');
      return sendRoleSelection(interaction, session.sessionId, userId, category, false);
    }
  } catch (error) {
    return handleInteractionError(interaction, error, 'generic', true);
  }
}

module.exports = handleJoin;