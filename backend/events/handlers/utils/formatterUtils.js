// events/handlers/utils/formatterUtils.js
const logger = require('../../../utils/logger');

/**
 * Formats a role name for display based on event category
 * @param {string} role - The role (tank, healer, dps, dm, player, participant)
 * @param {string} category - The event category (pvp, pve, dnd, custom)
 * @returns {string} - Formatted role name for display
 * @example
 * // Returns "TANK"
 * formatRoleForDisplay("tank", "pvp");
 * 
 * // Returns "Dungeon Master"
 * formatRoleForDisplay("dm", "dnd");
 */
function formatRoleForDisplay(role, category) {
  if (!role) return "Unknown Role";
  
  if (category === "pvp" || category === "pve") {
    // Standard WoW roles
    return role.toUpperCase();
  } else if (category === "dnd") {
    // D&D roles
    return role === "dm" ? "Dungeon Master" : "Player";
  } else {
    // Custom event
    return role === "participant" ? "Participant" : role.charAt(0).toUpperCase() + role.slice(1);
  }
}

/**
 * Formats a category name for display
 * @param {string} category - The event category (pvp, pve, dnd, custom)
 * @returns {string} - Formatted category name
 * @example
 * // Returns "PvP"
 * formatCategoryName("pvp");
 */
function formatCategoryName(category) {
  switch(category) {
    case "pvp":
      return "PvP";
    case "pve":
      return "PvE";
    case "dnd":
      return "D&D";
    case "custom":
      return "Custom Event";
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

/**
 * Formats a spec name for display
 * @param {string} specName - The spec name (e.g., "frostmage", "holypriest")
 * @returns {string} - Formatted spec name
 * @example
 * // Returns "Frost"
 * formatSpecName("frost");
 */
function formatSpecName(specName) {
  if (!specName) return "";
  
  // Format the spec name for display
  return specName
    .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim();
}

/**
 * Creates a formatted player string for embedding in session display
 * @param {Object} gamer - Gamer object containing role, class, spec info
 * @param {string} category - Event category
 * @param {Object} client - Discord client for emoji resolution
 * @param {Object} emojiManager - Emoji manager module
 * @returns {string} - Formatted player string with emojis
 */
function formatPlayerForEmbed(gamer, category, client, emojiManager) {
  // Only use class/spec formatting for WoW categories
  if ((category === "pvp" || category === "pve") && gamer.wowClass) {
    let classEmoji = '';
    let specEmoji = '';
    
    classEmoji = emojiManager.getClassEmoji(gamer.wowClass, client);
    
    if (gamer.wowSpec) {
      specEmoji = emojiManager.getSpecEmoji(gamer.wowClass, gamer.wowSpec, client);
    }
    
    // Combine emojis and mention - REMOVED spec name
    let prefix = '';
    if (specEmoji) {
      prefix = `${specEmoji} `;
    } else if (classEmoji) {
      prefix = `${classEmoji} `;
    }
    
    return `• ${prefix}<@${gamer.userId}>`;
  }
  // For D&D or Custom, simpler formatting
  else {
    // Get appropriate emoji based on category and role
    let roleEmoji = "";
    if (category === "dnd") {
      roleEmoji = gamer.role === "dm" ? "🎲" : "🧙";
    } else {
      roleEmoji = "👤";
    }
    
    return `• ${roleEmoji} <@${gamer.userId}>`;
  }
}

/**
 * Formats a timestamp into a readable string
 * @param {Date} date - The date to format
 * @returns {Object} - Formatted date components
 * @example
 * // Returns { dayOfWeek: "Monday", month: 10, day: 15, formattedTime: "8:30 PM" }
 * formatTimestamp(new Date());
 */
function formatTimestamp(date) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = days[date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Format time in 12-hour format with AM/PM
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedTime = `${formattedHours}:${formattedMinutes} ${ampm}`;
  
  return { dayOfWeek, month, day, formattedTime };
}

/**
 * Formats a successful join message with personality
 * @param {string} charType - Character type (main or alt)
 * @param {string} roleDisplay - Formatted role display
 * @param {string} wowClass - WoW class if applicable
 * @param {string} wowSpec - WoW spec if applicable
 * @returns {string} - Formatted join success message
 */
function formatJoinSuccessMessage(charType, roleDisplay, wowClass = null, wowSpec = null) {
  // Base messages
  const baseMessages = [
    `✅ You're now attending the session with your ${charType} character!`,
    `✅ You've joined the session! Ready to wreck face with your ${charType} character.`,
    `✅ Signed up! Try not to embarrass yourself with your ${charType} character.`,
    `✅ You're in! Hope your ${charType} character doesn't get one-shot this time.`
  ];
  
  // Get a random base message
  const baseMessage = baseMessages[Math.floor(Math.random() * baseMessages.length)];
  
  // If no class/spec info, just return with role
  if (!wowClass || !wowSpec) {
    return `${baseMessage} Playing as a ${roleDisplay}.`;
  }
  
  // Format the full message with class/spec
  const formattedSpec = formatSpecName(wowSpec);
  const formattedClass = wowClass.charAt(0).toUpperCase() + wowClass.slice(1);
  
  return `${baseMessage} Playing as a ${formattedSpec} ${formattedClass} ${roleDisplay}.`;
}

/**
 * Formats a late status message with personality
 * @param {string} charType - Character type (main or alt)
 * @param {string} roleDisplay - Formatted role display
 * @param {string} wowClass - WoW class if applicable
 * @param {string} wowSpec - WoW spec if applicable
 * @returns {string} - Formatted late message
 */
function formatLateMessage(charType, roleDisplay, wowClass = null, wowSpec = null) {
  // Base messages
  const baseMessages = [
    `✅ You're marked as running late with your ${charType} character.`,
    `✅ Fashionably late, as usual. Your ${charType} character is noted.`,
    `✅ Great, another tardy ${charType}. We'll try not to wipe before you arrive.`,
    `✅ Late again? Shocking. Your ${charType} character has been added.`
  ];
  
  // Get a random base message
  const baseMessage = baseMessages[Math.floor(Math.random() * baseMessages.length)];
  
  // If no class/spec info, just return with role
  if (!wowClass || !wowSpec) {
    return `${baseMessage} Role: ${roleDisplay}.`;
  }
  
  // Format the full message with class/spec
  const formattedSpec = formatSpecName(wowSpec);
  const formattedClass = wowClass.charAt(0).toUpperCase() + wowClass.slice(1);
  
  return `${baseMessage} Playing as a ${formattedSpec} ${formattedClass} ${roleDisplay}.`;
}

/**
 * Formats a tentative status message with personality
 * @param {string} charType - Character type (main or alt)
 * @param {string} roleDisplay - Formatted role display
 * @param {string} wowClass - WoW class if applicable
 * @param {string} wowSpec - WoW spec if applicable
 * @returns {string} - Formatted tentative message
 */
function formatTentativeMessage(charType, roleDisplay, wowClass = null, wowSpec = null) {
  // Base messages
  const baseMessages = [
    `✅ You're marked as tentative with your ${charType} character.`,
    `✅ Not sure if you can make it? How very committal of you. Your ${charType} character is marked tentative.`,
    `✅ Tentative? I'll put you down as a solid "maybe". Your ${charType} character has been noted.`,
    `✅ Commitment issues noted. Your ${charType} character is marked as tentative.`
  ];
  
  // Get a random base message
  const baseMessage = baseMessages[Math.floor(Math.random() * baseMessages.length)];
  
  // If no class/spec info, just return with role
  if (!wowClass || !wowSpec) {
    return `${baseMessage} Role: ${roleDisplay}.`;
  }
  
  // Format the full message with class/spec
  const formattedSpec = formatSpecName(wowSpec);
  const formattedClass = wowClass.charAt(0).toUpperCase() + wowClass.slice(1);
  
  return `${baseMessage} Playing as a ${formattedSpec} ${formattedClass} ${roleDisplay}.`;
}

/**
 * Formats a backup status message with personality
 * @param {string} charType - Character type (main or alt)
 * @param {string} roleDisplay - Formatted role display
 * @param {string} wowClass - WoW class if applicable
 * @param {string} wowSpec - WoW spec if applicable
 * @returns {string} - Formatted backup message
 */
function formatBackupMessage(charType, roleDisplay, wowClass = null, wowSpec = null) {
  // Base messages
  const baseMessages = [
    `✅ You're signed up as a backup with your ${charType} character.`,
    `✅ Backup squad! Your ${charType} character will warm the bench for now.`,
    `✅ Backup it is. Your ${charType} character will be ready if someone flakes.`,
    `✅ Not good enough for the starting lineup? I get it. Your ${charType} character is on backup.`
  ];
  
  // Get a random base message
  const baseMessage = baseMessages[Math.floor(Math.random() * baseMessages.length)];
  
  // If no class/spec info, just return with role
  if (!wowClass || !wowSpec) {
    return `${baseMessage} Role: ${roleDisplay}.`;
  }
  
  // Format the full message with class/spec
  const formattedSpec = formatSpecName(wowSpec);
  const formattedClass = wowClass.charAt(0).toUpperCase() + wowClass.slice(1);
  
  return `${baseMessage} Playing as a ${formattedSpec} ${formattedClass} ${roleDisplay}.`;
}

/**
 * Formats a can't make it message with personality
 * @returns {string} - Formatted can't make it message
 */
function formatCantMakeItMessage() {
  // Array of sassy responses
  const responses = [
    "✅ You're marked as not attending this session. We all know it's because you suck. See you next time!",
    "✅ Can't make it? More like won't make it. Whatever. You've been marked as not attending.",
    "✅ Noted. Your absence will be barely noticed. You're now marked as not attending.",
    "✅ Another one bites the dust. You're marked as not attending because you suck."
  ];
  
  // Return a random response
  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Formats an error message with personality
 * @param {string} errorType - Type of error (optional)
 * @returns {string} - Formatted error message
 */
function formatErrorMessage(errorType = 'generic') {
  // Define error messages by type
  const errorMessages = {
    generic: [
      "❌ Something went wrong while processing your request. Please try again.",
      "❌ Error encountered. Maybe try clicking the buttons instead of typing?",
      "❌ That didn't work. Did you break something? Try again."
    ],
    session: [
      "❌ Session not found. Did you make it up?",
      "❌ That session doesn't exist. Nice try though."
    ],
    permission: [
      "❌ You're not authorized for this action. Nice try, though.",
      "❌ Permission denied. Did you really think that would work?"
    ],
    role: [
      "❌ Sorry, all slots for this role are full. Try being less popular.",
      "❌ No room for you in that role. Try something else?"
    ]
  };
  
  // Get the relevant error messages
  const relevantMessages = errorMessages[errorType] || errorMessages.generic;
  
  // Return a random error message
  return relevantMessages[Math.floor(Math.random() * relevantMessages.length)];
}

/**
 * Gets a random greeting for a user who's already attending
 * @param {string} role - The user's role
 * @param {string} wowClass - The user's WoW class (if applicable)
 * @param {string} wowSpec - The user's WoW spec (if applicable)
 * @returns {string} - A personalized greeting
 */
function getAlreadyAttendingMessage(role, wowClass = null, wowSpec = null) {
  // Base messages
  const baseMessages = [
    "✅ You are already signed up for this session.",
    "✅ Eager, aren't we? You're already signed up.",
    "✅ Did you forget? You're already in this event."
  ];
  
  // Get a random base message
  const baseMessage = baseMessages[Math.floor(Math.random() * baseMessages.length)];
  
  // If no class/spec info, just return with role
  if (!wowClass || !wowSpec) {
    return `${baseMessage} (Role: ${role})`;
  }
  
  // Format the full message with class/spec
  const formattedSpec = formatSpecName(wowSpec);
  const formattedClass = wowClass.charAt(0).toUpperCase() + wowClass.slice(1);
  
  return `${baseMessage}\n\nCurrent selection:\nRole: ${role}\nClass: ${formattedClass}\nSpec: ${formattedSpec}`;
}

/**
 * Creates an appropriate confirmation message for role selection
 * @param {string} charType - Character type (main or alt)
 * @param {string} role - The selected role
 * @param {string} category - Event category
 * @returns {string} - Formatted role selection message
 */
function formatRoleSelectionMessage(charType, role, category) {
  const roleDisplay = formatRoleForDisplay(role, category);
  
  // Different messages based on role and category
  if (category === "pvp" || category === "pve") {
    if (role === "tank") {
      return `✅ You've signed up as a TANK for your ${charType} character! Good luck with those defensive cooldowns. Now select your class:`;
    } else if (role === "healer") {
      return `✅ You've signed up as a HEALER for your ${charType} character! Try to keep everyone alive this time. Now select your class:`;
    } else {
      return `✅ You've signed up as DPS for your ${charType} character! Try not to stand in fire. Now select your class:`;
    }
  } else if (category === "dnd") {
    if (role === "dm") {
      return `✅ You've signed up as the Dungeon Master for your ${charType} campaign! Try not to TPK the party this time.`;
    } else {
      return `✅ You've signed up as a Player for your ${charType} character! May your dice rolls be ever in your favor.`;
    }
  } else {
    return `✅ You've signed up as a ${roleDisplay} for your ${charType} event! Let's hope you show up on time.`;
  }
}

/**
 * Formats a complete class + spec selection confirmation
 * @param {string} specName - The spec name
 * @param {string} className - The class name
 * @param {string} role - The role
 * @param {string} charType - Character type (main or alt)
 * @returns {string} - Formatted confirmation message
 */
function formatCompleteSelectionMessage(specName, className, role, charType) {
  const formattedSpec = formatSpecName(specName);
  const formattedClass = className.charAt(0).toUpperCase() + className.slice(1);
  
  const messages = [
    `✅ You're all set! You'll be playing as a ${formattedSpec} ${formattedClass} ${role.toUpperCase()} in this session.\n\nI've saved these preferences for your ${charType} character for future sessions.\n\nThe event display has been updated with your information.`,
    `✅ Ready to go! Your ${formattedSpec} ${formattedClass} ${role.toUpperCase()} has been added to the roster.\n\nThese preferences are now saved for your ${charType} character.\n\nThe event display is now updated.`,
    `✅ Locked and loaded! Your ${charType} character is set as a ${formattedSpec} ${formattedClass} ${role.toUpperCase()}.\n\nI'll remember this for next time too.\n\nThe event display now shows your updated information.`
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Formats a role + class selection message to prompt for spec
 * @param {string} className - The selected class
 * @returns {string} - Formatted message prompting for spec selection
 */
function formatSpecSelectionPrompt(className) {
  const formattedClass = className.charAt(0).toUpperCase() + className.slice(1);
  
  const messages = [
    `You selected ${formattedClass}. Now choose your specialization:`,
    `${formattedClass} selected. Pick your spec:`,
    `Ah, a ${formattedClass}. Now which spec will you play?`
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

// Export all formatting utilities
module.exports = {
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
};