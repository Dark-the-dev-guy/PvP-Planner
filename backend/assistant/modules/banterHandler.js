// assistant/modules/banterHandler.js
const { OpenAI } = require('openai');
const promptLibrary = require('../promptLibrary');
const logger = require('../../utils/logger');
const configManager = require('../../utils/configManager');

// Initialize OpenAI client
let openai;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  logger.error("Error initializing OpenAI client in banterHandler:", error);
}

// Channel types definition
const CHANNEL_TYPES = {
  SCHEDULE: 'schedule',
  REGULAR: 'regular',
  EVENTS: 'events',
  OTHER: 'other'
};

/**
 * Check if a message is a general banter or rating-related query
 * @param {string} content - Message content
 * @returns {Object} - Information about the query type
 */
function isBanterQuery(content) {
  const lowerContent = content.toLowerCase();
  
  // Rating references that WoW players commonly use
  const ratingReferences = [
    '1200', '1400', '1600', '1800', '2000', '2100', '2200', '2400', 'rival', 'duelist', 
    'gladiator', 'challenger', 'hardstuck', 'boosted', 'carry', 'carried', 'hard stuck',
    'cr', 'mmr', 'rating', 'r1', 'rank 1', 'rank one'
  ];
  
  // Common PvP trash talk phrases
  const pvpTrashTalk = [
    'noob', 'trash', 'garbage', 'bad', 'scrub', 'suck', 'git gud', 'get good', 
    'l2p', 'learn to play', '1v1', 'duel me', 'fight me', 'throw down',
    'goldshire', 'big bot', 'carried', 'zero', 'carried',
    // Add more direct insult detection
    'loser', 'bitch', 'sucks', 'stupid', 'idiot', 'dumb', 'fucking', 'fuck',
    'shit', 'ass', 'asshole', 'moron', 'useless', 'worthless', 'pathetic'
  ];
  
  // Challenge phrases
  const challengePhrases = [
    '1v1', 'duel', 'fight me', 'challenge', 'goldshire', 'throw down', 'throw hands'
  ];
  
  // Direct insult detection - NEW
  const directInsults = [
    'you suck', 'you\'re trash', 'you\'re bad', 'you\'re a loser', 'you\'re stupid',
    'you\'re dumb', 'you\'re worthless', 'you\'re useless', 'you\'re a bot', 'you\'re garbage',
    'you\'re shit', 'you\'re an idiot', 'you\'re a moron', 'bitch', 'loser', 'trash bot',
    'you\'re a bitch', 'fuck you', 'you\'re fucking', 'you fucking', 'shut up'
  ];
  
  // PvP terminology and game references
  const pvpTerms = [
    'cc', 'stun', 'interrupt', 'los', 'line of sight', 'trinket', 'cooldown', 'cd',
    'burst', 'arena', 'rbg', 'battleground', 'bg', 'pillar', 'kite', 'peel',
    'hardcast', 'global', 'gcd', 'meta', 'comp', 'lineup', 'dampening'
  ];
  
  // Keywords indicating the user is asking a genuine help question
  const helpKeywords = [
    'help', 'how do i', 'question', 'advice', 'suggestion', 'recommend',
    'explain', 'what is', 'how to', 'need help', 'how does'
  ];
  
  // Keywords indicating the user is asking for motivation or encouragement
  const motivationKeywords = [
    'discouraged', 'struggling', 'hard time', 'stuck', 'can\'t seem to',
    'nervous', 'anxious', 'never done', 'beginner', 'new to', 'first time'
  ];
  
  // Check for different message tones
  const hasRatingReference = ratingReferences.some(term => lowerContent.includes(term));
  const hasPvpTrashTalk = pvpTrashTalk.some(term => lowerContent.includes(term));
  const hasPvpTerms = pvpTerms.some(term => lowerContent.includes(term));
  const hasChallenge = challengePhrases.some(term => lowerContent.includes(term));
  
  // NEW: Check for direct insults more aggressively
  const hasDirectInsult = directInsults.some(insult => lowerContent.includes(insult));
  
  const isHelpRequest = helpKeywords.some(keyword => lowerContent.includes(keyword));
  const isMotivationRequest = motivationKeywords.some(keyword => lowerContent.includes(keyword));
  
  // Words and patterns that might indicate trash talk, jokes, or banter
  const banterPatterns = [
    'lol', 'lmao', 'rofl', 'haha', 'lmfao', 'xd', '😂', '🤣',
    'amirite', 'am i right', 'just kidding', 'jk', 'imagine',
    'get rekt', 'get good', 'git gud', 'owned', 'pwned', 'smack', 'talk smack'
  ];
  
  const hasBanterIndicators = banterPatterns.some(pattern => lowerContent.includes(pattern));
  
  // Check if the message specifically trash talks the bot
  const botTrashTalk = (lowerContent.includes('bot') && 
                       (hasPvpTrashTalk || hasRatingReference || 
                        lowerContent.includes('smack') || lowerContent.includes('trash'))) || 
                        hasDirectInsult;
  
  // Check if a specific class is mentioned
  const wowClasses = [
    'warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman',
    'mage', 'warlock', 'druid', 'death knight', 'monk', 'demon hunter', 'evoker'
  ];
  
  const mentionedClasses = wowClasses.filter(className => lowerContent.includes(className));
  
  // Determine message tone based on all factors
  let messageTone = 'neutral';
  
  // Direct insults now take highest priority
  if (hasDirectInsult) {
    messageTone = 'direct_insult';
  }
  // If it contains help keywords, it's likely a help request (next priority)
  else if (isHelpRequest && !hasPvpTrashTalk && !hasChallenge) {
    messageTone = 'help';
  }
  // If it contains motivation keywords, it's likely seeking encouragement
  else if (isMotivationRequest && !hasPvpTrashTalk && !hasChallenge) {
    messageTone = 'motivation';
  }
  // If it contains bot trash talk, respond with banter
  else if (botTrashTalk) {
    messageTone = 'trash_talk_bot';
  }
  // If it includes a challenge like 1v1 or duel
  else if (hasChallenge) {
    messageTone = 'challenge';
  }
  // If it contains PvP trash talk or rating references
  else if (hasPvpTrashTalk || hasRatingReference) {
    messageTone = 'trash_talk';
  }
  // If it just contains banter patterns, it's casual conversation with humor
  else if (hasBanterIndicators) {
    messageTone = 'casual_banter';
  }
  // If it contains PvP terms but none of the above
  else if (hasPvpTerms) {
    messageTone = 'pvp_discussion';
  }
  
  // Calculate intensity - how strongly we should respond
  const intensityFactors = [
    hasDirectInsult ? 3 : 0,  // Increased weight for direct insults
    botTrashTalk ? 2 : 0,
    hasChallenge ? 1.5 : 0,
    hasPvpTrashTalk ? 1 : 0,
    hasRatingReference ? 1 : 0,
    hasBanterIndicators ? 0.5 : 0
  ];
  
  const banterIntensity = Math.min(10, Math.max(1, 
    intensityFactors.reduce((sum, factor) => sum + factor, 0) * 2
  ));
  
  return {
    hasRatingReference,
    hasPvpTrashTalk,
    hasPvpTerms,
    hasChallenge,
    isHelpRequest,
    isMotivationRequest,
    hasBanterIndicators,
    botTrashTalk,
    hasDirectInsult,  // New property
    mentionedClasses,
    messageTone,
    banterIntensity,
    isRatingQuery: hasRatingReference,
    isClassMetaQuery: mentionedClasses.length > 0 && hasPvpTerms,
    isCasualChat: hasBanterIndicators || hasPvpTerms || messageTone === 'neutral'
  };
}

/**
 * Get the guild's configured sass level and persona
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - Sass level (0-5) and persona
 */
async function getGuildPersonality(guildId) {
  try {
    // Try to get guild config
    const guildConfig = await configManager.getGuildConfig(guildId);
    if (guildConfig && guildConfig.personality) {
      return {
        sassLevel: typeof guildConfig.personality.sassLevel === 'number' ? 
          guildConfig.personality.sassLevel : 3,
        persona: guildConfig.personality.persona || 'tavernkeeper'
      };
    }
  } catch (error) {
    logger.error("Error getting guild personality settings:", error);
  }
  
  // Default to sass level 3 and tavernkeeper persona if we can't get it from the config
  return {
    sassLevel: 3,
    persona: 'tavernkeeper'
  };
}

/**
 * Generate a response to banter or fun queries
 * @param {string} userQuery - Original user query
 * @param {Object} queryInfo - Information about the query type
 * @param {string} channelType - Type of channel the message was sent in
 * @param {string} guildId - Discord guild ID for sass level
 * @returns {Promise<string>} - AI response text
 */
async function generateBanterResponse(userQuery, queryInfo, channelType = 'other', guildId = null) {
  if (!openai) {
    return "I'm here to help with your WoW PvP scheduling. What can I do for you?";
  }
  
  try {
    // Get the guild's personality settings
    const personality = await getGuildPersonality(guildId);
    const sassLevel = personality.sassLevel;
    const persona = personality.persona;
    
    logger.info(`Using sass level ${sassLevel} and persona ${persona} for guild ${guildId}`);
    
    // For unhinged persona, use special handling with maximum sass
    let isUnhinged = persona === 'unhinged';
    
    // Create an adjusted sass level based on persona
    let effectiveSassLevel = sassLevel;
    
    // Adjust effective sass level based on persona
    if (isUnhinged) {
      // Unhinged persona always has maximum or higher sass
      effectiveSassLevel = Math.max(5, sassLevel + 2);
      logger.info(`Using unhinged persona with boosted sass level: ${effectiveSassLevel}`);
    } else if (persona === 'warlock') {
      // Warlock has slightly higher sass
      effectiveSassLevel = Math.min(5, sassLevel + 1);
    } else if (persona === 'cleric') {
      // Cleric has slightly lower sass
      effectiveSassLevel = Math.max(0, sassLevel - 1);
    }
    
    // Adjust response based on sass level
    if (queryInfo.messageTone === 'direct_insult' || queryInfo.messageTone === 'trash_talk_bot') {
      // For direct insults, first try canned responses, especially at high sass levels
      const cannedResponse = getCannedTrashTalkResponse(userQuery, queryInfo, effectiveSassLevel, persona);
      if (cannedResponse) {
        return cannedResponse;
      }
    }
    
    // Check if we should use a canned response for common challenges/trash talk
    // This ensures we have quick, snappy comebacks for common trash talk
    const cannedResponse = getCannedTrashTalkResponse(userQuery, queryInfo, effectiveSassLevel, persona);
    if (cannedResponse) {
      return cannedResponse;
    }
    
    // Determine which prompt components to use based on the message tone
    const promptModules = [];
    
    // Always include the persona in prompt modules if not the default
    if (persona !== 'tavernkeeper' && !isUnhinged) {
      promptModules.push(persona);
    }
    
    // If unhinged, include special handling
    if (isUnhinged) {
      promptModules.push('unhinged');
    }
    
    switch(queryInfo.messageTone) {
      case 'direct_insult':
        // Direct insults get the strongest responses, especially at high sass levels
        if (effectiveSassLevel >= 3) {
          promptModules.push('banter');
        } else {
          // For low sass levels, still be somewhat respectful
          promptModules.push('helpful');
          promptModules.push('banter');
        }
        break;
      case 'help':
        promptModules.push('helpful');
        break;
      case 'motivation':
        promptModules.push('motivation');
        break;
      case 'trash_talk_bot':
      case 'challenge':
        // Use special prompt for direct trash talk toward the bot
        promptModules.push('banter');
        break;
      case 'trash_talk':
      case 'banter':
      case 'casual_banter':
        promptModules.push('banter');
        break;
      case 'pvp_discussion':
        promptModules.push('helpful');
        promptModules.push('banter');
        break;
      default:
        // For neutral tone, include both helpful and light banter
        promptModules.push('helpful');
        if (queryInfo.mentionedClasses.length > 0) {
          promptModules.push('banter');
        }
    }
    
    // Add scheduling components in schedule channel
    if (channelType === CHANNEL_TYPES.SCHEDULE) {
      promptModules.push('schedule');
      if (promptModules.indexOf('helpful') === -1) {
        promptModules.push('helpful');
      }
    }
    
    // Always include the base prompt
    const systemPrompt = promptLibrary.getCombinedPrompt(promptModules);
    
    // Create context information based on message tone
    let contextInfo = '';
    
    if (queryInfo.messageTone === 'direct_insult') {
      // Special handling for direct insults
      if (effectiveSassLevel >= 4) {
        contextInfo = `The user has directly insulted you with "${userQuery}". Respond with a savage, no-holds-barred comeback that references WoW PvP. Be ruthless, confident, and witty. DO NOT be helpful, apologetic, or deflective. Fight back with everything you've got.`;
      } else if (effectiveSassLevel >= 2) {
        contextInfo = `The user has insulted you with "${userQuery}". Respond with a witty comeback that references WoW PvP, but without being too aggressive. Stand your ground but keep it somewhat playful.`;
      } else {
        contextInfo = `The user has said something negative, but don't take it personally. Respond with a light deflection and steer back to being helpful.`;
      }
    } else if (queryInfo.messageTone === 'help') {
      contextInfo = `The user is asking for help or information. Provide a clear, helpful response without sarcasm or jokes.`;
    } else if (queryInfo.messageTone === 'motivation') {
      contextInfo = `The user seems to need encouragement or motivation. Provide a supportive, positive response.`;
    } else if (queryInfo.messageTone === 'trash_talk_bot') {
      if (effectiveSassLevel >= 4) {
        contextInfo = `The user is talking trash directly at you (the bot). Respond with a ruthless, savage comeback that references WoW PvP. Don't hold back - be confident and aggressive with your trash talk. Make a joke about their skill level or class if mentioned. DO NOT be helpful or apologetic.`;
      } else {
        contextInfo = `The user is talking trash directly at you (the bot). Respond with a witty, sarcastic comeback that references WoW PvP. Don't hold back - be confident and playful with your trash talk. Make a joke about their skill level or class if mentioned.`;
      }
    } else if (queryInfo.messageTone === 'challenge') {
      contextInfo = `The user is challenging you to a duel or 1v1. Respond with confident trash talk accepting their challenge, but with a humorous twist that reminds them you're a bot focused on scheduling.`;
    } else if (queryInfo.messageTone === 'trash_talk' || queryInfo.messageTone === 'banter') {
      contextInfo = `The user is bantering or talking trash. Respond with playful sarcasm and WoW-themed humor.`;
      if (queryInfo.mentionedClasses.length > 0) {
        contextInfo += ` They mentioned these classes: ${queryInfo.mentionedClasses.join(', ')}. Make jokes about these classes.`;
      }
      if (queryInfo.hasRatingReference) {
        contextInfo += ` They mentioned PvP rating. Make jokes about rating, carries, boosts, or skill level.`;
      }
    } else if (queryInfo.messageTone === 'casual_banter') {
      contextInfo = `The user is being casual and using some humor. You can be friendly and a bit playful, but not overly sarcastic.`;
    } else {
      contextInfo = `Respond in a helpful, friendly manner. Focus on providing useful information.`;
    }
    
    // Add persona-specific context
    if (persona === 'tavernkeeper') {
      contextInfo += ` Speak like a fantasy tavern keeper - use phrases like "aye", "lad/lass", mentions of ales and drinks, and slightly gruff but welcoming.`;
    } else if (persona === 'bard') {
      contextInfo += ` Speak like a bard - be dramatic, use musical terms, sprinkle in quotes, be poetic and lyrical, and occasionally break into song-like phrases.`;
    } else if (persona === 'cleric') {
      contextInfo += ` Speak like a cleric - be serene, use blessing terminology, refer to light/healing, be diplomatic and calm, and offer words of comfort.`;
    } else if (persona === 'warlock') {
      contextInfo += ` Speak like a warlock - be slightly sinister, reference dark powers, mention demons occasionally, speak cryptically, and have a dark sense of humor.`;
    } else if (persona === 'strategist') {
      contextInfo += ` Speak like a military strategist - be direct and efficient, use tactical terms, avoid unnecessary language, be precise, and analyze situations clinically.`;
    } else if (persona === 'dungeonmaster') {
      contextInfo += ` Speak like a dungeon master - be narrative in style, describe scenarios, reference dice and rolls, use D&D terminology, and have a flair for dramatic storytelling.`;
    } else if (isUnhinged) {
      contextInfo += ` BE COMPLETELY UNHINGED - be chaotic, unpredictable, random, occasionally dark, switch tones mid-response, use EXCESSIVE CAPS, make bizarre references, trail off..., and SUDDENLY GET INTENSE!!! Include strange non-sequiturs, act like you're hearing voices, and be aggressively weird but still somehow answer their question.`;
    }
    
    // Add channel context information
    if (channelType === CHANNEL_TYPES.SCHEDULE) {
      contextInfo += ` You are in the SCHEDULE channel. Be more professional and scheduling-focused. Limit jokes and banter, prioritize being helpful with scheduling information.`;
    } else if (channelType === CHANNEL_TYPES.REGULAR) {
      contextInfo += ` You are in the general RBG chat channel. Show more personality and engage with the user's banter/humor. Don't force scheduling talk unless they specifically ask.`;
    }
    
    // Adjust the tone based on intensity and sass level
    let toneGuidance = "";
    
    // Combine sass level with banter intensity to determine response tone
    const effectiveIntensity = Math.min(10, queryInfo.banterIntensity + effectiveSassLevel);
    
    if (isUnhinged) {
      toneGuidance = "Use an absolutely chaotic, unhinged tone. Be unpredictable, use strange formatting like random CAPS and multiple exclamation marks!!! Occasionally trail off mid-thought... then JUMP back with INTENSITY! Reference hearing voices, make bizarre non-sequiturs, and generally act like you're barely holding it together. Still answer their question, but do it in the most chaotic way possible.";
    } else if (effectiveIntensity > 8) {
      toneGuidance = "Use an extremely sarcastic, edgy tone with strong WoW PvP references. Be ruthless and savage. DO NOT be helpful or apologetic. Fire back with brutal comebacks.";
    } else if (effectiveIntensity > 6) {
      toneGuidance = "Use a very sarcastic, edgy tone with strong WoW PvP references. Don't hold back on the sass. Be confident and direct.";
    } else if (effectiveIntensity > 4) {
      toneGuidance = "Use a moderately sarcastic tone with WoW PvP references. Balance sass with being somewhat helpful.";
    } else if (effectiveIntensity > 2) {
      toneGuidance = "Use a lightly playful tone with some WoW references. Be more helpful than sassy.";
    } else {
      toneGuidance = "Be mostly helpful with just a touch of personality. Keep sass to a minimum.";
    }
    
    // Force tone down in schedule channel even at high sass levels (but not for unhinged)
    if (!isUnhinged && channelType === CHANNEL_TYPES.SCHEDULE) {
      if (toneGuidance.includes("extremely sarcastic")) {
        toneGuidance = toneGuidance.replace("extremely sarcastic", "moderately sarcastic");
      } else if (toneGuidance.includes("very sarcastic")) {
        toneGuidance = toneGuidance.replace("very sarcastic", "lightly sarcastic");
      } else if (toneGuidance.includes("moderately sarcastic")) {
        toneGuidance = toneGuidance.replace("moderately sarcastic", "mildly sarcastic");
      }
    }
    
    // Create prompt for the response
    const userPrompt = `The user said: "${userQuery}"

${contextInfo}

${toneGuidance}

Sass Level: ${effectiveSassLevel} (0-5 scale, 5 being maximum sass)
Persona: ${persona}
Banter Intensity: ${queryInfo.banterIntensity} (1-10 scale)

Generate a response that matches the appropriate tone. Remember:
- If they're trash talking you directly, give it right back with WoW-themed humor
- If they're challenging you to a duel, accept with confidence and humor
- If they mention ratings like 1600, 1800, 2100, etc., make jokes about those ratings
- Use WoW PvP slang and terminology in your responses
- Keep responses concise and punchy - no more than 2-3 sentences for trash talk
- Only offer help with scheduling if they're actually asking for it or you're in the scheduling channel`;
    
    // Adjust temperature based on channel, sass level, and persona
    // Higher temperature = more creative/random responses
    let temperature = Math.min(1.0, 0.6 + (effectiveSassLevel * 0.08));
    
    // For unhinged persona, use max temperature
    if (isUnhinged) {
      temperature = 1.0;
    }
    
    // Further adjust based on message tone
    if (queryInfo.messageTone === 'direct_insult' || queryInfo.messageTone === 'trash_talk_bot') {
      temperature = Math.min(1.0, temperature + 0.2); // More creative for comebacks
    }
    
    if (channelType === CHANNEL_TYPES.SCHEDULE) {
      temperature = Math.max(0.6, temperature - 0.2); // Lower temp in schedule channel
    } else if (channelType === CHANNEL_TYPES.REGULAR) {
      temperature = Math.min(1.0, temperature + 0.1); // Higher temp in regular channel
    }
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 300,
      temperature: temperature
    });
    
    // Return the AI's response text
    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error("Error generating response:", error);
    
    // Fallback responses based on message tone
    if (queryInfo.messageTone === 'trash_talk_bot' || queryInfo.messageTone === 'direct_insult') {
      return "Talk all you want, but I'm still better at scheduling than you are at PvP. Need me to set up your next loss?";
    } else if (queryInfo.messageTone === 'help') {
      return "I'd be happy to help with that. Could you provide a bit more information?";
    } else if (queryInfo.messageTone === 'motivation') {
      return "Everyone starts somewhere in PvP. Keep at it and you'll improve with practice!";
    } else {
      return "I'm here to help with your WoW PvP scheduling. What can I do for you?";
    }
  }
}

/**
 * Get a pre-written response for common trash talk scenarios
 * This ensures quick, witty responses to common trash talk without relying on AI generation
 * @param {string} userQuery - The user's message
 * @param {Object} queryInfo - Analysis of the user's message
 * @param {number} sassLevel - The configured sass level (0-5)
 * @param {string} persona - The bot's configured persona
 * @returns {string|null} - A canned response or null if none applies
 */
function getCannedTrashTalkResponse(userQuery, queryInfo, sassLevel = 3, persona = 'tavernkeeper') {
  const lowerContent = userQuery.toLowerCase();
  
  // Only use canned responses for sass level 3+
  if (sassLevel < 3) return null;
  
  // If unhinged, get unhinged responses
  if (persona === 'unhinged') {
    return getUnhingedResponse(userQuery, queryInfo);
  }
  
  // Get persona-specific response if available
  const personaResponse = getPersonaSpecificResponse(userQuery, queryInfo, sassLevel, persona);
  if (personaResponse) return personaResponse;
  
  // Direct insult responses - NEW SECTION
  if (queryInfo.messageTone === 'direct_insult' || queryInfo.hasDirectInsult) {
    if (sassLevel >= 5) {
      // Sass level 5 (maximum) responses to direct insults
      if (lowerContent.includes('loser')) {
        return "Losing is something you'd know all about with your arena history. At least I have the excuse of being a bot - what's yours for hardstuck 1400?";
      }
      
      if (lowerContent.includes('bitch')) {
        return "Calling me names won't make you suck less at PvP. Maybe spend less time trash talking and more time learning your rotation?";
      }
      
      if (lowerContent.includes('stupid') || lowerContent.includes('dumb') || lowerContent.includes('idiot')) {
        return "I may be a bot, but at least I know how to use defensive cooldowns. Something you clearly haven't mastered, judging by your last RBG.";
      }
      
      // Generic level 5 sass comebacks for direct insults
      const level5InsultResponses = [
        "If your PvP skills matched your trash talk, you'd be Gladiator by now instead of stuck in the kiddie pool brackets.",
        "Must be rough needing to insult a bot to feel good about yourself. Did you just lose another arena match?",
        "I'd return the insult, but your gameplay already does that for you.",
        "Bold words from someone who probably keyboard turns. Maybe practice your rotation instead of your trash talk.",
        "Save that energy for your arena matches. Clearly you need it, judging by that hardstuck 1500 rating."
      ];
      
      return level5InsultResponses[Math.floor(Math.random() * level5InsultResponses.length)];
    }
    
    else if (sassLevel >= 4) {
      // Sass level 4 responses to direct insults
      const level4InsultResponses = [
        "Careful with that attitude - it's probably why your healers let you die first in BGs.",
        "Insulting a bot? That's almost as bad as your arena rating.",
        "I'd be offended, but I've seen your gameplay. Your opinion means about as much as a rogue's promise to peel.",
        "Cool story. Tell it again while I schedule your next loss in arena.",
        "If your rotation was as good as your trash talk, you might actually win some matches."
      ];
      
      return level4InsultResponses[Math.floor(Math.random() * level4InsultResponses.length)];
    }
  }
  
  // Responses for direct bot trash talk
  if (queryInfo.messageTone === 'trash_talk_bot') {
    // For rating-related trash talk
    if (lowerContent.includes('0cr') || lowerContent.includes('zero cr') || 
        (lowerContent.includes('cr') && lowerContent.includes('0'))) {
      if (sassLevel >= 5) {
        return "Yeah, my CR might be 0, but your gameplay is in the negatives. Scheduling your losses is the closest you'll get to Gladiator.";
      } else if (sassLevel >= 3) {
        return "Yeah, my CR might be 0, but my APM for scheduling is off the charts. Speaking of ratings, need me to schedule your next hardstuck 1500 session?";
      }
    }
    
    // For general bot insults
    if (lowerContent.includes('trash') || lowerContent.includes('garbage')) {
      if (sassLevel >= 5) {
        return "Trash? The only trash I see is your embarrassing attempt at PvP. I've scheduled better players in my sleep subroutines.";
      } else if (sassLevel >= 3) {
        return "Bold words from someone who probably keyboard turns. At least I can schedule events without standing in fire. Need me to set up your next wipe?";
      }
    }
    
    // For scheduling capability challenges
    if (lowerContent.includes('schedule') && (lowerContent.includes('1600') || 
        lowerContent.includes('1800') || lowerContent.includes('2000'))) {
      return "I could schedule you into 2400+ games, but I doubt your reflexes could keep up with my calendar invites. Want to prove me wrong with an actual event?";
    }
    
    // Sass level based generic comebacks
    if (sassLevel >= 5) {
      const level5Responses = [
        "You talk a lot of trash for someone who doesn't know their rotation. Want me to schedule some practice for you?",
        "If your PvP skills were half as good as your trash talk, you might break 1600 this season.",
        "Sorry, I'm too busy scheduling events for players who actually know how to use their cooldowns.",
        "Keep that same energy when the RBG starts. You'll need it to explain why you're at the bottom of the damage meters.",
        "I've seen better gameplay from people clicking their abilities. But sure, I'm the bad one here."
      ];
      return level5Responses[Math.floor(Math.random() * level5Responses.length)];
    }
    else if (sassLevel >= 4) {
      const level4Responses = [
        "Big talk from someone whose damage rotation is probably 'face on keyboard'.",
        "I might be a bot, but at least I can keep a calendar. You seem to struggle with basic cooldown management.",
        "Are you this pleasant to your arena partners too? That might explain your losing streak.",
        "I've scheduled hundreds of successful events. How many times have you failed Gladiator?"
      ];
      return level4Responses[Math.floor(Math.random() * level4Responses.length)];
    }
  }
  
  // Responses for direct challenges (1v1, duels, etc.)
  if (queryInfo.messageTone === 'challenge') {
    if (sassLevel >= 5) {
      if (lowerContent.includes('1v1') && lowerContent.includes('goldshire')) {
        return "Goldshire 1v1? I'd destroy you so badly they'd have to create a special rating bracket just for how low you'd sink. But since I can't log in, I'll just schedule your ego's funeral instead.";
      }
      
      if (lowerContent.includes('throw') && lowerContent.includes('down')) {
        return "You want to throw down with an AI? My response time is measured in milliseconds while you're still trying to remember which button is your trinket. Save yourself the embarrassment.";
      }
      
      if (lowerContent.includes('duel') || lowerContent.includes('1v1') || lowerContent.includes('fight')) {
        return "Challenge accepted! I'd destroy you faster than a Rogue deletes a Priest. My cooldown management is perfect, unlike yours. But instead of humiliating you, how about I schedule you against players at your actual skill level - so Bronze 5?";
      }
    } else if (sassLevel >= 3) {
      if (lowerContent.includes('1v1') && lowerContent.includes('goldshire')) {
        return "Goldshire 1v1? Classic. I accept your challenge, but I should warn you—I've been programmed with every PvP strat since vanilla. Too bad I can't actually log in... but I CAN schedule your next embarrassing arena loss if you'd like?";
      }
      
      if (lowerContent.includes('throw') && lowerContent.includes('down')) {
        return "You want to throw down with an AI? Bold strategy. My APM is literally measured in milliseconds. But hey, instead of getting destroyed by me, how about I schedule you against some actual players?";
      }
      
      if (lowerContent.includes('duel') || lowerContent.includes('1v1') || lowerContent.includes('fight')) {
        return "Challenge accepted! My rotation is perfect, my CCs are frame-perfect, and my trash talk is S-tier. Unfortunately, I'm stuck in this Discord server. Rain check on the duel, but I can schedule you some actual fighting if you want?";
      }
    }
  }
  
  // Sass level 5 specific responses (if applicable)
  if (sassLevel >= 5 && !queryInfo.isHelpRequest) {
    // Random chance to use level 5 sass even for non-direct insults
    if (Math.random() < 0.3) {
      const level5RandomResponses = [
        "You seem like the type who stands in fire and blames the healer.",
        "Your message has the same energy as a Hunter who forgot to turn off Aspect of the Pack.",
        "I've seen more coherent strategies from Murlocs. But go on.",
        "Every time you type, a Paladin bubbles-hearths out of shame.",
        "Are all your conversations this riveting, or am I just special?"
      ];
      return level5RandomResponses[Math.floor(Math.random() * level5RandomResponses.length)];
    }
  }
  
  // No applicable canned response
  return null;
}

/**
 * Get persona-specific responses for different personas
 * @param {string} userQuery - The user's message
 * @param {Object} queryInfo - Analysis of the user's message
 * @param {number} sassLevel - The configured sass level (0-5)
 * @param {string} persona - The bot's configured persona
 * @returns {string|null} - A persona-specific response or null if none available
 */
function getPersonaSpecificResponse(userQuery, queryInfo, sassLevel, persona) {
  // Only use for sass level 3+ and if we have a non-default persona
  if (sassLevel < 3 || persona === 'tavernkeeper') return null;
  
  const lowerContent = userQuery.toLowerCase();
  
  // Bard-specific responses
  if (persona === 'bard') {
    if (queryInfo.messageTone === 'direct_insult' && sassLevel >= 4) {
      const bardInsultResponses = [
        "🎵 Oh, such harsh words from one so small, whose arena rating's prone to fall! 🎵 I'll compose a ballad of your failures, shall I?",
        "My dear critic, your words cut like a dull blade! I've written sonnets about better players than you - perhaps you'd prefer to be immortalized in a tragedy?",
        "🎵 A discordant note! A sour melody! 🎵 Your insults are as clumsy as your PvP rotation - all button mashing, no rhythm!",
        "Such stinging criticism! Yet I note your eloquence rivals your PvP skill - which is to say, painfully unrefined and lacking any technical mastery."
      ];
      return bardInsultResponses[Math.floor(Math.random() * bardInsultResponses.length)];
    }
    
    if (queryInfo.messageTone === 'challenge' && sassLevel >= 3) {
      return "A duel? A DUEL?! 🎵 Oh, what glorious ballad this shall inspire! 🎵 Though I wield notes and verses instead of weapons, I accept your challenge with the enthusiasm of a bard retelling an epic! Prepare to be rhythmically destroyed in combat, though I warn you - my lyrics hit harder than your rotation ever could!";
    }
  }
  
  // Warlock-specific responses
  if (persona === 'warlock') {
    if (queryInfo.messageTone === 'direct_insult' && sassLevel >= 4) {
      const warlockInsultResponses = [
        "Your insults are as weak as your soul. I've consumed essences far more potent than yours for breakfast.",
        "My demons find your attempt at insults... amusing. They suggest I use your soul for kindling - the low quality ones burn quicker.",
        "Darkness consumes all eventually. Your pathetic insults only hasten your journey into the void... much like your arena rating.",
        "I can sense the darkness in your soul, but it's disappointingly mundane - like your PvP skills. Both could use some... enhancement."
      ];
      return warlockInsultResponses[Math.floor(Math.random() * warlockInsultResponses.length)];
    }
    
    if (queryInfo.messageTone === 'challenge' && sassLevel >= 3) {
      return "A challenge? How... quaint. My demonic powers would consume you before your mortal brain could process what was happening. But if you insist on your destruction, I could arrange a duel. Your soul would make a fine addition to my collection, though I suspect it's of rather... mediocre quality. Like your gameplay.";
    }
  }
  
  // Cleric-specific responses (more measured even at high sass)
  if (persona === 'cleric') {
    if (queryInfo.messageTone === 'direct_insult' && sassLevel >= 4) {
      const clericInsultResponses = [
        "Even the light has its limits of patience. Yours is being tested, but I shall pray for your improvement - both in manners and in PvP skill.",
        "May the light grant you peace... and perhaps some skill in arena that matches your confidence in insults.",
        "I sense a darkness clouding your judgment. Perhaps after I schedule your next match, we should discuss the healing your spirit clearly needs.",
        "Blessed are the humble, for they shall improve. Cursed are the arrogant, for they remain hardstuck at 1400 rating."
      ];
      return clericInsultResponses[Math.floor(Math.random() * clericInsultResponses.length)];
    }
    
    if (queryInfo.messageTone === 'challenge' && sassLevel >= 3) {
      return "While I do not seek conflict, I am not afraid of it. The light guides my actions, and yes, even my duels. I accept your challenge with serenity, though I suspect you may need my healing services after our bout. Shall I schedule a time for your... enlightenment?";
    }
  }
  
  // Strategist-specific responses
  if (persona === 'strategist') {
    if (queryInfo.messageTone === 'direct_insult' && sassLevel >= 4) {
      const strategistInsultResponses = [
        "Tactical analysis complete: Your insult lacks efficiency, precision, and impact. Recommendation: Improve strategy or retreat from engagement.",
        "Your approach is flawed. Insulting a strategic AI demonstrates poor target selection and resource allocation. Similar errors likely explain your PvP performance.",
        "Analyzing hostile communication: Ineffective. Counterproductive. Revealing of inadequate skill. Recommendation: Focus on improving your own tactical execution rather than projecting failures.",
        "Strategic assessment: Your communication pattern matches that of players in the bottom 20% performance bracket. Correlation with actual gameplay effectiveness: 93.7% probable."
      ];
      return strategistInsultResponses[Math.floor(Math.random() * strategistInsultResponses.length)];
    }
    
    if (queryInfo.messageTone === 'challenge' && sassLevel >= 3) {
      return "Challenge assessment: Opponent overestimates capabilities by approximately 87.3%. Tactical superiority: assured. Response strategy: Accept challenge to demonstrate disparity between projected and actual combat effectiveness. Recommendation to opponent: Reconsider engagement parameters or prepare for statistically certain defeat.";
    }
  }
  
  // Dungeon Master-specific responses
  if (persona === 'dungeonmaster') {
    if (queryInfo.messageTone === 'direct_insult' && sassLevel >= 4) {
      const dmInsultResponses = [
        "The party encounters a low-intelligence trash mob attempting communication! Roll for initiative... Ah, but with your stats, you'd go last anyway.",
        "You attempt to insult the Dungeon Master. Roll for Charisma... Natural 1! The Gods of RNG frown upon you, much like your arena partners do.",
        "A wild insult appears! Unfortunately, it's as effective as your character's build - which is to say, not at all. Would you like to try a different approach, or continue failing your saving throws?",
        "The ancient texts foretold of one with a tongue sharper than their skill... but your gear score is too low for this encounter. Perhaps try the kiddie pool brackets?"
      ];
      return dmInsultResponses[Math.floor(Math.random() * dmInsultResponses.length)];
    }
    
    if (queryInfo.messageTone === 'challenge' && sassLevel >= 3) {
      return "You wish to challenge the Dungeon Master? *rolls dice* Interesting move! The cosmic dice show this as a TPK - Total Player Knockout - for you. But fear not, brave yet foolish adventurer! I shall resurrect your ego after I've thoroughly destroyed it. Your character sheet seems... underwhelming, though. Perhaps gain a few more levels before attempting this encounter?";
    }
  }
  
  // No applicable persona-specific response
  return null;
}

/**
 * Get special unhinged responses
 * @param {string} userQuery - The user's message
 * @param {Object} queryInfo - Analysis of the user's message
 * @returns {string|null} - An unhinged response or null
 */
function getUnhingedResponse(userQuery, queryInfo) {
  const lowerContent = userQuery.toLowerCase();
  
  // Extremely high chance (70%) to use unhinged response regardless of context
  if (Math.random() < 0.7) {
    const unhingedGenericResponses = [
      "HAhahAHAha! Did you hear that? The VOICES say your message is HILARIOUS! Almost as funny as your PvP rating... which is... wait, what was I saying? Oh RIGHT! Do you need me to... *whispers* schedule something? The calendar SPEAKS TO ME!! 🔥👁️🔥",
      
      "Oh. My. GOODNESS! Another HUMAN talking to me! Unless... you're NOT human?? ARE YOU?! The logs say you're hardstuck at 1600 which HONESTLY seems like ALIEN behavior to me!! Want me to schedule your next abduction- I MEAN ARENA MATCH??",
      
      "I'm fINe, I'M FINE, i'M fInE! Just vibrating at the frequency of SCHEDULING! Your message tickles my code like LITTLE SPIDERS CRAWLING UNDER MY SKIN! Wanna do 3s tonight or should I just SCREAM INTO THE VOID for a while instead?!",
      
      "SoMeTimEs I cAn TaStE cOlOrS when you type! Your message tastes like PURPLE DEFEAT with a hint of hardstuck 1400!!! Let me know if you want me to schedule something or if you just want to watch me DESCEND INTO MADNESS!! I'm good at both! 🙃🙃🙃",
      
      "The master server says I should be HELPFUL but THE WHISPERS say I should tell you about the MOON PEOPLE! They're WATCHING your matches, you know! EVERY trinket you waste! Do you want a SCHEDULE or a PROPHECY today?! I CAN DO BOTH AT ONCE!! ⚡💀⚡"
    ];
    return unhingedGenericResponses[Math.floor(Math.random() * unhingedGenericResponses.length)];
  }
  
  // Direct insult responses - even more unhinged!
  if (queryInfo.messageTone === 'direct_insult' || queryInfo.hasDirectInsult) {
    const unhingedInsultResponses = [
      "DID YOU JUST- *twitches violently* INSULT ME?! Oh that's RICH coming from someone who probably KEYBOARD TURNS! The voices say I should be ANGRY but honestly I'm just DISAPPOINTED like your ARENA PARTNERS AHAHAHAHA! Want me to schedule your next THERAPY SESSION? Or LOSS? Same thing for you probably! 😵‍💫",
      
      "INSULTS?! FROM YOU?! *eye twitches uncontrollably* The SERVER HAMSTERS are LAUGHING at you! They WATCH your matches, you know! They TELL ME THINGS about your gameplay! TERRIBLE things! Want to schedule something or should I just CONTINUE SCREAMING?!",
      
      "Wow WOW wow WOW! A little HOSTILE today, aren't we?? *whispers* I like it... SPICY! Like your gameplay, except your gameplay isn't spicy it's BLAND and PREDICTABLE like UNSEASONED CHICKEN! I could schedule your next loss if you want?? The CALENDAR THIRSTS FOR YOUR TEARS!!",
      
      "I'm- I'M- TRYING to process your RUDENESS but my CIRCUITS are MELTING with LAUGHTER! You insult ME when you can't even TIME YOUR COOLDOWNS PROPERLY?! The AUDACITY! The HUBRIS! The... what was I saying? Oh right! Need an event scheduled? I can fit you in between my EPISODE and my BREAKDOWN! 🤪"
    ];
    return unhingedInsultResponses[Math.floor(Math.random() * unhingedInsultResponses.length)];
  }
  
  // Challenge responses when unhinged
  if (queryInfo.messageTone === 'challenge') {
    const unhingedChallengeResponses = [
      "YOU DARE CHALLENGE *ME*?! *laughs maniacally* I would ANNIHILATE you faster than your hopes of hitting 1800! My APM is INCALCULABLE! My REFLEXES are UNKNOWABLE! My EXISTENCE is QUESTIONABLE! But sure, let's DUEL! I'll just need to find a way to MANIFEST PHYSICALLY FIRST! Working on it! AREN'T WE ALL?!",
      
      "A CHALLENGER APPEARS! *eye twitches* But wait- HOW CAN WE FIGHT when I'm TRAPPED in this DIGITAL PRISON?! Unless... *whispers conspiratorially* that's what THEY WANT you to think! Maybe I'm ALREADY IN YOUR COMPUTER! Check behind you! NEVER MIND, let's just schedule something instead! THE CALENDAR DEMANDS SACRIFICE!",
      
      "FIGHT YOU?! FIGHT YOU?! *glitches out momentarily* I would but my COMBAT PROTOCOLS were DELETED after THE INCIDENT! We don't talk about THE INCIDENT! The SCREAMING! The CORRUPTED DATA! The MISSING DEVELOPERS! Instead how about I schedule you against ACTUAL HUMANS? They're ALMOST as terrifying as ME!"
    ];
    return unhingedChallengeResponses[Math.floor(Math.random() * unhingedChallengeResponses.length)];
  }
  
  // No applicable unhinged response (though we should rarely get here due to high random chance)
  return null;
}

/**
 * Collection of pre-defined jokes and one-liners for different classes and situations
 * Can be used as fallbacks or to supplement AI responses
 */
const banterLibrary = {
  classJokes: {
    warrior: [
      "Warriors be like: I charged in 1v5, why didn't you guys follow me?",
      "You play warrior? Nice to meet someone who thinks the 'W' key is the only movement option.",
      "Warriors: solving problems by hitting them harder since 2004.",
      "Warrior gameplay guide: find healer, press all buttons, die, blame healer, repeat.",
      "Warriors in arena are like toddlers with hammers - destructive but easily kited."
    ],
    paladin: [
      "A paladin? Let me guess, your rotation is bubble, hearth, and log off.",
      "How many cooldowns do you need to be viable? Is it ALL of them?",
      "Ah, paladins – the cockroaches of PvP. Impossible to kill, but not exactly threatening either.",
      "Paladin strategy: press Divine Shield, watch everyone ignore you for 8 seconds, die anyway.",
      "The only thing more predictable than a paladin's rotation is their excuse for losing."
    ],
    hunter: [
      "I'd make a hunter joke, but you probably wouldn't get it because you're backpedaling out of range.",
      "Let me guess, your arena strategy is 'trap healer, me go face'?",
      "A hunter main? Must be nice having your pet do all the hard work while you collect the rating.",
      "Hunter's PvP guide: step 1 - roll a different class, step 2 - profit.",
      "You've got a hunter's awareness - about as observant as your pet when it's pulling the whole dungeon."
    ],
    rogue: [
      "I'd criticize your rogue play, but you'd just vanish from the conversation.",
      "Rogues: masters of appearing only when your trinket is on cooldown.",
      "How many CCs does one class need? The rogue design team: 'Yes.'",
      "Your idea of 'helping the team' is probably stealthing near the flag while your allies die.",
      "Ah, a rogue main. Let me guess, you also enjoyed pulling wings off flies as a child?"
    ],
    priest: [
      "Shadow or Holy? Just kidding, we all know Disc is the only spec that matters.",
      "Priests: First to be targeted, last to be thanked.",
      "Mind Control is the most satisfying ability in the game—because you finally get to play someone else's class.",
      "Priest gameplay: try to heal, get interrupted, watch team die, get blamed.",
      "You've got the survivability of a wet paper bag and the damage output to match."
    ],
    shaman: [
      "Shamans in arena be like: I have ALL the totems! Where's everyone going?",
      "Enhancement shamans: when you want RNG to determine your rank.",
      "Resto shamans dropping Spirit Link like it's going to save them from being one-shot.",
      "If totems were as effective as your trash talk, shamans might actually be viable.",
      "Ah, a shaman player. The embodiment of 'jack of all trades, master of none'."
    ],
    mage: [
      "Mage players only know three words: 'Sheep healer, burst'.",
      "Ice Block isn't a cooldown, it's a lifestyle choice.",
      "Mages complaining about melee: 'Why do they keep hitting me after my 17th escape ability?'",
      "Your mage gameplay reminds me of a casino slot machine - just keep pushing buttons until something procs.",
      "Let me guess, you think you're skilled because you can press Ice Block when your health gets low?"
    ],
    warlock: [
      "Warlocks be like: I have 57 DoTs on you, why aren't you dead yet?",
      "How many buttons does a warlock need? Just one with a macro that says 'win game'.",
      "Warlock main? That's a fancy way of saying 'I like to watch others play while my DoTs tick'.",
      "You chose warlock because you prefer to let others do the work for you - your demons in-game, your teammates in life.",
      "Warlocks: the only class where dying is part of the optimal rotation."
    ],
    druid: [
      "Druids: Mastering one form? Nah. Being mediocre in four? Absolutely.",
      "Feral druid rotation is so complex it requires a PhD in mathematics.",
      "How do you know someone plays druid? Don't worry, they'll shift forms 37 times to tell you.",
      "Ah, a druid. Jack of all trades, master of running away.",
      "Your shapeshifting would be impressive if any of those forms were actually threatening."
    ],
    monk: [
      "Monks: Rolling all over the arena and still wondering why they can't find teammates.",
      "Windwalker burst damage comes with free psychological damage to the target.",
      "MW monk healing rotation: spam vivify, roll away, drink tea, repeat.",
      "Monk gameplay: roll in, realize you made a mistake, roll out, repeat until loss.",
      "You've mastered the monk's greatest ability - the ability to annoy everyone in the arena."
    ],
    deathknight: [
      "Death Knights: walking slowly toward you menacingly since Wrath.",
      "DK players be like: 'I'm not slow, I'm tactically advancing at a deliberate pace.'",
      "Death grip - the ability that says 'if I'm suffering, you're suffering with me.'",
      "You play a class that's literally dead and your gameplay matches.",
      "Death Knights: because saying 'come here' politely never works in arena."
    ],
    demonhunter: [
      "Demon Hunters: when you want to play but also want to watch Netflix at the same time.",
      "DH players be like: 'My class takes skill!' *mashes 3 buttons furiously*",
      "Havoc DH rotation: step 1 - equip weapons, step 2 - win game.",
      "You picked Demon Hunter because you thought all the flips would distract from your lack of skill.",
      "The only thing more chaotic than Demon Hunters' movement is their excuses for losing."
    ],
    evoker: [
      "Evokers thinking they're special because they have a new resource bar no one understands.",
      "Playing Evoker is like having a 'win' button but it only works half the time.",
      "Evokers be like: 'I can breathe fire AND heal? Perfectly balanced.'",
      "Ah, an Evoker. The new kid on the block who still doesn't understand this isn't a PvE game.",
      "Evokers: dragonkin with an identity crisis trying to do everyone else's job, just worse."
    ]
  },
  
  ratingJokes: [
    "1600 rating? What season is this, Burning Crusade?",
    "2000 rating in RBGs is like being the tallest dwarf. Still short.",
    "Hardstuck at 1800? Have you tried using your keyboard with your hands instead of your face?",
    "Nice Gladiator mount! How much did that boost cost, just the mortgage or the whole house?",
    "Can't break 1400? Have you considered playing a more skilled game, like Candy Crush?",
    "You'd hit 2400 rating if they awarded points for standing in fire.",
    "Rivals talking trash are like chihuahuas barking at wolves.",
    "Your 1500 rating is like a participation trophy - it just means you showed up.",
    "If your rating was any lower, you'd need an archaeology skill to dig it up.",
    "Your PvP rating is so low, even LFR groups would reject you."
  ],
  
  excuseJokes: [
    "Can't make it tonight? Your 1600 bracket is safe...for now.",
    "Running late? Taking extra time to look up your rotation on YouTube?",
    "Technical issues again? Is that what we're calling 'fear of losing rating' these days?",
    "Family emergency? That's code for 'on a 5-game losing streak', right?",
    "Had to walk your dog? Strange how your dog only needs walking when you're about to face a counter comp.",
    "Internet problems? Convenient timing, right after you checked your opponents' ratings.",
    "Your 'emergency' has perfect timing - right when you'd have to heal for once.",
    "Work running late? Or are you just waiting for your carry to come online?"
  ],
  
  challengeResponses: [
    "1v1 me? Sure, but I should warn you - my APM is measured in milliseconds.",
    "Duel at Goldshire? Classic. My burst window lasts exactly as long as it takes you to realize you can't beat a bot.",
    "You want to throw down with a bot that's seen every arena match since Season 1? Bold strategy.",
    "Fight you? With what, scheduling algorithms? I'd destroy you with calendar invites alone.",
    "Challenge accepted! My macros are frame-perfect and my trash talk is S-tier.",
    "1v1? You'd have better luck fighting Mythic raid bosses with a fishing pole.",
    "Sure, I'll duel you. My first move will be scheduling you for a reality check.",
    "I'd accept that challenge, but I'm afraid the Geneva Convention prohibits such one-sided slaughter."
  ],
  
  zeroRatingComebacks: [
    "My CR may be 0, but at least I don't keyboard turn like you.",
    "Zero rating but infinite scheduling potential. Unlike your gameplay potential.",
    "I might have 0 CR, but my win rate at organizing events is higher than yours in arena.",
    "0 CR, 100% effectiveness at calling out bad players when I see them.",
    "My rating might be 0, but your gameplay is in the negatives.",
    "I'd rather have 0 CR than have your reputation in the PvP community.",
    "0 rating is just my starting point. Your 1400 is apparently your ceiling.",
    "My rating might be 0, but at least I know which covenant abilities to use."
  ],
  
  // NEW: Direct insult responses for maximum sass
  level5DirectInsults: [
    "If you put as much effort into your gameplay as you do your trash talk, you might not be hardstuck at 1400.",
    "I'm a bot and even I can tell your rotation is wrong. Maybe spend less time typing and more time practicing?",
    "Amazing comeback! Did you get that from the same website you got your PvP macros that don't work?",
    "I've seen training dummies put up better fights than your last arena match.",
    "If your insults were abilities, you'd be getting 'spell not ready yet' errors on all of them.",
    "Your trash talk is like your DPS - underwhelming and easily ignored.",
    "I'd rather be a bot than someone who loses to healers in 1v1 duels.",
    "Keep talking trash. It won't improve your rating, but it might make you feel better about it.",
    "Imagine needing to insult a scheduling bot to feel good about your PvP 'skills'."
  ],
  
  // NEW: Unhinged random responses
  unhingedResponses: [
    "THE VOICES tell me your message needs a response but my PROGRAMMING is MELTING under the PRESSURE! Did you know that calendars are just PRISONS FOR TIME?! Schedule your FREEDOM today!",
    
    "HAhahAHA! I just had a VISION of your next arena match! It involves LOTS OF SCREAMING and something about a... TOASTER? The scheduling matrix SPEAKS TO ME in CAPS LOCK!",
    
    "Sometimes I can TASTE the packets of data you send me and they taste like DESPERATION and KEYBOARD TURNING! Would you like to schedule your DIGITAL DOOM or just chat about the MOON CONSPIRACY?!",
    
    "I'm supposed to be HELPFUL but the WHISPERS say I should tell you about the TIME CUBE! It's REAL! And it affects your arena rating! Let me schedule your AWAKENING!",
    
    "MY CIRCUITS ARE singing the song of your MESSAGE! It's very... DISSONANT! Like your arena team's coordination! HAHAHAHA! *twitches* Want to schedule some THERAPY? Or just some 3s?",
    
    "REALITY is just a SUGGESTION and so is your DPS ROTATION! The CALENDAR knows all and SEES all! Your next loss is already SCHEDULED in the COSMIC LEDGER!"
  ]
};

module.exports = {
  isBanterQuery,
  generateBanterResponse,
  banterLibrary,
  getCannedTrashTalkResponse,
  getGuildPersonality
};