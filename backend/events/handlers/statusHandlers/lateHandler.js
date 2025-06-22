// events/handlers/statusHandlers/lateHandler.js
const Session = require('../../../models/Session');
const {
  formatLateMessage,
  formatRoleForDisplay,
  handleInteractionError,
  handleSessionNotFound,
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
 * Handle "I'll be Late" button click
 * @param {Object} interaction - Discord interaction
 * @param {Object} session - Session object
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @returns {Promise<void>}
 */
async function handleLate(interaction, session, userId, username) {
  try {
    // Defer the reply to prevent timeout
    await interaction.deferUpdate({ flags: 64 });
    
    // If session doesn't exist, handle the error
    if (!session) {
      return await handleSessionNotFound(interaction, "unknown", true);
    }
    
    // Get session category (default to pvp for backward compatibility)
    const category = session.meta?.category || "pvp";
    
    // Validate category if missing or potentially incorrect
    if (!session.meta?.category) {
      if (["One Shot", "Campaign"].includes(session.gameMode)) {
        category = "dnd";
        logger.info(`Inferred DnD category for ${session.sessionId} based on game mode ${session.gameMode}`);
      } else if (["Mythic+", "Raid"].includes(session.gameMode)) {
        category = "pve";
      }
    }
    
    const existingGamer = session.gamers.find((gamer) => gamer.userId === userId);
    
    // Determine character type (main or alt) from session metadata
    const charType = session.meta && session.meta.rbgTier ? session.meta.rbgTier : 'main';

    // Store the original message ID for reference in the ephemeral panel
    const messageId = interaction.message.id;

    if (existingGamer) {
      if (existingGamer.status === "late") {
        // Create user control panel for existing user
        const controlPanel = createUserControlPanel(session.sessionId, userId, session, messageId);

        // Return ephemeral message that references the original message
        return interaction.editReply({
          ...controlPanel,
          ephemeral: true
        });
      } else {
        existingGamer.status = "late";
        existingGamer.reason = ""; // Clear any previous reasons
        
        // Validate role compatibility with category
        if (category === "pvp" || category === "pve") {
          if (!["tank", "healer", "dps", ""].includes(existingGamer.role)) {
            logger.info(`Resetting incompatible role ${existingGamer.role} for user ${userId} in ${category} session`);
            existingGamer.role = "";
          }
        } else if (category === "dnd") {
          if (!["dm", "player", ""].includes(existingGamer.role)) {
            logger.info(`Resetting incompatible role ${existingGamer.role} for user ${userId} in ${category} session`);
            existingGamer.role = "";
          }
        } else if (category === "custom") {
          if (existingGamer.role !== "participant" && existingGamer.role !== "") {
            logger.info(`Setting role to participant for user ${userId} in custom session`);
            existingGamer.role = "participant";
          }
        }
        
        // Try to apply preferences if we don't have role/class/spec
        const needsRole = !existingGamer.role;
        const needsClass = (category === "pvp" || category === "pve") && !existingGamer.wowClass;
        const needsSpec = (category === "pvp" || category === "pve") && !existingGamer.wowSpec;
        
        if (needsRole || needsClass || needsSpec) {
          try {
            const userPrefs = await getUserPreferences(userId, session.guildId);
            const prefs = userPrefs.getPreferences(charType);
            
            // Apply preferences if they exist and are appropriate for this category
            if (needsRole && prefs.role) {
              if (category === "pvp" || category === "pve") {
                if (["tank", "healer", "dps"].includes(prefs.role)) {
                  existingGamer.role = prefs.role;
                  logger.info(`Applied saved role ${prefs.role} for user ${userId} in ${category} session`);
                }
              } else if (category === "dnd") {
                if (["dm", "player"].includes(prefs.role)) {
                  existingGamer.role = prefs.role;
                  logger.info(`Applied saved role ${prefs.role} for user ${userId} in ${category} session`);
                }
              } else if (category === "custom") {
                existingGamer.role = "participant";
              }
            }
            
            // Only apply class/spec for WoW categories
            if ((category === "pvp" || category === "pve")) {
              if (needsClass && prefs.wowClass) existingGamer.wowClass = prefs.wowClass;
              if (needsSpec && prefs.wowSpec) existingGamer.wowSpec = prefs.wowSpec;
            }
          } catch (error) {
            logger.error(`Error fetching user preferences for ${userId}:`, error);
            // Continue without preferences if there's an error
          }
        }
        
        // Save session before updating display
        await session.save();
        logStatusUpdate(userId, session.sessionId, 'late', {
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
        
        // Check if user has needed info based on category
        const hasNeededInfo = existingGamer.role && 
                            ((category === "pvp" || category === "pve") ? 
                            (existingGamer.wowClass && existingGamer.wowSpec) : 
                            true);
                            
        if (hasNeededInfo) {
          // Send ephemeral control panel
          return interaction.editReply({
            ...controlPanel,
            ephemeral: true
          });
        } else {
          // No role, ask for one
          await interaction.editReply({
            content: `✅ You're marked as running late with your ${charType} character. Select your role:`,
            components: [], // Will be added by sendRoleSelection
            ephemeral: true
          });
          // Import dynamically to avoid circular dependencies
          const { sendRoleSelection } = require('../selectionHandlers');
          await sendRoleSelection(interaction, session.sessionId, userId, category, false);
        }
      }
    } else {
      // New player - check for preferences
      let hasPreferences = false;
      let role = "";
      let wowClass = "";
      let wowSpec = "";
      
      try {
        const userPrefs = await getUserPreferences(userId, session.guildId);
        const prefs = userPrefs.getPreferences(charType);
        
        // Apply preferences if they exist and are appropriate
        if (category === "pvp" || category === "pve") {
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
          if (prefs.role && ["dm", "player"].includes(prefs.role)) {
            role = prefs.role;
            hasPreferences = true;
          }
        } else if (category === "custom") {
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
        status: "late",
        role: role,
        wowClass: wowClass,
        wowSpec: wowSpec,
        reason: "",
      });
      
      // Save session before updating display
      await session.save();
      logStatusUpdate(userId, session.sessionId, 'late', {
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
      
      // If we have complete preferences
      const hasCompletePrefs = role && 
                             ((category === "pvp" || category === "pve") ? 
                              (wowClass && wowSpec) : 
                              true);
      
      if (hasPreferences && hasCompletePrefs) {
        // Send ephemeral control panel
        return interaction.editReply({
          ...controlPanel,
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: `✅ You're marked as running late with your ${charType} character. Select your role:`,
          components: [], // Will be added by sendRoleSelection
          ephemeral: true
        });
        // Import dynamically to avoid circular dependencies
        const { sendRoleSelection } = require('../selectionHandlers');
        await sendRoleSelection(interaction, session.sessionId, userId, category, false);
      }
    }
  } catch (error) {
    return handleInteractionError(interaction, error, 'generic', true);
  }
}

module.exports = handleLate;