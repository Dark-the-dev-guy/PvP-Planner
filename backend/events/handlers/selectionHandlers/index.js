// events/handlers/selectionHandlers/index.js

// Import role selection handlers
const {
  sendRoleSelection,
  handleRoleSelection
} = require('./roleSelection');

// Import class selection handlers
const {
  sendClassSelection,
  handleClassSelection
} = require('./classSelection');

// Import spec selection handlers
const {
  sendSpecSelection,
  sendRoleFilteredSpecSelection,
  handleSpecSelection
} = require('./specSelection');

// Import update selection handler
const handleUpdateSelection = require('./updateSelection');

// Export all selection handlers with explicit naming
module.exports = {
  // Role selection
  sendRoleSelection,
  handleRoleSelection,

  // Class selection
  sendClassSelection,
  handleClassSelection,

  // Spec selection
  sendSpecSelection,
  sendRoleFilteredSpecSelection,
  handleSpecSelection,

  // Update selection
  handleUpdateSelection
};