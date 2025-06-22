// assistant/modules/participationHandler.js
const Session = require('../../models/Session');
const { OpenAI } = require('openai');
const promptLibrary = require('../promptLibrary');
const logger = require('../../utils/logger');
const emojiManager = require('../../utils/emojiManager');
const dateUtils = require('../../utils/dateUtils'); // Added import for date utilities

// Initialize OpenAI client
let openai;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  logger.error("Error initializing OpenAI client in participationHandler:", error);
}

/**
 * Check if a message is about participating in an event
 * @param {string} content - Message content
 * @returns {boolean} - True if the message appears to be about participation
 */
function isParticipationRequest(content) {
  const lowerContent = content.toLowerCase();
  
  // Keywords that suggest someone wants to join or leave an event
  const participationKeywords = [
    'count me in', 'i\'ll join', 'i\'ll be there', 'i can come', 
    'sign me up', 'put me down', 'i\'ll play', 'i can play',
    'add me', 'remove me', 'count me out', 'can\'t make it',
    'won\'t be able', 'i\'ll miss', 'i\'ll be late', 'won\'t be on time',
    'tentative', 'maybe', 'i might', 'backup', 'reserve',
    // Add these new phrases:
    'i\'ll come', 'coming', 'i am coming', 'i\'m coming', 'will come', 
    'i will come', 'i\'ll attend', 'attending', 'i am attending', 
    'i\'m in', 'i\'m attending', 'will attend', 'count me in'
  ];
  
  // Check if content contains participation keywords
  const hasParticipationIntent = participationKeywords.some(keyword => 
    lowerContent.includes(keyword)
  );
  
  // Check for role mentions
  const roleKeywords = ['tank', 'healer', 'heal', 'dps', 'damage'];
  const mentionsRole = roleKeywords.some(role => lowerContent.includes(role));
  
  // Check for WoW class mentions - expanded with abbreviations and nicknames
  const wowClasses = emojiManager.getWowClasses();
  const classAbbreviations = {
    'lock': 'warlock', 
    'demo lock': 'warlock',
    'destro lock': 'warlock',
    'affli lock': 'warlock',
    'drood': 'druid',
    'dk': 'deathknight',
    'dh': 'demonhunter',
    'pally': 'paladin',
    'priest': 'priest',
    'sp': 'priest',
    'shadow priest': 'priest'
    // add more as needed
  };
  
  let mentionsClass = wowClasses.some(className => lowerContent.includes(className.toLowerCase()));
  
  // If no direct class mention, check for abbreviations or nicknames
  if (!mentionsClass) {
    mentionsClass = Object.keys(classAbbreviations).some(abbr => lowerContent.includes(abbr));
  }
  
  // Check for specific event references - expanded with variations
  const eventReferenceKeywords = [
    'tonight', 'tomorrow', 'today', 'session', 'event', 'next', 
    'rbg', '2s', '3s', '2v2', '3v3', 
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];
  const referencesEvent = eventReferenceKeywords.some(ref => lowerContent.includes(ref));
  
  // Lower the requirements a bit - handle cases with event reference and participation intent 
  if (hasParticipationIntent && referencesEvent) {
    return true;
  }
  
  // Original logic as fallback
  return hasParticipationIntent && (mentionsRole || mentionsClass || referencesEvent);
}

/**
 * Extract participation details from message using AI
 * @param {string} content - Message content
 * @returns {Promise<Object>} - Extracted participation details
 */
async function extractParticipationDetails(content) {
  if (!openai) {
    throw new Error("OpenAI client not initialized");
  }
  
  try {
    // Get combined prompt focused on participation handling
    const systemPrompt = promptLibrary.getCombinedPrompt(['participation']);
    
    // Add specific instructions for extracting structured data
    const extractionPrompt = `
Extract the PvP session participation details from the following message. Return ONLY a JSON object with these fields:
- action: "join", "leave", "late", "tentative", or "backup"
- gameMode: "2v2", "3v3", or "RBGs" (if specified)
- timeReference: "today", "tomorrow", "next", or a day name like "monday" (if specified)
- specificDate: if a specific date is mentioned (in MM-DD format), or null if not specified
- role: "tank", "healer", "dps", or null (if not specified)
- wowClass: the WoW class mentioned, or null if not specified
- wowSpec: the specific specialization mentioned (e.g., "frost", "discipline", "havoc"), or null if not specified
- additionalNotes: any other relevant details they mentioned

Pay special attention to relative time references such as "tomorrow", "today", "tonight", "next", and specific days of the week.
Use "tomorrow" for phrases like "I'll come tomorrow" or "I'll be there tomorrow".
Use the specific day name (lowercase) for phrases like "I'll join Wednesday" or "I'll be there on Friday".
Use "today" for phrases like "I'll be there tonight" or "I'll join today".

If a field can't be determined, use null for that field. Try to infer the correct values from context.
Today's date is ${new Date().toLocaleDateString()}.

Message: "${content}"

Response (JSON only):`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: extractionPrompt }
      ],
      max_tokens: 500,
      temperature: 0.3 // Low temperature for more precise extraction
    });

    // Extract and parse the response
    const responseText = response.choices[0].message.content.trim();
    let extractedData;
    
    try {
      // Find the JSON object in the response
      const jsonMatch = responseText.match(/(\{.*\})/s);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(responseText);
      }
    } catch (parseError) {
      logger.error("Error parsing JSON from AI response", parseError);
      logger.info("Raw AI response:", responseText);
      // Fallback to null values if JSON parsing fails
      extractedData = {
        action: null,
        gameMode: null,
        timeReference: null,
        specificDate: null,
        role: null,
        wowClass: null,
        wowSpec: null,
        additionalNotes: null
      };
    }
    
    // If we have a class and spec, we can determine the role
    if (extractedData.wowClass && extractedData.wowSpec && !extractedData.role) {
      try {
        const inferredRole = emojiManager.getSpecRole(extractedData.wowClass, extractedData.wowSpec);
        if (inferredRole) {
          logger.info(`Inferred role ${inferredRole} from class ${extractedData.wowClass} and spec ${extractedData.wowSpec}`);
          extractedData.role = inferredRole;
        }
      } catch (roleError) {
        logger.error("Error inferring role from class/spec:", roleError);
      }
    }
    
    return extractedData;
  } catch (error) {
    logger.error("Error extracting participation details:", error);
    throw error;
  }
}

/**
 * Find the most relevant session based on participation details
 * @param {Object} details - Extracted participation details
 * @param {string} guildId - The guild ID where the request was made
 * @returns {Promise<Object|Array>} - Most relevant session, array of sessions if multiple matches, or null if none found
 */
async function findRelevantSession(details, guildId) {
  try {
    // Get current date/time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Build query for upcoming sessions
    const query = { 
      date: { $gt: now },
      guildId: guildId // Add guild ID to query to ensure we only find sessions in the current guild
    };
    
    // Add game mode filter if specified
    if (details.gameMode) {
      query.gameMode = details.gameMode;
    }
    
    // Handle time reference if specified
    if (details.timeReference || details.specificDate) {
      // If specific date is provided, use it
      if (details.specificDate) {
        // Parse the specific date
        const [month, day] = details.specificDate.split('-').map(Number);
        const year = new Date().getFullYear();
        
        let targetDate = new Date(year, month - 1, day);
        
        // If the date is in the past, assume it's next year
        if (targetDate < today) {
          targetDate = new Date(year + 1, month - 1, day);
        }
        
        const endOfTargetDay = new Date(targetDate);
        endOfTargetDay.setDate(endOfTargetDay.getDate() + 1);
        
        query.date = { $gte: targetDate, $lt: endOfTargetDay };
      } else if (details.timeReference === 'today') {
        // Today
        const endOfToday = new Date(today);
        endOfToday.setDate(endOfToday.getDate() + 1);
        
        query.date = { $gte: today, $lt: endOfToday };
      } else if (details.timeReference === 'tomorrow') {
        // Tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const endOfTomorrow = new Date(tomorrow);
        endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
        
        query.date = { $gte: tomorrow, $lt: endOfTomorrow };
      } else if (details.timeReference === 'next') {
        // Just use the next upcoming session (no date filter change)
      } else {
        // Day name like "monday", "tuesday", etc.
        const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(details.timeReference);
        if (dayIndex !== -1) {
          let targetDate = new Date(today);
          const currentDayIndex = targetDate.getDay();
          
          // Calculate days to add to get to the target day
          let daysToAdd = (dayIndex - currentDayIndex);
          if (daysToAdd <= 0) daysToAdd += 7; // If it's in the past or today, go to next week
          
          targetDate.setDate(targetDate.getDate() + daysToAdd);
          
          const endOfTargetDay = new Date(targetDate);
          endOfTargetDay.setDate(endOfTargetDay.getDate() + 1);
          
          query.date = { $gte: targetDate, $lt: endOfTargetDay };
          logger.info(`Looking for sessions on ${details.timeReference}: ${targetDate.toISOString()} to ${endOfTargetDay.toISOString()}`);
        }
      }
    }
    
    // Log the final query for debugging
    logger.info(`Session search query: ${JSON.stringify(query)}`);
    
    // Get sessions, sorted by date (closest first)
    const sessions = await Session.find(query).sort({ date: 1 }).limit(5);
    logger.info(`Found ${sessions.length} matching sessions`);
    
    // If we found multiple sessions that match the criteria, return them all for disambiguation
    if (sessions.length > 1) {
      return {
        multipleMatches: true,
        sessions: sessions
      };
    }
    
    // If we found exactly one session, return it
    if (sessions.length === 1) {
      return sessions[0];
    }
    
    // If no sessions found with the specific criteria, try a more relaxed search
    if (sessions.length === 0) {
      // Remove the date filter and just look for upcoming sessions
      const relaxedQuery = { date: { $gt: now }, guildId: guildId };
      if (details.gameMode) relaxedQuery.gameMode = details.gameMode;
      
      const relaxedSessions = await Session.find(relaxedQuery).sort({ date: 1 }).limit(3);
      logger.info(`Found ${relaxedSessions.length} sessions with relaxed criteria`);
      
      if (relaxedSessions.length > 0) {
        return {
          noExactMatch: true,
          sessions: relaxedSessions
        };
      }
    }
    
    // If still no sessions found, return null
    return null;
  } catch (error) {
    logger.error("Error finding relevant session:", error);
    throw error;
  }
}

/**
 * Update user participation in a session
 * @param {Object} session - Session to update
 * @param {Object} details - Participation details
 * @param {Object} user - Discord user object
 * @returns {Promise<Object>} - Updated session
 */
async function updateParticipation(session, details, user) {
  try {
    // Map action to status
    const statusMap = {
      'join': 'attending',
      'leave': 'not attending',
      'late': 'late',
      'tentative': 'tentative',
      'backup': 'backup'
    };
    
    const status = statusMap[details.action] || 'attending';
    
    // Standardize role
    let role = details.role;
    if (role === 'heal') role = 'healer';
    if (role === 'damage') role = 'dps';
    
    // Normalize class names
    let wowClass = details.wowClass;
    if (wowClass) {
      // Convert to lowercase for comparison
      const lowerClass = wowClass.toLowerCase();
      
      // Map of potential variations to standardized class names
      const classMap = {
        'dk': 'death knight',
        'deathknight': 'death knight',
        'dh': 'demon hunter',
        'demonhunter': 'demon hunter',
        'lock': 'warlock',
        'drood': 'druid',
        'moonkin': 'druid',
        'tree': 'druid',
        'cat': 'druid',
        'bear': 'druid',
        'pally': 'paladin',
        'pala': 'paladin',
        'resto': 'shaman', // This is ambiguous - could also be druid
        'disc': 'priest',
        'holy': 'priest', // This is ambiguous - could also be paladin
        'shadow': 'priest',
        'spriest': 'priest',
        'ele': 'shaman',
        'elemental': 'shaman',
        'enhance': 'shaman',
        'enhancement': 'shaman',
        'mage': 'mage',
        'fire': 'mage',
        'frost': 'mage',
        'arcane': 'mage',
        'destro': 'warlock',
        'destruction': 'warlock',
        'affli': 'warlock',
        'affliction': 'warlock',
        'demo': 'warlock',
        'demonology': 'warlock',
        'mm': 'hunter',
        'bm': 'hunter',
        'survival': 'hunter'
      };
      
      // Replace with standard name if a match is found
      if (classMap[lowerClass]) {
        wowClass = classMap[lowerClass];
      }
    }
    
    // Normalize spec names and handle spec-class mapping
    let wowSpec = details.wowSpec;
    if (wowSpec && wowClass) {
      // Convert to lowercase for comparison
      const lowerSpec = wowSpec.toLowerCase();
      
      // Class-specific spec mappings
      const specMap = {
        'frost': 'frost',
        'fire': 'fire',
        'arcane': 'arcane',
        'discipline': 'discipline',
        'disc': 'discipline',
        'holy': 'holy',
        'shadow': 'shadow',
        'resto': 'restoration',
        'restoration': 'restoration',
        'elemental': 'elemental',
        'ele': 'elemental',
        'enhancement': 'enhancement',
        'enhance': 'enhancement',
        'destruction': 'destruction',
        'destro': 'destruction',
        'affliction': 'affliction',
        'affli': 'affliction',
        'demonology': 'demonology',
        'demo': 'demonology'
      };
      
      wowSpec = specMap[lowerSpec] || wowSpec;
    }
    
    // Find existing gamer entry
    const existingGamerIndex = session.gamers.findIndex(gamer => gamer.userId === user.id);
    
    if (existingGamerIndex !== -1) {
      // Update existing entry
      session.gamers[existingGamerIndex].status = status;
      session.gamers[existingGamerIndex].username = user.username || user.tag;
      
      // Update role/class/spec if provided
      if (role) session.gamers[existingGamerIndex].role = role;
      if (wowClass) session.gamers[existingGamerIndex].wowClass = wowClass;
      if (wowSpec) session.gamers[existingGamerIndex].wowSpec = wowSpec;
      
      session.gamers[existingGamerIndex].timestamp = new Date();
    } else {
      // Create new gamer entry
      const newGamer = {
        userId: user.id,
        username: user.username || user.tag,
        status: status,
        role: role || '',
        wowClass: wowClass || '',
        wowSpec: wowSpec || '',
        reason: '',
        timestamp: new Date()
      };
      
      session.gamers.push(newGamer);
    }
    
    // Save the updated session
    await session.save();
    
    return session;
  } catch (error) {
    logger.error("Error updating participation:", error);
    throw error;
  }
}

/**
 * Process participation request from natural language
 * @param {Object} client - Discord client
 * @param {Object} message - Discord message object
 * @returns {Promise<Object>} - Result of processing {success, session, details}
 */
async function processParticipation(client, message) {
  try {
    // IMPORTANT: Get guild ID from the message
    const guildId = message.guild?.id;
    
    // Enhanced logging to track the issue
    logger.info(`Processing participation from message: "${message.content}"`);
    logger.info(`Guild ID from message: ${guildId || 'Not available'}`);
    
    // Check if we have a guild ID
    if (!guildId) {
      logger.error("Cannot process participation: Missing guild ID in message");
      return {
        success: false,
        error: "Missing guild ID. This participation request must be made in a server."
      };
    }
    
    // Extract participation details from the message
    const extractedDetails = await extractParticipationDetails(message.content);
    logger.info(`Extracted participation details: ${JSON.stringify(extractedDetails)}`);
    
    // Validate that we have at least an action
    if (!extractedDetails.action) {
      return {
        success: false,
        error: "Couldn't determine if you want to join or leave an event"
      };
    }
    
    // Find the most relevant session
    logger.info(`Finding relevant session for criteria: ${JSON.stringify({
      gameMode: extractedDetails.gameMode,
      timeReference: extractedDetails.timeReference,
      guildId: guildId
    })}`);
    
    const sessionResult = await findRelevantSession(extractedDetails, guildId);
    
    // If no session found, return error
    if (!sessionResult) {
      logger.warn("No relevant session found for participation request");
      return {
        success: false,
        error: "No upcoming sessions found matching your criteria"
      };
    }
    
    // Handle multiple matching sessions
    if (sessionResult.multipleMatches) {
      logger.info(`Found multiple matching sessions (${sessionResult.sessions.length})`);
      
      // Format sessions for display
      const formattedSessions = sessionResult.sessions.map((s, index) => {
        const sessionDate = new Date(s.date);
        const dateString = sessionDate.toLocaleDateString();
        const timeString = sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${index + 1}. ${s.gameMode} on ${dateString} at ${timeString}`;
      }).join('\n');
      
      return {
        success: false,
        multipleMatches: true,
        sessions: sessionResult.sessions,
        formattedSessions,
        error: "Found multiple matching sessions. Please specify which one you mean."
      };
    }
    
    // Handle case where we found sessions but not an exact match
    if (sessionResult.noExactMatch) {
      logger.info(`No exact match but found ${sessionResult.sessions.length} alternatives`);
      
      // Format sessions for display
      const formattedSessions = sessionResult.sessions.map((s, index) => {
        const sessionDate = new Date(s.date);
        const dateString = sessionDate.toLocaleDateString();
        const timeString = sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${index + 1}. ${s.gameMode} on ${dateString} at ${timeString}`;
      }).join('\n');
      
      return {
        success: false,
        noExactMatch: true,
        sessions: sessionResult.sessions,
        formattedSessions,
        error: "Couldn't find an exact match. Here are the upcoming sessions."
      };
    }
    
    // We have a single matching session
    const session = sessionResult;
    logger.info(`Found session: ${session.sessionId} for ${session.gameMode} on ${new Date(session.date).toLocaleString()}`);
    
    // Update the user's participation
    logger.info(`Updating participation: User ${message.author.id}, Action: ${extractedDetails.action}, Role: ${extractedDetails.role}, Class: ${extractedDetails.wowClass}`);
    const updatedSession = await updateParticipation(session, extractedDetails, message.author);
    logger.info(`Participation updated successfully for session ${session.sessionId}`);
    
    // Update the session display
    try {
      logger.info(`Attempting to update session display for ${session.sessionId}`);
      
      // Import directly from the service instead of interactionCreate
      try {
        const { updateSessionDisplay } = require('../../utils/sessionDisplayService');
        await updateSessionDisplay(client, updatedSession); // UPDATED: Pass full session object
        logger.info("Session display updated via sessionDisplayService");
      } catch (importError) {
        logger.error("Error importing updateSessionDisplay:", importError);
        
        // Fallback manual update if the import fails
        try {
          const displayChannelId = process.env.DISPLAY_CHANNEL_ID;
          if (displayChannelId) {
            const displayChannel = await client.channels.fetch(displayChannelId);
            
            if (displayChannel) {
              // Try to find existing message for this session
              const messages = await displayChannel.messages.fetch({ limit: 50 });
              const sessionMessage = messages.find(msg => 
                msg.embeds.length > 0 && 
                msg.embeds[0].footer && 
                msg.embeds[0].footer.text && 
                msg.embeds[0].footer.text.includes(session.sessionId)
              );
              
              if (sessionMessage) {
                // Get the constructSessionEmbed function
                const { constructSessionEmbed } = require('../../events/handlers/embedBuilder');
                // Get the createSessionButtons function
                const { createSessionButtons } = require('../../events/handlers/sessionHandlers');
                
                // Always refetch the session to get latest data
                const refreshedSession = await Session.findOne({ sessionId: session.sessionId });
                if (!refreshedSession) {
                  logger.error(`Failed to find session ${session.sessionId} for display update`);
                  return;
                }
                
                // Update the existing message
                const embed = await constructSessionEmbed(client, refreshedSession);
                const buttons = createSessionButtons(refreshedSession.sessionId);
                
                await sessionMessage.edit({
                  embeds: [embed],
                  components: buttons
                });
                
                logger.info("Session display updated manually");
              }
            }
          }
        } catch (manualError) {
          logger.error("Error with manual display update:", manualError);
        }
      }
    } catch (displayError) {
      logger.error("Error updating session display:", displayError);
      // Continue even if display update fails
    }
    
    return {
      success: true,
      session: updatedSession,
      details: extractedDetails
    };
  } catch (error) {
    logger.error("Error in processParticipation:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Resolve an ambiguous session reference using pre-extracted participation details
 * @param {Object} client - Discord client
 * @param {Object} message - Discord message object (the number selection message)
 * @param {number} sessionIndex - Index of the selected session (1-based)
 * @param {Array} sessions - Array of session objects to choose from
 * @param {Object} participationDetails - Pre-extracted participation details from original request
 * @returns {Promise<Object>} - Result of processing the selected session
 */
async function resolveAmbiguousSessionWithDetails(client, message, sessionIndex, sessions, participationDetails) {
  try {
    // Validate the index
    if (sessionIndex < 1 || sessionIndex > sessions.length) {
      return {
        success: false,
        error: `Invalid selection. Please choose a number between 1 and ${sessions.length}.`
      };
    }
    
    // Get the selected session
    const selectedSession = sessions[sessionIndex - 1];
    
    // Use the pre-extracted participation details
    const extractedDetails = participationDetails;
    
    // If we still don't have an action, default to 'join'
    if (!extractedDetails.action) {
      logger.warn("No action found in stored participation details, defaulting to 'join'");
      extractedDetails.action = 'join';
    }
    
    logger.info(`Resolving session selection: User ${message.author.id} selected session ${sessionIndex} (${selectedSession.sessionId})`);
    logger.info(`Using stored participation details: ${JSON.stringify(extractedDetails)}`);
    
    // Update the user's participation
    const updatedSession = await updateParticipation(selectedSession, extractedDetails, message.author);
    
    // Update the session display
    try {
      const { updateSessionDisplay } = require('../../utils/sessionDisplayService');
      await updateSessionDisplay(client, updatedSession);
      logger.info(`Session display updated for ${selectedSession.sessionId}`);
    } catch (error) {
      logger.error("Error updating session display:", error);
    }
    
    return {
      success: true,
      session: updatedSession,
      details: extractedDetails
    };
  } catch (error) {
    logger.error("Error resolving ambiguous session with details:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Resolve an ambiguous session reference
 * @param {Object} client - Discord client
 * @param {Object} message - Discord message object with the ORIGINAL participation request
 * @param {number} sessionIndex - Index of the selected session (1-based)
 * @param {Array} sessions - Array of session objects to choose from
 * @returns {Promise<Object>} - Result of processing the selected session
 */
async function resolveAmbiguousSession(client, message, sessionIndex, sessions) {
  try {
    // Validate the index
    if (sessionIndex < 1 || sessionIndex > sessions.length) {
      return {
        success: false,
        error: `Invalid selection. Please choose a number between 1 and ${sessions.length}.`
      };
    }
    
    // Get the selected session
    const selectedSession = sessions[sessionIndex - 1];
    
    // Extract participation details from the ORIGINAL message content (not just the number)
    // The message should contain the original participation request
    const extractedDetails = await extractParticipationDetails(message.content);
    
    // If we couldn't extract details from the original message, provide defaults
    if (!extractedDetails.action) {
      logger.warn("Could not extract participation details from original message, defaulting to 'join'");
      extractedDetails.action = 'join'; // Default action
    }
    
    logger.info(`Resolving session selection: User ${message.author.id} selected session ${sessionIndex} (${selectedSession.sessionId})`);
    logger.info(`Using participation details: ${JSON.stringify(extractedDetails)}`);
    
    // Update the user's participation
    const updatedSession = await updateParticipation(selectedSession, extractedDetails, message.author);
    
    // Update the session display
    try {
      const { updateSessionDisplay } = require('../../utils/sessionDisplayService');
      await updateSessionDisplay(client, updatedSession);
      logger.info(`Session display updated for ${selectedSession.sessionId}`);
    } catch (error) {
      logger.error("Error updating session display:", error);
    }
    
    return {
      success: true,
      session: updatedSession,
      details: extractedDetails
    };
  } catch (error) {
    logger.error("Error resolving ambiguous session:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate AI response for participation update result
 * @param {Object} result - Result of participation update
 * @returns {Promise<string>} - AI response text
 */
async function generateParticipationResponse(result) {
  if (!openai) {
    if (result.multipleMatches || result.noExactMatch) {
      return `I found multiple sessions that could match. Please specify which one:\n${result.formattedSessions}\nReply with the number of the session you want to join.`;
    }
    
    return result.success 
      ? "✅ Your participation status has been updated!" 
      : "❌ Failed to update your participation status.";
  }
  
  try {
    // Get combined prompt focused on participation and banter
    const systemPrompt = promptLibrary.getCombinedPrompt(['participation', 'banter']);
    
    // Create prompt based on result
    let userPrompt;
    
    if (result.success) {
      const session = result.session;
      const details = result.details;
      const formattedDate = new Date(session.date).toLocaleDateString();
      const formattedTime = new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Find the updated user in the gamers array
      const updatedUser = session.gamers.find(g => g.userId === result.session.gamers[result.session.gamers.length - 1].userId);
      
      userPrompt = `
I've updated the user's participation for the ${session.gameMode} event on ${formattedDate} at ${formattedTime}.
- Their action: ${details.action}
- Their new status: ${updatedUser.status}
- Their role: ${updatedUser.role || details.role || 'Not specified'}
- Their WoW class: ${updatedUser.wowClass || details.wowClass || 'Not specified'}
- Their WoW spec: ${updatedUser.wowSpec || details.wowSpec || 'Not specified'}

Current session details:
- Game mode: ${session.gameMode}
- Total participants: ${session.gamers.filter(g => g.status === 'attending').length}
- Total tanks: ${session.gamers.filter(g => g.status === 'attending' && g.role === 'tank').length}
- Total healers: ${session.gamers.filter(g => g.status === 'attending' && g.role === 'healer').length}
- Total DPS: ${session.gamers.filter(g => g.status === 'attending' && g.role === 'dps').length}

Write a response confirming their participation update. Be sarcastic and include some humor related to their class/spec/role if specified. For example:
- If they're a frost mage, joke about how they'll just press Ice Block and hope their teammates carry
- If they're a tank, mention something about how they'll need to actually use defensive cooldowns in PvP
- If they're a healer, make a joke about how they'll be blamed for everything

If they're joining as a specific spec, make a joke about that spec's reputation in PvP. Be creative and edgy!`;
    } 
    else if (result.multipleMatches || result.noExactMatch) {
      userPrompt = `I found multiple sessions that might match what the user is looking for. Here they are:
${result.formattedSessions}

Write a response that lists these sessions and asks the user to clarify which one they meant. Make it conversational and include some WoW-themed humor. Instruct them to reply with the number of the session they want to join.`;
    } 
    else {
      userPrompt = `I tried to update their participation but encountered an error: ${result.error || 'Unknown error'}. 

Write a response explaining the issue and suggesting they try again with more details or use the buttons in the event post instead. Include some WoW-themed humor that makes it clear I'm disappointed they won't be joining us.`;
    }
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0.9 // Higher temperature for more creative responses
    });
    
    // Return the AI's response text
    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error("Error generating participation response:", error);
    
    // Fallback response
    if (result.multipleMatches || result.noExactMatch) {
      return `I found multiple sessions that could match. Please specify which one:\n${result.formattedSessions}\nReply with the number of the session you want to join.`;
    }
    
    return result.success 
      ? "✅ Your participation status has been updated!" 
      : "❌ Failed to update your participation status.";
  }
}

module.exports = {
  isParticipationRequest,
  extractParticipationDetails,
  processParticipation,
  generateParticipationResponse,
  resolveAmbiguousSession,
  resolveAmbiguousSessionWithDetails,  // NEW: Add the new function
  findRelevantSession
};