// utils/sessionValidator.js
const logger = require('./logger');

/**
 * Validates and repairs a session object to ensure consistency
 * @param {Object} session - Session object to validate
 * @returns {Object} - Validated and repaired session object
 */
function validateSession(session) {
  if (!session) {
    logger.error('Cannot validate null or undefined session');
    return null;
  }

  // Add basic logging
  logger.info(`Validating session ${session.sessionId} (${session.gameMode})`);
  
  try {
    // Ensure session has meta object
    if (!session.meta) {
      session.meta = {};
      logger.warn(`Session ${session.sessionId} missing meta object - created empty one`);
    }
    
    // Infer and set category if missing
    if (!session.meta.category) {
      session.meta.category = inferCategoryFromGameMode(session.gameMode);
      logger.warn(`Session ${session.sessionId} missing category - inferred ${session.meta.category}`);
    }
    
    // Ensure role requirements exist
    if (!session.meta.roleRequirements) {
      session.meta.roleRequirements = getDefaultRoleRequirements(session.meta.category);
      logger.warn(`Session ${session.sessionId} missing roleRequirements - applied defaults for ${session.meta.category}`);
    }
    
    // Validate all user roles
    if (session.gamers && session.gamers.length > 0) {
      const category = session.meta.category;
      let roleFixCount = 0;
      
      session.gamers.forEach((gamer, index) => {
        // Validate role against category
        if (gamer.role) {
          const isValidRole = validateRoleForCategory(gamer.role, category);
          if (!isValidRole) {
            let originalRole = gamer.role;
            session.gamers[index].role = getDefaultRoleForCategory(category);
            logger.warn(`Fixed invalid role "${originalRole}" for user ${gamer.userId} in ${category} session ${session.sessionId} - set to "${session.gamers[index].role}"`);
            roleFixCount++;
          }
        }
        
        // For non-WoW categories, clear class/spec fields if present
        if (category !== "pvp" && category !== "pve") {
          if (gamer.wowClass || gamer.wowSpec) {
            session.gamers[index].wowClass = "";
            session.gamers[index].wowSpec = "";
            logger.warn(`Cleared WoW class/spec for user ${gamer.userId} in non-WoW session ${session.sessionId}`);
          }
        }
      });
      
      if (roleFixCount > 0) {
        logger.info(`Fixed ${roleFixCount} invalid roles in session ${session.sessionId}`);
      }
    }
    
    // Validate the date
    if (!session.date || isNaN(session.date.getTime())) {
      session.date = new Date();
      logger.warn(`Session ${session.sessionId} has invalid date - reset to current time`);
    }
    
    // Validate game mode
    if (!session.gameMode) {
      session.gameMode = getDefaultGameModeForCategory(session.meta.category);
      logger.warn(`Session ${session.sessionId} missing gameMode - set to ${session.gameMode}`);
    }
    
    // Validate role requirements structure based on category
    const category = session.meta.category;
    const roleReqs = session.meta.roleRequirements;
    
    if (category === "pvp" || category === "pve") {
      // Ensure all WoW roles are present
      if (roleReqs.tank === undefined) roleReqs.tank = category === "pvp" ? 1 : 2;
      if (roleReqs.healer === undefined) roleReqs.healer = 3;
      if (roleReqs.dps === undefined) roleReqs.dps = category === "pvp" ? 6 : 5;
      
      // Remove any non-WoW roles
      delete roleReqs.dm;
      delete roleReqs.player;
      delete roleReqs.participant;
    }
    else if (category === "dnd") {
      // Ensure all D&D roles are present
      if (roleReqs.dm === undefined) roleReqs.dm = 1;
      if (roleReqs.player === undefined) roleReqs.player = 5;
      
      // Remove any WoW roles
      delete roleReqs.tank;
      delete roleReqs.healer;
      delete roleReqs.dps;
      delete roleReqs.participant;
    }
    else if (category === "custom") {
      // Ensure participant role is present
      if (roleReqs.participant === undefined) {
        roleReqs.participant = session.meta.groupSize || 10;
      }
      
      // Remove any other roles
      delete roleReqs.tank;
      delete roleReqs.healer;
      delete roleReqs.dps;
      delete roleReqs.dm;
      delete roleReqs.player;
    }
    
    logger.info(`Session ${session.sessionId} validation complete`);
    return session;
    
  } catch (error) {
    logger.error(`Error validating session ${session?.sessionId || 'unknown'}:`, error);
    return session; // Return original session if validation fails
  }
}

/**
 * Infer session category based on game mode
 * @param {string} gameMode - Game mode
 * @returns {string} - Inferred category
 */
function inferCategoryFromGameMode(gameMode) {
  if (!gameMode) return "pvp"; // Default
  
  if (["2v2", "3v3", "RBGs"].includes(gameMode)) return "pvp";
  if (["Mythic+", "Raid"].includes(gameMode)) return "pve";
  if (["One Shot", "Campaign"].includes(gameMode)) return "dnd";
  return "custom";
}

/**
 * Get default role requirements for a category
 * @param {string} category - Session category
 * @returns {Object} - Default role requirements
 */
function getDefaultRoleRequirements(category) {
  switch (category) {
    case "pvp": 
      return { tank: 1, healer: 3, dps: 6 };
    case "pve": 
      return { tank: 2, healer: 3, dps: 5 };
    case "dnd": 
      return { dm: 1, player: 5 };
    case "custom": 
      return { participant: 10 };
    default: 
      return { tank: 1, healer: 3, dps: 6 };
  }
}

/**
 * Validate if a role is valid for the given category
 * @param {string} role - Role to validate
 * @param {string} category - Session category
 * @returns {boolean} - Whether the role is valid
 */
function validateRoleForCategory(role, category) {
  if (!role) return true; // Empty role is valid (needs selection)
  
  if (category === "pvp" || category === "pve") {
    return ["tank", "healer", "dps"].includes(role);
  } else if (category === "dnd") {
    return ["dm", "player"].includes(role);
  } else if (category === "custom") {
    return ["participant"].includes(role);
  }
  return false;
}

/**
 * Get default role for a category
 * @param {string} category - Session category
 * @returns {string} - Default role
 */
function getDefaultRoleForCategory(category) {
  if (category === "pvp" || category === "pve") {
    return "dps"; // DPS is generally the most available role
  } else if (category === "dnd") {
    return "player"; // Most people will be players, not DMs
  } else if (category === "custom") {
    return "participant";
  }
  return "";
}

/**
 * Get default game mode for a category
 * @param {string} category - Session category
 * @returns {string} - Default game mode
 */
function getDefaultGameModeForCategory(category) {
  switch (category) {
    case "pvp": return "RBGs";
    case "pve": return "Mythic+";
    case "dnd": return "Campaign";
    case "custom": return "Event";
    default: return "RBGs";
  }
}

/**
 * Apply validation to a session before saving
 * @param {Object} session - Session to validate
 * @returns {Promise<Object>} - Validated session
 */
async function validateAndSaveSession(session) {
  const validatedSession = validateSession(session);
  await validatedSession.save();
  return validatedSession;
}

module.exports = {
  validateSession,
  validateAndSaveSession,
  inferCategoryFromGameMode,
  getDefaultRoleRequirements,
  validateRoleForCategory
};