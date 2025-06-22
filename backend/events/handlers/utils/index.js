// events/handlers/utils/index.js

// Import formatter utilities
const {
  formatRoleForDisplay,
  formatCategoryName,
  formatSpecName,
  formatPlayerForEmbed,
  formatTimestamp,
  formatJoinSuccessMessage,
  formatLateMessage,
  formatTentativeMessage,
  formatBackupMessage,
  formatCantMakeItMessage,
  formatErrorMessage,
  getAlreadyAttendingMessage,
  formatRoleSelectionMessage,
  formatCompleteSelectionMessage,
  formatSpecSelectionPrompt
} = require('./formatterUtils');

// Import preference utilities
const {
  getUserPreferences,
  getCharacterPreferences,
  updateCharacterPreferences,
  applyPreferencesToGamer,
  hasCompletePreferences
} = require('./preferenceUtils');

// Import session logging utilities
const {
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
} = require('./sessionLogger');

// Import error handling utilities
const {
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  handleRoleFull,
  handleWrongButtonOwner,
  validateButtonOwner
} = require('./errorHandlers');

// Export everything with explicit naming
module.exports = {
  // Formatter utilities
  formatRoleForDisplay,
  formatCategoryName,
  formatSpecName,
  formatPlayerForEmbed,
  formatTimestamp,
  formatJoinSuccessMessage,
  formatLateMessage,
  formatTentativeMessage,
  formatBackupMessage,
  formatCantMakeItMessage,
  formatErrorMessage,
  getAlreadyAttendingMessage,
  formatRoleSelectionMessage,
  formatCompleteSelectionMessage,
  formatSpecSelectionPrompt,
  
  // Preference utilities
  getUserPreferences,
  getCharacterPreferences,
  updateCharacterPreferences,
  applyPreferencesToGamer,
  hasCompletePreferences,
  
  // Session logging utilities
  logSessionInteraction,
  logStatusUpdate,
  logRoleUpdate,
  logClassUpdate,
  logSpecUpdate,
  logCompleteSignup,
  logDisplayUpdate,
  logDisplaySuccess,
  logDisplayError,
  logSessionAction,
  
  // Error handling utilities
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  handleRoleFull,
  handleWrongButtonOwner,
  validateButtonOwner
};