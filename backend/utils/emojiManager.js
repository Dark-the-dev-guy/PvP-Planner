// utils/emojiManager.js

// Emoji configurations
const emojiConfig = {
  // Status emojis
  ready: { name: "Letsgo", id: "1240384278060208188", fallback: "🎮" },
  late: { name: "wow_late", fallback: "⏰" },
  cantmake: { name: "CantMakeIt", id: "1240385285432569948", fallback: "👎" },
  notes: { name: "wow_notes", fallback: "📝" },
  roster: { name: "wow_roster", fallback: "👥" },
  
  // Role emojis
  tank: { name: "wow_tank", fallback: "🛡️" },
  healer: { name: "wow_heal", fallback: "💚" },
  dps: { name: "wow_dps", fallback: "⚔️" },
  
  // WoW class emojis
  classes: {
    warrior: { name: "classicon_warrior", fallback: "🗡️", specs: {
      arms: { name: "specicon_arms", fallback: "🗡️" },
      fury: { name: "specicon_fury", fallback: "⚔️" },
      protection: { name: "specicon_protwarrior", fallback: "🛡️" }
    }},
    paladin: { name: "classicon_paladin", fallback: "🔨", specs: {
      holy: { name: "specicon_holypaladin", fallback: "✨" },
      protection: { name: "specicon_protpaladin", fallback: "🛡️" },
      retribution: { name: "specicon_ret", fallback: "🔨" }
    }},
    hunter: { name: "classicon_hunter", fallback: "🏹", specs: {
      beastmastery: { name: "specicon_bm", fallback: "🐺" },
      marksmanship: { name: "specicon_mm", fallback: "🏹" },
      survival: { name: "specicon_survival", fallback: "🪓" }
    }},
    rogue: { name: "classicon_rogue", fallback: "🗡️", specs: {
      assassination: { name: "specicon_assassination", fallback: "🔪" },
      outlaw: { name: "specicon_outlaw", fallback: "🏴‍☠️" },
      subtlety: { name: "specicon_subtlety", fallback: "👤" }
    }},
    priest: { name: "classicon_priest", fallback: "✨", specs: {
      discipline: { name: "specicon_disc", fallback: "🛡️" },
      holy: { name: "specicon_holypriest", fallback: "✨" },
      shadow: { name: "specicon_shadow", fallback: "🌑" }
    }},
    shaman: { name: "classicon_shaman", fallback: "⚡", specs: {
      elemental: { name: "specicon_elemental", fallback: "🔥" },
      enhancement: { name: "specicon_enhancement", fallback: "⚡" },
      restoration: { name: "specicon_restoshaman", fallback: "💧" }
    }},
    mage: { name: "classicon_mage", fallback: "🔮", specs: {
      arcane: { name: "specicon_arcane", fallback: "🔮" },
      fire: { name: "specicon_fire", fallback: "🔥" },
      frost: { name: "specicon_frostmage", fallback: "❄️" }
    }},
    warlock: { name: "classicon_warlock", fallback: "🔥", specs: {
      affliction: { name: "specicon_affliction", fallback: "☠️" },
      demonology: { name: "specicon_demonology", fallback: "👹" },
      destruction: { name: "specicon_destruction", fallback: "🔥" }
    }},
    druid: { name: "classicon_druid", fallback: "🍃", specs: {
      balance: { name: "specicon_balance", fallback: "🌙" },
      feral: { name: "specicon_feral", fallback: "🐱" },
      guardian: { name: "specicon_guardian", fallback: "🐻" },
      restoration: { name: "specicon_restodruid", fallback: "🌿" }
    }},
    deathknight: { name: "classicon_deathknight", fallback: "❄️", specs: {
      blood: { name: "specicon_blood", fallback: "🩸" },
      frost: { name: "specicon_frostdk", fallback: "❄️" },
      unholy: { name: "specicon_unholy", fallback: "☠️" }
    }},
    monk: { name: "classicon_monk", fallback: "👊", specs: {
      brewmaster: { name: "specicon_brewmaster", fallback: "🍺" },
      mistweaver: { name: "specicon_mistweaver", fallback: "🌫️" },
      windwalker: { name: "specicon_windwalker", fallback: "👊" }
    }},
    demonhunter: { name: "classicon_demonhunter", fallback: "👁️", specs: {
      havoc: { name: "specicon_havoc", fallback: "⚔️" },
      vengeance: { name: "specicon_vengeance", fallback: "🛡️" }
    }},
    evoker: { name: "classicon_evoker", fallback: "🐉", specs: {
      devastation: { name: "specicon_devastation", fallback: "🔥" },
      preservation: { name: "specicon_preservation", fallback: "✨" },
      augmentation: { name: "specicon_augmentation", fallback: "⚡" }
    }}
  }
};

/**
 * Check if we have custom emojis configured
 * @returns {boolean} - Whether custom emojis are available
 */
function hasCustomEmojis() {
  return true;
}

/**
 * Get an emoji by key
 * @param {string} key - Emoji key
 * @param {Client} client - Discord client for resolving emoji
 * @returns {string} - Emoji as a string or ID
 */
function getEmoji(key, client) {
  const emoji = emojiConfig[key];
  if (!emoji) return null;
  
  if (client) {
    try {
      // Find the emoji by name in the client's cache
      const resolvedEmoji = client.emojis.cache.find(e => e.name === emoji.name);
      if (resolvedEmoji) return `<:${resolvedEmoji.name}:${resolvedEmoji.id}>`;
    } catch (error) {
      console.error(`Error resolving emoji ${key}:`, error);
    }
  }
  
  return emoji.fallback;
}

/**
 * Get role emoji
 * @param {string} role - Role name
 * @param {Client} client - Discord client for resolving emoji
 * @returns {string} - Role emoji
 */
function getRoleEmoji(role, client) {
  if (!role) return "❓";
  
  const roleKey = role.toLowerCase();
  return getEmoji(roleKey, client) || {
    "tank": "🛡️",
    "healer": "💚",
    "dps": "⚔️"
  }[roleKey] || "❓";
}

/**
 * Get class emoji
 * @param {string} className - WoW class name
 * @param {Client} client - Discord client for resolving emoji
 * @returns {string} - Class emoji
 */
function getClassEmoji(className, client) {
  if (!className) return "";
  
  const classKey = className.toLowerCase().replace(/\s+/g, '');
  const classConfig = emojiConfig.classes[classKey];
  
  if (!classConfig) return "";
  
  if (client) {
    try {
      // Find the emoji by name in the client's cache
      const resolvedEmoji = client.emojis.cache.find(e => e.name === classConfig.name);
      if (resolvedEmoji) return `<:${resolvedEmoji.name}:${resolvedEmoji.id}>`;
    } catch (error) {
      console.error(`Error resolving class emoji ${classKey}:`, error);
    }
  }
  
  return classConfig.fallback;
}

/**
 * Get spec emoji
 * @param {string} className - WoW class name
 * @param {string} specName - WoW spec name
 * @param {Client} client - Discord client for resolving emoji
 * @returns {string} - Spec emoji
 */
function getSpecEmoji(className, specName, client) {
  if (!className || !specName) return "";
  
  const classKey = className.toLowerCase().replace(/\s+/g, '');
  const specKey = specName.toLowerCase().replace(/\s+/g, '');
  
  const classConfig = emojiConfig.classes[classKey];
  if (!classConfig || !classConfig.specs || !classConfig.specs[specKey]) return "";
  
  const specConfig = classConfig.specs[specKey];
  
  if (client) {
    try {
      // Find the emoji by name in the client's cache
      const resolvedEmoji = client.emojis.cache.find(e => e.name === specConfig.name);
      if (resolvedEmoji) return `<:${resolvedEmoji.name}:${resolvedEmoji.id}>`;
    } catch (error) {
      console.error(`Error resolving spec emoji ${specKey}:`, error);
    }
  }
  
  return specConfig.fallback;
}

/**
 * Get all WoW classes
 * @returns {string[]} - Array of class names
 */
function getWowClasses() {
  return Object.keys(emojiConfig.classes);
}

/**
 * Get specs for a specific class
 * @param {string} className - WoW class name
 * @returns {string[]} - Array of spec names for the class
 */
function getClassSpecs(className) {
  if (!className) return [];
  
  const classKey = className.toLowerCase().replace(/\s+/g, '');
  const classConfig = emojiConfig.classes[classKey];
  
  if (!classConfig || !classConfig.specs) return [];
  
  return Object.keys(classConfig.specs);
}

/**
 * Get role for a spec
 * @param {string} className - WoW class name
 * @param {string} specName - WoW spec name
 * @returns {string} - Role (tank, healer, dps) for the spec
 */
function getSpecRole(className, specName) {
  if (!className || !specName) return "";
  
  const classKey = className.toLowerCase().replace(/\s+/g, '');
  const specKey = specName.toLowerCase().replace(/\s+/g, '');
  
  // Define role mappings
  const roleMappings = {
    'warrior': {
      'protection': 'tank',
      'arms': 'dps',
      'fury': 'dps'
    },
    'paladin': {
      'protection': 'tank',
      'holy': 'healer',
      'retribution': 'dps'
    },
    'hunter': {
      'beastmastery': 'dps',
      'marksmanship': 'dps',
      'survival': 'dps'
    },
    'rogue': {
      'assassination': 'dps',
      'outlaw': 'dps',
      'subtlety': 'dps'
    },
    'priest': {
      'discipline': 'healer',
      'holy': 'healer',
      'shadow': 'dps'
    },
    'shaman': {
      'elemental': 'dps',
      'enhancement': 'dps',
      'restoration': 'healer'
    },
    'mage': {
      'arcane': 'dps',
      'fire': 'dps',
      'frost': 'dps'
    },
    'warlock': {
      'affliction': 'dps',
      'demonology': 'dps',
      'destruction': 'dps'
    },
    'druid': {
      'balance': 'dps',
      'feral': 'dps',
      'guardian': 'tank',
      'restoration': 'healer'
    },
    'deathknight': {
      'blood': 'tank',
      'frost': 'dps',
      'unholy': 'dps'
    },
    'monk': {
      'brewmaster': 'tank',
      'mistweaver': 'healer',
      'windwalker': 'dps'
    },
    'demonhunter': {
      'havoc': 'dps',
      'vengeance': 'tank'
    },
    'evoker': {
      'devastation': 'dps',
      'preservation': 'healer',
      'augmentation': 'dps'
    }
  };

  if (roleMappings[classKey] && roleMappings[classKey][specKey]) {
    return roleMappings[classKey][specKey];
  }
  
  return "dps"; // Default to DPS if not found
}

module.exports = {
  hasCustomEmojis,
  getEmoji,
  getRoleEmoji,
  getClassEmoji,
  getSpecEmoji,
  getWowClasses,
  getClassSpecs,
  getSpecRole
};