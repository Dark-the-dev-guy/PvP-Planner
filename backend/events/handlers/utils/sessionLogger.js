// events/handlers/utils/sessionLogger.js
const logger = require('../../../utils/logger');

/**
 * Log a session interaction
 * @param {string} type - Type of interaction (join, late, tentative, etc.)
 * @param {string} userId - Discord user ID
 * @param {string} sessionId - Session ID
 * @param {Object} details - Additional details to log
 */
function logSessionInteraction(type, userId, sessionId, details = {}) {
  const logMessage = `Session ${type}: User ${userId} in session ${sessionId}`;
  
  // Add any additional details to log
  if (Object.keys(details).length > 0) {
    logger.info(logMessage, details);
  } else {
    logger.info(logMessage);
  }
}

/**
 * Log a successful status update
 * @param {string} userId - Discord user ID
 * @param {string} sessionId - Session ID
 * @param {string} status - New status (attending, late, etc.)
 * @param {Object} details - Additional details
 */
function logStatusUpdate(userId, sessionId, status, details = {}) {
  logSessionInteraction('status_update', userId, sessionId, {
    status,
    ...details
  });
}

/**
 * Log a successful role update
 * @param {string} userId - Discord user ID
 * @param {string} sessionId - Session ID
 * @param {string} role - New role
 */
function logRoleUpdate(userId, sessionId, role) {
  logSessionInteraction('role_update', userId, sessionId, { role });
}

/**
 * Log a successful class update
 * @param {string} userId - Discord user ID
 * @param {string} sessionId - Session ID
 * @param {string} wowClass - New class
 */
function logClassUpdate(userId, sessionId, wowClass) {
  logSessionInteraction('class_update', userId, sessionId, { wowClass });
}

/**
 * Log a successful spec update
 * @param {string} userId - Discord user ID
 * @param {string} sessionId - Session ID
 * @param {string} wowSpec - New spec
 */
function logSpecUpdate(userId, sessionId, wowSpec) {
  logSessionInteraction('spec_update', userId, sessionId, { wowSpec });
}

/**
 * Log a complete signup
 * @param {string} userId - Discord user ID
 * @param {string} sessionId - Session ID
 * @param {string} status - Status (attending, late, etc.)
 * @param {string} role - Role
 * @param {string} wowClass - WoW class (if applicable)
 * @param {string} wowSpec - WoW spec (if applicable)
 */
function logCompleteSignup(userId, sessionId, status, role, wowClass = null, wowSpec = null) {
  logSessionInteraction('complete_signup', userId, sessionId, {
    status,
    role,
    wowClass,
    wowSpec
  });
}

/**
 * Log a session display update
 * @param {string} sessionId - Session ID
 * @param {string} channelId - Channel ID where display was updated
 * @param {boolean} isNew - Whether this was a new message or update
 */
function logDisplayUpdate(sessionId, channelId, isNew = false) {
  logSessionInteraction('display_update', 'system', sessionId, {
    channelId,
    isNew: isNew ? 'new message' : 'updated existing'
  });
}

/**
 * Log a successful display update
 * @param {string} sessionId - Session ID
 */
function logDisplaySuccess(sessionId) {
  logger.info(`Session display updated successfully for ${sessionId}`);
}

/**
 * Log when scheduled display update fails
 * @param {string} sessionId - Session ID
 * @param {Error} error - Error object
 */
function logDisplayError(sessionId, error) {
  logger.error(`Error updating session display for ${sessionId}:`, error);
}

/**
 * Log when a specific session action is taken
 * @param {string} action - The action taken (join, late, etc.)
 * @param {string} userId - Discord user ID
 * @param {string} sessionId - Session ID
 */
function logSessionAction(action, userId, sessionId) {
  logger.info(`${action} action for user ${userId} in session ${sessionId}`);
}

module.exports = {
  logSessionInteraction,
  logStatusUpdate,
  logRoleUpdate,
  logClassUpdate,
  logSpecUpdate,
  logCompleteSignup,
  logDisplayUpdate,
  logDisplaySuccess,
  logDisplayError,
  logSessionAction
};