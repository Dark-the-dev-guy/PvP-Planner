// assistant/assistantHandler.js
const { OpenAI } = require('openai');
const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const logger = require('../utils/logger');
const promptLibrary = require('./promptLibrary');
const configManager = require('../utils/configManager');
const ConversationLog = require('../models/ConversationLog');

// Import specialized handlers
const eventCreator = require('./modules/eventCreator');
const participationHandler = require('./modules/participationHandler');
const scheduleInfoHandler = require('./modules/scheduleInfoHandler');
const banterHandler = require('./modules/banterHandler');
const configCreator = require('./modules/configCreator');

// Initialize OpenAI client
let openai;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    logger.info("✅ OpenAI client initialized successfully");
  } else {
    logger.warn("⚠️  OpenAI API key not found - AI features will be disabled");
  }
} catch (error) {
  logger.error("❌ Error initializing OpenAI client:", error);
}

// Define channel types for context-aware responses
const CHANNEL_TYPES = {
  SCHEDULE: 'schedule',
  REGULAR: 'regular',
  EVENTS: 'events',
  OTHER: 'other'
};

// Conversation state cache with expiration
const conversationState = new Map();
// Messages history for context tracking (keyed by userId and channelId)
const messageHistory = new Map();
// Failed event creations tracking
const failedEventCreations = new Map();
const CONVERSATION_EXPIRY = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_MESSAGES = 20; // Keep track of last 20 messages for deeper context

/**
 * Get channel type based on ID and guild configuration
 * @param {string} channelId - Discord channel ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<string>} - Channel type
 */
async function getChannelType(channelId, guildId) {
  try {
    // If we have a guild ID, try to get its configuration
    if (guildId) {
      const guildConfig = await configManager.getGuildConfig(guildId);
      
      // Check if we have channel IDs configured
      if (guildConfig && guildConfig.channels) {
        if (guildConfig.channels.scheduleChannelId === channelId) {
          return CHANNEL_TYPES.SCHEDULE;
        }
        if (guildConfig.channels.eventsChannelId === channelId) {
          return CHANNEL_TYPES.EVENTS;
        }
        if (guildConfig.channels.regularChannelId === channelId) {
          return CHANNEL_TYPES.REGULAR;
        }
      }
      
      // If no specific configuration, check if channel is in displayChannels
      if (guildConfig && guildConfig.displayChannels && guildConfig.displayChannels.includes(channelId)) {
        return CHANNEL_TYPES.EVENTS;
      }
    }
    
    // Fallback to environment variables for backward compatibility
    const scheduleChannelId = process.env.SCHEDULE_CHANNEL_ID || "1168218513819836446";
    const eventsChannelId = process.env.EVENTS_CHANNEL_ID || "1348043420458815538";
    const regularChannelId = process.env.REGULAR_CHANNEL_ID || "853476836437000242";
    
    // Map the channel ID to a channel type
    if (channelId === scheduleChannelId) {
      return CHANNEL_TYPES.SCHEDULE;
    } else if (channelId === eventsChannelId) {
      return CHANNEL_TYPES.EVENTS;
    } else if (channelId === regularChannelId) {
      return CHANNEL_TYPES.REGULAR;
    } else {
      return CHANNEL_TYPES.OTHER;
    }
  } catch (error) {
    logger.error(`Error in getChannelType for channel ${channelId} in guild ${guildId}:`, error);
    // Default to OTHER if there's an error
    return CHANNEL_TYPES.OTHER;
  }
}

/**
 * Get conversation state for a user
 * @param {string} userId - Discord user ID
 * @param {string} channelId - Discord channel ID
 * @returns {Object} - Conversation state or null if none exists
 */
function getConversationState(userId, channelId) {
  const key = `${userId}-${channelId}`;
  if (!conversationState.has(key)) return null;
  
  const state = conversationState.get(key);
  // Check if the conversation has expired
  if (Date.now() - state.lastUpdated > CONVERSATION_EXPIRY) {
    conversationState.delete(key);
    return null;
  }
  
  return state;
}

/**
 * Update conversation state for a user
 * @param {string} userId - Discord user ID
 * @param {string} channelId - Discord channel ID
 * @param {Object} newState - New conversation state
 */
function updateConversationState(userId, channelId, newState) {
  const key = `${userId}-${channelId}`;
  const currentState = conversationState.get(key) || {};
  conversationState.set(key, {
    ...currentState,
    ...newState,
    lastUpdated: Date.now()
  });
  
  // Set a timeout to clean up expired conversations
  setTimeout(() => {
    const state = conversationState.get(key);
    if (state && Date.now() - state.lastUpdated > CONVERSATION_EXPIRY) {
      conversationState.delete(key);
    }
  }, CONVERSATION_EXPIRY + 1000);
}

/**
 * Clear conversation state for a user
 * @param {string} userId - Discord user ID
 * @param {string} channelId - Discord channel ID
 */
function clearConversationState(userId, channelId) {
  const key = `${userId}-${channelId}`;
  conversationState.delete(key);
}

/**
 * Add message to history
 * @param {string} userId - Discord user ID
 * @param {string} channelId - Discord channel ID
 * @param {boolean} isBot - Whether message is from bot
 * @param {string} content - Message content
 */
function addMessageToHistory(userId, channelId, isBot, content) {
  const key = `${userId}-${channelId}`;
  
  if (!messageHistory.has(key)) {
    messageHistory.set(key, []);
  }
  
  const history = messageHistory.get(key);
  
  // Add the new message
  history.push({
    role: isBot ? "assistant" : "user",
    content,
    timestamp: Date.now()
  });
  
  // Keep only the last MAX_HISTORY_MESSAGES
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.shift(); // Remove oldest message
  }
  
  // Set timeout to clean up old message history
  setTimeout(() => {
    const history = messageHistory.get(key);
    if (history) {
      // Remove messages older than CONVERSATION_EXPIRY
      const now = Date.now();
      const updatedHistory = history.filter(msg => now - msg.timestamp < CONVERSATION_EXPIRY);
      
      if (updatedHistory.length === 0) {
        messageHistory.delete(key);
      } else {
        messageHistory.set(key, updatedHistory);
      }
    }
  }, CONVERSATION_EXPIRY + 1000);
}

/**
 * Get message history for a user
 * @param {string} userId - Discord user ID
 * @param {string} channelId - Discord channel ID
 * @returns {Array} - Message history array or empty array if none exists
 */
function getMessageHistory(userId, channelId) {
  const key = `${userId}-${channelId}`;
  return messageHistory.has(key) ? messageHistory.get(key) : [];
}

/**
 * Track failed event creation attempts for retry
 * @param {string} userId - User ID
 * @param {string} channelId - Channel ID
 * @param {boolean} failed - Whether the creation failed
 */
function trackEventCreationAttempt(userId, channelId, failed = true) {
  const key = `${userId}-${channelId}-eventcreation`;
  if (failed) {
    failedEventCreations.set(key, {
      timestamp: Date.now(),
      attempted: true
    });
    logger.info(`[AI Assistant] Tracked failed event creation for user ${userId} in channel ${channelId}`);
  } else {
    failedEventCreations.delete(key);
    logger.info(`[AI Assistant] Cleared failed event creation for user ${userId} in channel ${channelId}`);
  }
}

/**
 * Check if user had a failed event creation attempt
 * @param {string} userId - User ID
 * @param {string} channelId - Channel ID
 * @returns {Object|null} - Failed event creation info or null
 */
function checkForFailedEventCreation(userId, channelId) {
  const key = `${userId}-${channelId}-eventcreation`;
  return failedEventCreations.get(key) || null;
}

/**
 * Check if a message is likely part of a conversation
 * @param {string} content - Message content
 * @param {Array} history - Message history
 * @returns {boolean} - True if likely part of a conversation
 */
function isConversationContinuation(content, history) {
  if (!history || history.length === 0) return false;
  
  // Short messages are likely responses to the previous message
  if (content.split(/\s+/).filter(Boolean).length < 8) return true;
  
  // Messages with question marks are often follow-ups
  if (content.includes('?')) return true;
  
  // Check for common conversation starters
  const continuationWords = [
    'yes', 'no', 'yeah', 'nope', 'ok', 'okay', 'sure', 'thanks', 'got it',
    'what about', 'also', 'and', 'but', 'however', 'actually', 'wait',
    'hmm', 'oh', 'right', 'exactly', 'true', 'fair', 'probably'
  ];
  
  const lowerContent = content.toLowerCase();
  return continuationWords.some(word => 
    lowerContent.startsWith(word + ' ') || lowerContent === word
  );
}

/**
 * Detect intent from a message with conversation context
 * @param {string} content - Message content
 * @param {string} channelType - Type of channel
 * @param {Object} conversationContext - Active conversation context
 * @param {Array} history - Message history
 * @returns {Object} - Intent information
 */
function detectIntent(content, channelType, conversationContext, history) {
  const intents = [];
  
  // Check for event creation requests
  if (eventCreator.isEventCreationRequest(content)) {
    // Higher confidence in schedule channel, lower in regular channel
    const confidence = channelType === CHANNEL_TYPES.SCHEDULE ? 0.95 : 0.87;
    intents.push({ type: 'event_creation', confidence });
  }
  
  // Check for configuration requests
  if (configCreator.isConfigurationRequest(content)) {
    // Configuration has high confidence across all channels
    const confidence = 0.93;
    intents.push({ type: 'configuration', confidence });
  }
  
  // Check for participation requests
  if (participationHandler.isParticipationRequest(content)) {
    // Higher confidence in schedule channel, lower in regular channel
    const confidence = channelType === CHANNEL_TYPES.SCHEDULE ? 0.94 : 0.85;
    intents.push({ type: 'participation', confidence });
  }
  
  // Check if this is a schedule info query
  const scheduleQuery = scheduleInfoHandler.isScheduleInfoQuery(content);
  if (scheduleQuery.isScheduleQuery || scheduleQuery.isParticipantQuery) {
    // Higher confidence in schedule channel, lower in regular channel
    const confidence = channelType === CHANNEL_TYPES.SCHEDULE ? 0.92 : 0.8;
    intents.push({ 
      type: 'schedule_info', 
      confidence,
      details: scheduleQuery
    });
  }
  
  // AFTER checking for specific intents, check for conversation continuation
  
  // If we have an ongoing conversation context, consider that intent
  if (conversationContext && conversationContext.intent) {
    // Check if this is likely a continuation of the previous conversation
    const isContinuation = isConversationContinuation(content, history);
    
    // If it looks like a continuation, use a high confidence but not higher than specific commands
    const contextConfidence = isContinuation ? 0.89 : 0.75;
    
    intents.push({ 
      type: conversationContext.intent, 
      confidence: contextConfidence,
      context: conversationContext
    });
  }
  
  // Also check if this looks like conversation continuation regardless of context
  if (history.length > 0 && isConversationContinuation(content, history)) {
    intents.push({
      type: 'conversation_continuation',
      confidence: 0.88 // Lower than specific intents, but still high
    });
  }
  
  // Check if this is banter/casual chat
  const banterQuery = banterHandler.isBanterQuery(content);
  if (banterQuery.isRatingQuery || banterQuery.isClassMetaQuery || banterQuery.isCasualChat) {
    // Higher confidence in regular channel, lower in schedule channel
    const baseBanterConfidence = banterQuery.isCasualChat ? 0.6 : 0.8;
    const confidence = channelType === CHANNEL_TYPES.REGULAR ? baseBanterConfidence : baseBanterConfidence - 0.2;
    intents.push({ 
      type: 'banter', 
      confidence,
      details: banterQuery
    });
  }
  
  // If no specific intent is detected, default to general conversation
  if (intents.length === 0) {
    // Default to higher confidence for general conversation in regular channel
    const confidence = channelType === CHANNEL_TYPES.REGULAR ? 0.7 : 0.5;
    intents.push({ type: 'conversation', confidence });
  }
  
  // Sort by confidence and return the highest
  intents.sort((a, b) => b.confidence - a.confidence);
  return intents[0];
}

/**
 * Handle a message with full conversation context
 * @param {string} content - Message content
 * @param {string} channelType - Type of channel
 * @param {Array} history - Message history
 * @param {string} guildId - Guild ID for sass level lookup
 * @returns {Promise<string>} - AI response
 */
async function handleWithFullContext(content, channelType, history, guildId) {
  try {
    // Get guild-specific settings
    let guildPersona = 'tavernkeeper'; // default
    let guildSassLevel = 3; // default
    
    if (guildId) {
      try {
        const guildConfig = await configManager.getGuildConfig(guildId);
        if (guildConfig && guildConfig.personality) {
          guildPersona = guildConfig.personality.persona || 'tavernkeeper';
          guildSassLevel = guildConfig.personality.sassLevel || 3;
        }
      } catch (configError) {
        logger.error("Error getting guild config for sass level:", configError);
      }
    }
    
    // Get the appropriate system prompt based on guild persona and sass level
    const systemPrompt = promptLibrary.getPersonalizedPrompt(guildPersona, guildSassLevel);
    
    // Add channel-specific context
    let channelContext = "";
    if (channelType === CHANNEL_TYPES.SCHEDULE) {
      channelContext = "\nYou are currently in the RBG-SCHEDULE channel. This is focused on scheduling and event coordination. Be helpful with event management and respond to scheduling questions.";
    } else if (channelType === CHANNEL_TYPES.REGULAR) {
      channelContext = "\nYou are currently in the general RBG channel. This is a casual discussion channel for PvP players. Show more of your personality, engage in banter, and only focus on scheduling if explicitly asked. Be fun, playful, and share PvP knowledge.";
    } else if (channelType === CHANNEL_TYPES.EVENTS) {
      channelContext = "\nYou are currently in the RBG-EVENTS channel. This is primarily for displaying event information. Keep responses brief and focused on events.";
    }
    
    // Add special instructions for maintaining conversation awareness
    let conversationAwarenessPrompt = `
You are having a multi-turn conversation with the user. Maintain awareness of the entire conversation context.

CRITICAL INSTRUCTIONS:
1. Reference previous parts of the conversation when appropriate
2. Answer questions about what was said earlier in the conversation
3. Maintain the same conversational tone throughout
4. If the user asks about something previously mentioned, directly address it
5. Follow up on topics the user has shown interest in

The entire conversation history is provided to you - use it to provide coherent, contextual responses.
`;
    
    // Final combined prompt with channel context
    const finalPrompt = systemPrompt + channelContext + conversationAwarenessPrompt;
    
    // Use a higher temperature for unhinged persona
    let temperature = channelType === CHANNEL_TYPES.REGULAR ? 0.9 : 0.7;
    if (guildPersona === 'unhinged') {
      temperature = Math.min(1.0, temperature + 0.2);
    }
    
    // Create message array from history for better context
    let messages = [];
    
    // Include ALL relevant history if available
    if (history.length > 0) {
      // Use as much of the history as possible for maximum context
      messages = [...history];
    } else {
      // If no history, just use the current message
      messages = [{ role: "user", content }];
    }
    
    // Add system message at the beginning
    messages.unshift({ role: "system", content: finalPrompt });
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: messages,
      max_tokens: config.maxTokens,
      temperature: temperature
    });
    
    // Extract the AI's response text
    let responseText = response.choices[0].message.content.trim();
    
    // Truncate if too long
    if (responseText.length > config.maxResponseLength) {
      responseText = responseText.substring(0, config.maxResponseLength - 3) + "...";
    }
    
    return responseText;
  } catch (error) {
    logger.error("Error in full context handler:", error);
    return "I'm having trouble processing that request. Please try again later.";
  }
}

/**
 * Send log information to a Discord channel
 * @param {Object} client - Discord client
 * @param {Object} logData - Data to log
 * @returns {Promise<void>}
 */
async function sendLogToDiscord(client, logData) {
  try {
    // Get the log channel ID from environment
    const logChannelId = process.env.CONVERSATION_LOG_CHANNEL_ID;
    if (!logChannelId) return;
    
    // Get the channel
    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) return;
    
    // Determine channel and guild names
    const isDM = !logData.guildId;
    const guildName = isDM ? 'DM' : (client.guilds.cache.get(logData.guildId)?.name || 'Unknown Guild');
    const channelName = isDM ? 'Direct Message' : (client.channels.cache.get(logData.channelId)?.name || 'Unknown Channel');
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor(logData.success ? 0x00FF00 : 0xFF0000)
      .setTitle(`💬 Assistant Conversation Log`)
      .addFields(
        { name: '👤 User', value: `${logData.username} (${logData.userId})`, inline: true },
        { name: '📝 Intent', value: logData.intent || 'Unknown', inline: true },
        { name: '📊 Status', value: `${logData.success ? '✅' : '❌'} | Processing Time: ${logData.processingTimeMs || 'N/A'}ms` })
      .setTimestamp();
    
    // Add source information if not a DM
    if (!isDM) {
      embed.addFields({
        name: '📍 Source',
        value: `Guild: ${guildName} (${logData.guildId})\nChannel: ${channelName} (${logData.channelId})`,
        inline: false
      });
    }
    
    // Add error information if applicable
    if (!logData.success && logData.errorInfo) {
      embed.addFields({
        name: '❌ Error',
        value: logData.errorInfo.substring(0, 1024) || 'Unknown error',
        inline: false
      });
    }
    
    // Send the log embed to the channel
    await logChannel.send({ embeds: [embed] });
    
  } catch (error) {
    logger.error("Error sending log to Discord:", error);
  }
}

/**
 * Log a conversation to the database and Discord channel
 * @param {Object} client - Discord client
 * @param {Object} logData - Data to log
 * @returns {Promise<void>}
 */
async function logConversation(client, logData) {
  try {
    // Create new log entry for database
    const logEntry = new ConversationLog(logData);
    
    // Save to database
    await logEntry.save();
    
    // Add an ID field for reference
    logger.info(`Conversation logged with ID: ${logEntry._id}`);
    
    // Send log to Discord channel if client is provided
    if (client) {
      await sendLogToDiscord(client, logData);
    }
  } catch (error) {
    logger.error("Error logging conversation:", error);
  }
}

/**
 * Process a message and generate an AI response
 * @param {Object} client - Discord client
 * @param {Object} message - Discord message object
 */
async function processMessage(client, message) {
  try {
    // Skip messages from bots
    if (message.author.bot) return;
    
    // Enhanced logging for debugging
    if (config.logLevel === 'debug') {
      logger.info(`[AI Assistant Debug] Processing message from ${message.author.tag} in channel type ${message.channel.type}`);
      logger.info(`[AI Assistant Debug] Message content: ${message.content.substring(0, 30)}...`);
      logger.info(`[AI Assistant Debug] Is mention: ${message.mentions.users.has(client.user.id)}`);
      logger.info(`[AI Assistant Debug] Is reply to bot: ${message.reference && message.reference.messageId ? 'Maybe' : 'No'}`);
    }
    
    // Log that we're processing this message
    logger.info(`[AI Assistant] 🔄 Processing message from ${message.author.tag}: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`);
    
    // Variables for tracking processing time
    const processingStart = Date.now();
    let overrideIntent = null;
    
    // Check for mentions explicitly with a more robust pattern
    const botMentioned = message.content.includes(`<@${client.user.id}>`) || 
                          message.content.includes(`<@!${client.user.id}>`);
    
    // Determine if this is a reply to the bot (with better error handling)
    let isReplyToBot = false;
    if (message.reference && message.reference.messageId) {
      try {
        const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
        isReplyToBot = repliedTo.author.id === client.user.id;
        if (config.logLevel === 'debug') {
          logger.info(`[AI Assistant Debug] Confirmed reply to bot: ${isReplyToBot}`);
        }
      } catch (error) {
        logger.error("Error checking if message is a reply to bot:", error);
      }
    }
    
    // Get message history for this user in this channel
    const history = getMessageHistory(message.author.id, message.channel.id);
    
    // Only respond if: It's a DM, or the bot is mentioned, or it's a reply to a bot message
    const isDM = message.channel.type === 1; // Discord.js v14 uses 1 for DM channels
    let shouldRespond = isDM || botMentioned || message.mentions.users.has(client.user.id) || isReplyToBot;
    
    logger.info(`[AI Assistant] 🎯 Should respond: ${shouldRespond} (DM: ${isDM}, Mentioned: ${botMentioned}, Reply: ${isReplyToBot})`);
    
    // Clean content (remove mentions)
    let cleanContent = message.content;
    // More robust mention cleaning
    cleanContent = cleanContent.replace(/<@!?(\d+)>/g, (match, id) => {
      return id === client.user.id ? '' : match;
    }).trim();
    
    // If message is empty after removing mention, treat as a greeting
    if (!cleanContent) {
      cleanContent = "Hello";
    }
    
    // Check if we need to retry a previously failed event creation
    const lastEventCreationMention = checkForFailedEventCreation(message.author.id, message.channel.id);
    if (lastEventCreationMention && 
        (Date.now() - lastEventCreationMention.timestamp < 5 * 60 * 1000) && // Within 5 minutes
        cleanContent.toLowerCase().includes('schedule')) {
      logger.info(`[AI Assistant] Detected potential retry of failed event creation: ${cleanContent}`);
      shouldRespond = true;
      // Force the intent to event_creation
      overrideIntent = 'event_creation';
    }
    
    // If not a direct interaction, check if it might be a conversation continuation
    if (!shouldRespond) {
      // Check for ongoing conversation
      const conversationContext = getConversationState(message.author.id, message.channel.id);
      
      // Check if this is likely a continuation of the conversation
      if (history.length > 0 && isConversationContinuation(cleanContent, history)) {
        // Get the last bot message
        const lastBotMessages = history.filter(msg => msg.role === "assistant");
        
        if (lastBotMessages.length > 0) {
          const lastBotMessage = lastBotMessages[lastBotMessages.length - 1];
          
          // Check if the last bot message was recent (within 5 minutes)
          const isRecentBotMessage = (Date.now() - lastBotMessage.timestamp) < 5 * 60 * 1000;
          
          if (isRecentBotMessage) {
            // This looks like a continuation of a recent conversation
            logger.info(`[AI Assistant] Detected likely conversation continuation: "${cleanContent}"`);
            shouldRespond = true;
          }
        }
      }
      
      // If we still shouldn't respond but have an active conversation context, consider that
      if (!shouldRespond && conversationContext && (Date.now() - conversationContext.lastUpdated < 5 * 60 * 1000)) {
        // The active conversation is less than 5 minutes old, consider continuing
        logger.info(`[AI Assistant] Continuing conversation based on active context: ${JSON.stringify(conversationContext)}`);
        shouldRespond = true;
      }
    }
    
    // If we still shouldn't respond, ignore the message
    if (!shouldRespond) {
      logger.info(`[AI Assistant] ⏭️  Not responding to message - not directed at bot`);
      return;
    }
    
    // Check if DMs are enabled
    if (isDM && !config.enableDMs) {
      logger.info(`[AI Assistant] ⚠️  DMs disabled, ignoring DM from ${message.author.tag}`);
      return;
    }
    
    // If OpenAI client isn't initialized, return early
    if (!openai) {
      logger.warn("OpenAI client not initialized, skipping message processing");
      message.reply("Sorry, my brain is offline at the moment. Please try again later!");
      return;
    }
    
    // Determine the channel type for context-aware responses
    // Use the async getChannelType method with guild ID
    const channelType = isDM ? 
      CHANNEL_TYPES.OTHER : 
      await getChannelType(message.channel.id, message.guild?.id);
      
    logger.info(`[AI Assistant] 🏷️  Channel type detected: ${channelType}`);
    
    // Log the message being processed
    logger.info(`[AI Assistant] 🎯 Processing message: "${cleanContent}" from ${message.author.tag} in ${channelType} channel`);
    
    // Show typing indicator
    message.channel.sendTyping();
    
    // Get any active conversation context
    const conversationContext = getConversationState(message.author.id, message.channel.id);
    logger.info(`[AI Assistant] Conversation context: ${conversationContext ? JSON.stringify(conversationContext) : 'None'}`);
    
    // Add the user's message to history before processing
    addMessageToHistory(message.author.id, message.channel.id, false, cleanContent);
    
    // Detect the intent of the message with channel context and conversation state
    const intent = overrideIntent ? 
      { type: overrideIntent, confidence: 1.0 } : 
      detectIntent(cleanContent, channelType, conversationContext, history);
      
    logger.info(`[AI Assistant] 🎯 Detected intent: ${intent.type} (confidence: ${intent.confidence})`);
    
    // Prepare logging data
    const logData = {
      userId: message.author.id,
      username: message.author.tag,
      channelId: message.channel.id,
      guildId: message.guild?.id || null,
      messageContent: cleanContent,
      intent: intent.type,
      confidence: intent.confidence,
      channelType: channelType,
      processingTimeMs: null,
      success: false,
      botResponse: null,
      errorInfo: null
    };
    
    // Determine confidence threshold based on channel type
    const channelThreshold = channelType === CHANNEL_TYPES.SCHEDULE ? 0.5 : 0.65;
    
    // Process the message based on detected intent confidence
    if (intent.confidence >= channelThreshold) {
      let response = '';
      let actionSuccess = false;
      let actionDetails = {};
      
      // Handle based on intent type
      switch (intent.type) {
        case 'conversation_continuation':
          // Handle with full conversation context and pass guild ID
          response = await handleWithFullContext(cleanContent, channelType, history, message.guild?.id);
          actionSuccess = true;
          break;
          
        case 'event_creation':
          // Check if we have an existing conversation about event creation
          if (conversationContext && conversationContext.intent === 'event_creation') {
            // Update the context with the new message
            logger.info(`[AI Assistant] Continuing event creation conversation with added info: ${cleanContent}`);
            
            // Combine the current message with existing context
            const combinedContent = `${conversationContext.previousContent}. ${cleanContent}`;
            
            // Process event creation with combined context
            const eventResult = await eventCreator.processEventCreation(client, {
              content: combinedContent,
              author: message.author,
              contextData: conversationContext.data || {},
              guild: message.guild, 
              guildId: message.guild?.id,
              channel: message.channel
            });
            
            actionSuccess = eventResult.success;
            actionDetails = eventResult;
            
            // Track whether the event creation succeeded or failed
            trackEventCreationAttempt(message.author.id, message.channel.id, !actionSuccess);
            
            if (actionSuccess) {
              // Event was successfully created, clear the conversation state
              clearConversationState(message.author.id, message.channel.id);
              logger.info(`[AI Assistant] Event creation successful, clearing conversation state`);
              
              // Generate response based on result
              response = await eventCreator.generateEventCreationResponse(eventResult);
              
              // Add the successful response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            } else if (eventResult.missingFields && eventResult.missingFields.length > 0) {
              // Still missing fields, update the conversation state
              updateConversationState(message.author.id, message.channel.id, {
                intent: 'event_creation',
                previousContent: combinedContent,
                missingFields: eventResult.missingFields,
                partialDetails: eventResult.partialDetails,
                data: { ...(conversationContext.data || {}), ...eventResult.partialDetails }
              });
              
              // Generate response asking for missing fields
              response = await eventCreator.generateEventCreationResponse(eventResult);
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            } else {
              // Something went wrong, clear the conversation state
              clearConversationState(message.author.id, message.channel.id);
              
              // Generate error response
              response = await eventCreator.generateEventCreationResponse(eventResult);
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            }
            
            // Log the conversation
            logData.botResponse = response;
            logData.success = actionSuccess;
            logData.errorInfo = actionSuccess ? null : (eventResult.error || "Missing fields");
            logData.processingTimeMs = Date.now() - processingStart;
            await logConversation(client, logData);
            
            return; // Already sent response
          } else {
            // NEW event creation request - no existing context
            // First, send an immediate acknowledgment
            const initialEventReply = await message.reply("Working on creating that event for you... *keyboard clicking intensifies*");
            
            // Process event creation
            const eventResult = await eventCreator.processEventCreation(client, {
              content: cleanContent,
              author: message.author,
              guild: message.guild,
              guildId: message.guild?.id,
              channel: message.channel
            });
            
            actionSuccess = eventResult.success;
            actionDetails = eventResult;
            
            // Track whether the event creation succeeded or failed
            trackEventCreationAttempt(message.author.id, message.channel.id, !actionSuccess);
            
            if (!actionSuccess && eventResult.missingFields && eventResult.missingFields.length > 0) {
              // Missing fields, store conversation state
              updateConversationState(message.author.id, message.channel.id, {
                intent: 'event_creation',
                previousContent: cleanContent,
                missingFields: eventResult.missingFields,
                partialDetails: eventResult.partialDetails,
                data: eventResult.partialDetails
              });
              logger.info(`[AI Assistant] Created event creation conversation state with missing fields: ${eventResult.missingFields.join(', ')}`);
            } else if (actionSuccess) {
              // Event was successfully created, clear any conversation state
              clearConversationState(message.author.id, message.channel.id);
            }
            
            // Generate response based on result
            response = await eventCreator.generateEventCreationResponse(eventResult);
            
            // Add the response to message history
            addMessageToHistory(message.author.id, message.channel.id, true, response);
            
            // Edit the original reply instead of sending a new message
            await initialEventReply.edit(response);
            logger.info(`[AI Assistant] Event creation process completed: ${actionSuccess ? 'SUCCESS' : 'FAILED'}`);
            
            // Log the conversation
            logData.botResponse = response;
            logData.success = actionSuccess;
            logData.errorInfo = actionSuccess ? null : (eventResult.error || "Missing fields");
            logData.processingTimeMs = Date.now() - processingStart;
            await logConversation(client, logData);
            
            return; // Already sent response
          }
          break;
          
        case 'configuration':
          // Check if we have an existing conversation about configuration
          if (conversationContext && conversationContext.intent === 'configuration') {
            // Update the context with the new message
            logger.info(`[AI Assistant] Continuing configuration conversation with added info: ${cleanContent}`);
            
            // Combine the current message with existing context
            const combinedContent = `${conversationContext.previousContent}. ${cleanContent}`;
            
            // Process configuration with combined context
            const configResult = await configCreator.processConfigurationRequest(client, {
              content: combinedContent,
              author: message.author,
              contextData: conversationContext.data || {},
              guild: message.guild,
              guildId: message.guild?.id,
              channel: message.channel
            });
            
            actionSuccess = configResult.success;
            actionDetails = configResult;
            
            if (actionSuccess) {
              // Config was successfully updated, clear the conversation state
              clearConversationState(message.author.id, message.channel.id);
              logger.info(`[AI Assistant] Configuration update successful, clearing conversation state`);
              
              // Generate response based on result
              response = await configCreator.generateConfigResponse(configResult);
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            } else if (configResult.lowConfidence || configResult.missingDetails) {
              // Still missing details, update the conversation state
              updateConversationState(message.author.id, message.channel.id, {
                intent: 'configuration',
                previousContent: combinedContent,
                data: { ...(conversationContext.data || {}), ...configResult.extractedDetails }
              });
              
              // Generate response asking for missing details
              response = await configCreator.generateConfigResponse(configResult);
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            } else {
              // Something went wrong, clear the conversation state
              clearConversationState(message.author.id, message.channel.id);
              
              // Generate error response
              response = await configCreator.generateConfigResponse(configResult);
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            }
            
            // Log the conversation
            logData.botResponse = response;
            logData.success = actionSuccess;
            logData.errorInfo = actionSuccess ? null : (configResult.error || "Configuration error");
            logData.processingTimeMs = Date.now() - processingStart;
            await logConversation(client, logData);
            
            return; // Already sent response
          } else {
            // NEW configuration request - no existing context
            const configResult = await configCreator.processConfigurationRequest(client, message);
            actionSuccess = configResult.success;
            actionDetails = configResult;
            
            // Generate response based on result
            response = await configCreator.generateConfigResponse(configResult);
          }
          break;
          
        case 'participation':
          // Check if we have an existing conversation about participation
          if (conversationContext && conversationContext.intent === 'participation') {
            logger.info(`[AI Assistant] Continuing participation conversation with added info: ${cleanContent}`);
            
            // SPECIAL CASE: Check if this is a session selection response (just a number)
            const sessionSelectionMatch = cleanContent.match(/^\s*(\d+)\s*$/);
            if (sessionSelectionMatch && conversationContext.data && conversationContext.data.sessions) {
              const sessionNumber = parseInt(sessionSelectionMatch[1]);
              
              logger.info(`[AI Assistant] Detected session selection: ${sessionNumber}`);
              
              // Use resolveAmbiguousSessionWithDetails to handle the selection with stored participation details
              const selectionResult = await participationHandler.resolveAmbiguousSessionWithDetails(
                client,
                message,
                sessionNumber,
                conversationContext.data.sessions,
                conversationContext.data.participationDetails
              );
              
              actionSuccess = selectionResult.success;
              actionDetails = selectionResult;
              
              if (actionSuccess) {
                // Session selection was successful, clear the conversation state
                clearConversationState(message.author.id, message.channel.id);
                logger.info(`[AI Assistant] Session selection successful, clearing conversation state`);
                
                // Generate success response
                response = await participationHandler.generateParticipationResponse(selectionResult);
              } else {
                // Selection failed, generate error response
                response = await participationHandler.generateParticipationResponse(selectionResult);
                
                // Clear conversation state on error
                clearConversationState(message.author.id, message.channel.id);
              }
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
              
              // Log the conversation
              logData.botResponse = response;
              logData.success = actionSuccess;
              logData.errorInfo = actionSuccess ? null : (selectionResult.error || "Session selection error");
              logData.processingTimeMs = Date.now() - processingStart;
              await logConversation(client, logData);
              
              return; // Already sent response
            }
            
            // NOT a session selection - proceed with normal participation flow
            // Combine the current message with existing context
            const combinedContent = `${conversationContext.previousContent}. ${cleanContent}`;
            
            // Process participation with combined context
            const participationResult = await participationHandler.processParticipation(client, {
              content: combinedContent,
              author: message.author,
              contextData: conversationContext.data || {},
              guild: message.guild,
              guildId: message.guild?.id,
              channel: message.channel
            });
            
            actionSuccess = participationResult.success;
            actionDetails = participationResult;
            
            if (actionSuccess) {
              // Participation was successfully updated, clear the conversation state
              clearConversationState(message.author.id, message.channel.id);
              logger.info(`[AI Assistant] Participation update successful, clearing conversation state`);
              
              // Generate response based on result
              response = await participationHandler.generateParticipationResponse(participationResult);
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            } else if (participationResult.multipleMatches || participationResult.noExactMatch) {
              // Still multiple matches, update the conversation state with session list AND participation details
              const participationDetails = await participationHandler.extractParticipationDetails(combinedContent);
              updateConversationState(message.author.id, message.channel.id, {
                intent: 'participation',
                previousContent: combinedContent,
                data: { 
                  sessions: participationResult.sessions,
                  originalRequest: combinedContent,
                  participationDetails: participationDetails
                }
              });
              
              // Generate response asking for session selection
              response = await participationHandler.generateParticipationResponse(participationResult);
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            } else {
              // Something went wrong, clear the conversation state
              clearConversationState(message.author.id, message.channel.id);
              
              // Generate error response
              response = await participationHandler.generateParticipationResponse(participationResult);
              
              // Add the response to message history
              addMessageToHistory(message.author.id, message.channel.id, true, response);
              
              await message.reply(response);
            }
            
            // Log the conversation
            logData.botResponse = response;
            logData.success = actionSuccess;
            logData.errorInfo = actionSuccess ? null : (participationResult.error || "Participation error");
            logData.processingTimeMs = Date.now() - processingStart;
            await logConversation(client, logData);
            
            return; // Already sent response
          } else {
            // NEW participation request - no existing context
            const participationResult = await participationHandler.processParticipation(client, message);
            actionSuccess = participationResult.success;
            actionDetails = participationResult;
            
            if (participationResult.multipleMatches || participationResult.noExactMatch) {
              // Multiple matches found, store conversation state with participation details
              const participationDetails = await participationHandler.extractParticipationDetails(cleanContent);
              updateConversationState(message.author.id, message.channel.id, {
                intent: 'participation',
                previousContent: cleanContent,
                data: { 
                  sessions: participationResult.sessions,
                  originalRequest: cleanContent,
                  participationDetails: participationDetails
                }
              });
              logger.info(`[AI Assistant] Created participation conversation state with multiple sessions`);
            } else if (actionSuccess) {
              // Participation was successfully updated, clear any conversation state
              clearConversationState(message.author.id, message.channel.id);
            }
            
            // Generate response based on result
            response = await participationHandler.generateParticipationResponse(participationResult);
          }
          break;
          
        case 'schedule_info':
          // Process schedule info query
          const scheduleResult = await scheduleInfoHandler.processScheduleInfo({
            ...intent.details,
            guildId: message.guild?.id
          });
          
          actionSuccess = scheduleResult.success;
          actionDetails = scheduleResult;
          
          // Generate response based on result
          response = await scheduleInfoHandler.generateScheduleInfoResponse(scheduleResult, cleanContent);
          break;
          
        case 'banter':
          // Use full context for banter to maintain conversation flow
          // Pass the guild ID for sass level lookup
          response = await handleWithFullContext(cleanContent, channelType, history, message.guild?.id);
          actionSuccess = true;
          break;
          
        default:
          // Handle general conversation with full context and history
          // Pass the guild ID for sass level lookup
          response = await handleWithFullContext(cleanContent, channelType, history, message.guild?.id);
          actionSuccess = true;
      }
      
      // Send the response if we have one
      if (response) {
        await message.reply(response);
        
        // Add the bot's response to history
        addMessageToHistory(message.author.id, message.channel.id, true, response);
        
        // Update conversation state to maintain context
        updateConversationState(message.author.id, message.channel.id, {
          lastMessage: cleanContent,
          lastResponse: response,
          lastInteraction: Date.now()
        });
        
        logger.info(`[AI Assistant] Sent response for intent: ${intent.type} (success: ${actionSuccess})`);
        
        // Log the conversation
        logData.botResponse = response;
        logData.success = actionSuccess;
        logData.processingTimeMs = Date.now() - processingStart;
        await logConversation(client, logData);
      }
    } else {
      // For low confidence intents, fallback to full context
      logger.info(`[AI Assistant] Low confidence (${intent.confidence}), using fallback context handler`);
      
      // Use full context handler as fallback
      const response = await handleWithFullContext(cleanContent, channelType, history, message.guild?.id);
      
      if (response) {
        await message.reply(response);
        
        // Add the bot's response to history
        addMessageToHistory(message.author.id, message.channel.id, true, response);
        
        // Update conversation state to maintain context
        updateConversationState(message.author.id, message.channel.id, {
          lastMessage: cleanContent,
          lastResponse: response,
          lastInteraction: Date.now()
        });
        
        logger.info(`[AI Assistant] Sent general response (low confidence intent)`);
        
        // Log the conversation
        logData.botResponse = response;
        logData.success = true;
        logData.processingTimeMs = Date.now() - processingStart;
        await logConversation(client, logData);
      }
    }
    
  } catch (error) {
    logger.error('[AI Assistant] ❌ Error:', error);
    console.error('AI Assistant Error:', error);
    
    // Only reply with error if the original message was directed at the bot
    message.reply("Sorry, I'm having trouble processing that request right now. Please try again later or use slash commands instead.");
    
    // Try to log the error
    try {
      await logConversation(client, {
        userId: message.author.id,
        username: message.author.tag || message.author.username,
        guildId: message.guild?.id || 'dm',
        channelId: message.channel.id,
        userMessage: message.content,
        detectedIntent: 'error',
        intentConfidence: 0,
        success: false,
        errorInfo: error.message,
        processingTimeMs: 0
      });
    } catch (logError) {
      logger.error('[AI Assistant] Error logging conversation error:', logError);
    }
  }
}

// Export the main function and utilities
module.exports = { 
  processMessage,
  getConversationState,
  updateConversationState,
  clearConversationState,
  addMessageToHistory,
  getMessageHistory,
  handleWithFullContext,
  getChannelType,
  trackEventCreationAttempt,
  checkForFailedEventCreation,
  logConversation
};