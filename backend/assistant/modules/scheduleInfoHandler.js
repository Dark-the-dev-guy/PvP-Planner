// assistant/modules/scheduleInfoHandler.js
const Session = require('../../models/Session');
const { OpenAI } = require('openai');
const promptLibrary = require('../promptLibrary');
const logger = require('../../utils/logger');
const dateUtils = require('../../utils/dateUtils');

// Initialize OpenAI client
let openai;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  logger.error("Error initializing OpenAI client in scheduleInfoHandler:", error);
}

/**
 * Check if a message is asking about schedule information
 * @param {string} content - Message content
 * @returns {Object} - Contains information about the schedule query
 */
function isScheduleInfoQuery(content) {
  const lowerContent = content.toLowerCase();
  
  // Keywords that indicate schedule queries
  const scheduleKeywords = [
    'when', 'next', 'upcoming', 'schedule', 'planned', 'happening',
    'what time', 'what day', 'calendar', 'events', 'any games',
    'sessions', 'playing', 'running'
  ];
  
  // Keywords that indicate participant queries
  const participantKeywords = [
    'who', 'signed up', 'going', 'attending', 'coming', 'players',
    'participants', 'roster', 'attendance', 'join', 'whose'
  ];
  
  // Check for query types
  const isScheduleQuestion = scheduleKeywords.some(keyword => 
    lowerContent.includes(keyword)
  );
  
  const isParticipantQuestion = participantKeywords.some(keyword => 
    lowerContent.includes(keyword)
  );
  
  // Determine game mode if mentioned
  let gameMode = null;
  if (lowerContent.includes('2v2') || /\b2s\b/.test(lowerContent)) {
    gameMode = '2v2';
  } else if (lowerContent.includes('3v3') || /\b3s\b/.test(lowerContent)) {
    gameMode = '3v3';
  } else if (lowerContent.includes('rbg') || lowerContent.includes('rated bg')) {
    gameMode = 'RBGs';
  }
  
  // Check if asking about specific session by time or day
  let timeReference = null;
  if (lowerContent.includes('tonight') || lowerContent.includes('today')) {
    timeReference = 'today';
  } else if (lowerContent.includes('tomorrow')) {
    timeReference = 'tomorrow';
  } else if (lowerContent.includes('monday')) {
    timeReference = 'monday';
  } else if (lowerContent.includes('tuesday')) {
    timeReference = 'tuesday';
  } else if (lowerContent.includes('wednesday')) {
    timeReference = 'wednesday';
  } else if (lowerContent.includes('thursday')) {
    timeReference = 'thursday';
  } else if (lowerContent.includes('friday')) {
    timeReference = 'friday';
  } else if (lowerContent.includes('saturday')) {
    timeReference = 'saturday';
  } else if (lowerContent.includes('sunday')) {
    timeReference = 'sunday';
  } else if (lowerContent.includes('next')) {
    timeReference = 'next';
  }
  
  return {
    isScheduleQuery: isScheduleQuestion,
    isParticipantQuery: isParticipantQuestion,
    gameMode,
    timeReference
  };
}

/**
 * Get upcoming sessions based on query parameters
 * @param {Object} queryParams - Parameters to filter sessions
 * @returns {Promise<Array>} - Array of matching sessions
 */
async function getUpcomingSessions(queryParams = {}) {
  try {
    // Get current date/time
    const now = new Date();
    
    // Build query for upcoming sessions
    const query = { date: { $gt: now } };
    
    // CRITICAL FIX: Add guild ID filter to ensure we only show events from the current guild
    if (queryParams.guildId) {
      query.guildId = queryParams.guildId;
    }
    
    // Add game mode filter if specified
    if (queryParams.gameMode) {
      query.gameMode = queryParams.gameMode;
    }
    
    // Handle time reference if specified
    if (queryParams.timeReference) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (queryParams.timeReference === 'today') {
        const endOfDay = new Date(today);
        endOfDay.setDate(endOfDay.getDate() + 1);
        query.date = { $gte: now, $lt: endOfDay };
      } else if (queryParams.timeReference === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const endOfTomorrow = new Date(tomorrow);
        endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
        query.date = { $gte: tomorrow, $lt: endOfTomorrow };
      } else if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(queryParams.timeReference)) {
        // Find the next occurrence of the specified day
        const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(queryParams.timeReference);
        if (dayIndex !== -1) {
          let targetDate = new Date(today);
          const currentDayIndex = targetDate.getDay();
          
          // Calculate days to add to get to the target day
          const daysToAdd = (dayIndex + 7 - currentDayIndex) % 7;
          targetDate.setDate(targetDate.getDate() + daysToAdd);
          
          const endOfTargetDay = new Date(targetDate);
          endOfTargetDay.setDate(endOfTargetDay.getDate() + 1);
          
          query.date = { $gte: targetDate, $lt: endOfTargetDay };
        }
      }
    }
    
    // Log the query for debugging
    logger.info(`[Schedule Info] Finding sessions with query: ${JSON.stringify(query)}`);
    
    // Get sessions, sorted by date
    const sessions = await Session.find(query).sort({ date: 1 }).limit(5);
    
    logger.info(`[Schedule Info] Found ${sessions.length} matching sessions`);
    
    return sessions;
  } catch (error) {
    logger.error("Error fetching upcoming sessions:", error);
    throw error;
  }
}

/**
 * Format session information for display
 * @param {Array} sessions - Array of session objects
 * @param {boolean} includeParticipants - Whether to include participant details
 * @returns {string} - Formatted session information
 */
function formatSessionInfo(sessions, includeParticipants = false) {
  if (!sessions || sessions.length === 0) {
    return "There are no upcoming sessions scheduled.";
  }
  
  let formattedInfo = "";
  
  sessions.forEach(session => {
    // Format date/time information using dateUtils
    const { dayOfWeek, formattedTime } = dateUtils.formatDateForDisplay(session.date);
    const timeUntil = dateUtils.getTimeUntil(session.date);
    
    // Count participants by status
    const attending = session.gamers.filter(g => g.status === 'attending').length;
    const late = session.gamers.filter(g => g.status === 'late').length;
    const tentative = session.gamers.filter(g => g.status === 'tentative').length;
    
    // Count roles (for attending players)
    const tanks = session.gamers.filter(g => g.status === 'attending' && g.role === 'tank').length;
    const healers = session.gamers.filter(g => g.status === 'attending' && g.role === 'healer').length;
    const dps = session.gamers.filter(g => g.status === 'attending' && g.role === 'dps').length;
    
    // Format basic session information
    formattedInfo += `**${session.gameMode} on ${dayOfWeek} at ${formattedTime}** (${timeUntil})\n`;
    formattedInfo += `👥 Players: ${attending} attending | ${late} late | ${tentative} tentative\n`;
    formattedInfo += `🧩 Roles: ${tanks} tanks | ${healers} healers | ${dps} DPS\n`;
    
    // Add notes if they exist
    if (session.notes) {
      formattedInfo += `📝 Notes: ${session.notes}\n`;
    }
    
    // Add participant details if requested
    if (includeParticipants && attending > 0) {
      formattedInfo += "\n**Attending players:**\n";
      
      // First list tanks
      const tankPlayers = session.gamers.filter(g => g.status === 'attending' && g.role === 'tank');
      if (tankPlayers.length > 0) {
        formattedInfo += "🛡️ **Tanks:**\n";
        tankPlayers.forEach(player => {
          formattedInfo += `- ${player.username}${player.wowClass ? ` (${player.wowClass})` : ''}\n`;
        });
      }
      
      // Then healers
      const healerPlayers = session.gamers.filter(g => g.status === 'attending' && g.role === 'healer');
      if (healerPlayers.length > 0) {
        formattedInfo += "💚 **Healers:**\n";
        healerPlayers.forEach(player => {
          formattedInfo += `- ${player.username}${player.wowClass ? ` (${player.wowClass})` : ''}\n`;
        });
      }
      
      // Then DPS
      const dpsPlayers = session.gamers.filter(g => g.status === 'attending' && g.role === 'dps');
      if (dpsPlayers.length > 0) {
        formattedInfo += "⚔️ **DPS:**\n";
        dpsPlayers.forEach(player => {
          formattedInfo += `- ${player.username}${player.wowClass ? ` (${player.wowClass})` : ''}\n`;
        });
      }
      
      // Players without a role
      const noRolePlayers = session.gamers.filter(g => g.status === 'attending' && (!g.role || g.role === ''));
      if (noRolePlayers.length > 0) {
        formattedInfo += "❓ **No role selected:**\n";
        noRolePlayers.forEach(player => {
          formattedInfo += `- ${player.username}${player.wowClass ? ` (${player.wowClass})` : ''}\n`;
        });
      }
    }
    
    formattedInfo += `\n`;
  });
  
  return formattedInfo;
}

/**
 * Process a schedule information request
 * @param {Object} queryParams - Query parameters
 * @returns {Promise<Object>} - Processing result with sessions and formatted info
 */
async function processScheduleInfo(queryParams) {
  try {
    // Ensure we have the guildId for filtering
    if (!queryParams.guildId) {
      logger.warn("Missing guildId in schedule info query");
    }
    
    // Get upcoming sessions based on query parameters
    const sessions = await getUpcomingSessions(queryParams);
    
    // Format session information
    const includeParticipants = queryParams.isParticipantQuery;
    const formattedInfo = formatSessionInfo(sessions, includeParticipants);
    
    return {
      success: true,
      sessions,
      formattedInfo
    };
  } catch (error) {
    logger.error("Error processing schedule info:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate AI response for schedule information
 * @param {Object} result - Schedule info processing result
 * @param {string} userQuery - Original user query
 * @returns {Promise<string>} - AI response text
 */
async function generateScheduleInfoResponse(result, userQuery) {
  if (!openai) {
    return result.success 
      ? result.formattedInfo 
      : "Failed to retrieve schedule information.";
  }
  
  try {
    // Get combined prompt focused on schedule info and banter
    const systemPrompt = promptLibrary.getCombinedPrompt(['schedule', 'banter']);
    
    // Create prompt based on result
    let userPrompt;
    
    if (result.success) {
      userPrompt = `The user asked: "${userQuery}"

Here's the schedule information:
${result.formattedInfo}

Generate a response that answers their query with the above schedule information. Be engaging, a bit sarcastic, and use WoW PvP slang. If there's something noteworthy about the schedule (like no tanks signed up or all healers), point it out with humor. 

If they're asking who's coming, focus on the participant details. If they're asking when events are happening, focus on the timing. Make sure your tone is friendly but with attitude.`;
    } else {
      userPrompt = `The user asked about the schedule but I encountered an error: ${result.error || 'Unknown error'}. 

Generate a response apologizing for not having schedule info and suggesting they use /viewcalendar to see upcoming events. Add some self-deprecating WoW-themed humor.`;
    }
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    
    // Return the AI's response text
    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error("Error generating schedule info response:", error);
    
    // Fallback response
    return result.success 
      ? result.formattedInfo 
      : "Failed to retrieve schedule information.";
  }
}

module.exports = {
  isScheduleInfoQuery,
  getUpcomingSessions,
  processScheduleInfo,
  generateScheduleInfoResponse
};