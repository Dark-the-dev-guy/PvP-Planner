// events/handlers/components/index.js

// Import component files
const buttons = require('./buttons');
const menus = require('./menus');
const userControlPanel = require('./userControlPanel');

// Export all components from a single entry point
module.exports = {
  // Button components
  ...buttons,
  
  // Menu components
  ...menus,
  
  // User control panel components
  ...userControlPanel
};