// events/handlers/statusHandlers/index.js

// Import all status handlers
const handleJoin = require('./joinHandler');
const handleLate = require('./lateHandler');
const handleTentative = require('./tentativeHandler');
const handleBackup = require('./backupHandler');
const handleCantMakeIt = require('./cantMakeItHandler');
const handleNoChanges = require('./noChangesHandler');

// Export all handlers from a single entry point
module.exports = {
  handleJoin,
  handleLate,
  handleTentative,
  handleBackup,
  handleCantMakeIt,
  handleNoChanges
};