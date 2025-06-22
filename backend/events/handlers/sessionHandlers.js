// events/handlers/sessionHandlers.js

// Import status handlers
const {
  handleJoin,
  handleLate,
  handleTentative,
  handleBackup,
  handleCantMakeIt,
  handleNoChanges
} = require('./statusHandlers');

// Import selection handlers
const {
  sendRoleSelection,
  handleRoleSelection,
  sendClassSelection,
  handleClassSelection,
  sendSpecSelection,
  sendRoleFilteredSpecSelection,
  handleSpecSelection,
  handleUpdateSelection
} = require('./selectionHandlers');

// Import component creators
const {
  createSessionButtons,
  createRoleButtons,
  createUpdateButtons,
  createClassSelectionMenu,
  createRoleFilteredSpecMenu,
  createSpecSelectionMenu,
  createUserControlPanel
} = require('./components');

// Import utility functions
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
  formatSpecSelectionPrompt,
  getUserPreferences,
  getCharacterPreferences,
  updateCharacterPreferences,
  applyPreferencesToGamer,
  hasCompletePreferences,
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
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  handleRoleFull,
  handleWrongButtonOwner,
  validateButtonOwner
} = require('./utils');

// Export everything with clear naming
module.exports = {
  // Status handlers
  handleJoin,
  handleLate,
  handleTentative,
  handleBackup,
  handleCantMakeIt,
  handleNoChanges,

  // Selection handlers
  sendRoleSelection,
  handleRoleSelection,
  sendClassSelection,
  handleClassSelection,
  sendSpecSelection,
  sendRoleFilteredSpecSelection,
  handleSpecSelection,
  handleUpdateSelection,

  // Component creators
  createSessionButtons,
  createRoleButtons,
  createUpdateButtons,
  createClassSelectionMenu,
  createRoleFilteredSpecMenu,
  createSpecSelectionMenu,
  createUserControlPanel,

  // Utility functions
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
  getUserPreferences,
  getCharacterPreferences,
  updateCharacterPreferences,
  applyPreferencesToGamer,
  hasCompletePreferences,
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
  handleInteractionError,
  handleSessionNotFound,
  handleUserNotInSession,
  handleRoleFull,
  handleWrongButtonOwner,
  validateButtonOwner
};