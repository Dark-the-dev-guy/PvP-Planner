// assistant/modules/eventCreator.js
const Session = require('../../models/Session');
const { v4: uuidv4 } = require('uuid');
const dateUtils = require('../../utils/dateUtils');
const { OpenAI } = require('openai');
const promptLibrary = require('../promptLibrary');
const logger = require('../../utils/logger');

// Initialize OpenAI client
let openai;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  logger.error("Error initializing OpenAI client in eventCreator:", error);
}

/**
 * Check if a message is asking to create a new event
 * @param {string} content - Message content
 * @returns {boolean} - True if the message appears to be an event creation request
 */
function isEventCreationRequest(content) {
  const lowerContent = content.toLowerCase();
  
  // Keywords that suggest event creation
  const creationKeywords = [
    'schedule', 'create', 'set up', 'organize', 'plan', 'let\'s do', 
    'let\'s run', 'can we do', 'should we do', 'when can we'
  ];
  
  // Game modes that would indicate PvP sessions
  const gameModeKeywords = ['2v2', '2s', '3v3', '3s', 'threes', 'twos', 'rbg', 'rbgs', 'rated'];
  
  // Check if any creation keyword is present
  const hasCreationIntent = creationKeywords.some(keyword => 
    lowerContent.includes(keyword)
  );
  
  // Check if any game mode is mentioned
  const mentionsGameMode = gameModeKeywords.some(mode => 
    lowerContent.includes(mode)
  );
  
  // Time indicators that would suggest scheduling
  const hasTimeIndicator = lowerContent.includes('tonight') || 
                          lowerContent.includes('tomorrow') || 
                          lowerContent.includes('am') || 
                          lowerContent.includes('pm') ||
                          /\d{1,2}:\d{2}/.test(lowerContent) || // HH:MM format
                          /\d{1,2}(am|pm)/.test(lowerContent) || // HAM/PM format
                          /\d{1,2} ?(am|pm)/.test(lowerContent); // H AM/PM format with optional space
  
  // Day indicators
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const mentionsDay = dayNames.some(day => lowerContent.includes(day));
  
  // Consider it a creation request if it has creation intent AND (mentions game mode OR has time/day indicators)
  return hasCreationIntent && (mentionsGameMode || hasTimeIndicator || mentionsDay);
}

/**
 * Extract event details from message using AI
 * @param {string} content - Message content
 * @param {Object} contextData - Optional context data from previous conversation
 * @returns {Promise<Object>} - Extracted event details
 */
async function extractEventDetails(content, contextData = {}) {
  if (!openai) {
    throw new Error("OpenAI client not initialized");
  }
  
  try {
    // Get combined prompt focused on event creation
    const systemPrompt = promptLibrary.getCombinedPrompt(['event']);
    
    // Add specific instructions for extracting structured data
    let extractionPrompt = `
Extract the PvP session details from the following message. Return ONLY a JSON object with these fields:
- gameMode: "2v2", "3v3", or "RBGs" (based on context)
- date: in MM-DD-YY format (convert from any date reference)
- time: in HH:MM 24-hour format (convert from any time reference)
- notes: any additional notes or empty string
- tier: "main" or "alt" if specified (for RBGs only)

If a field is missing or unclear, use null for that field.
Infer the details as best you can from context. If they mention "tomorrow" or a day of week, calculate the actual date.
For tier, check if they mention "main" or "alt" characters, "main run", "alt run", etc.
Today's date is ${new Date().toLocaleDateString()}.
`;

    // If we have context data, include it in the prompt
    if (contextData && Object.keys(contextData).length > 0) {
      extractionPrompt += `\nI already have some partial details from previous messages:\n`;
      if (contextData.gameMode) extractionPrompt += `- Game Mode: ${contextData.gameMode}\n`;
      if (contextData.date) extractionPrompt += `- Date: ${contextData.date}\n`;
      if (contextData.time) extractionPrompt += `- Time: ${contextData.time}\n`;
      if (contextData.notes) extractionPrompt += `- Notes: ${contextData.notes}\n`;
      if (contextData.tier) extractionPrompt += `- Tier: ${contextData.tier}\n`;
      extractionPrompt += `\nFill in any missing details based on the new message, and keep existing details unless contradicted.`;
    }

    extractionPrompt += `\nUser message: "${content}"\n\nResponse (JSON only):`;

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
      // Find the JSON object in the response (handle if there's any text before/after)
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
        gameMode: null,
        date: null,
        time: null,
        notes: null,
        tier: null
      };
    }
    
    // Merge with existing context data, preferring new data when available
    if (contextData && Object.keys(contextData).length > 0) {
      extractedData = {
        gameMode: extractedData.gameMode || contextData.gameMode || null,
        date: extractedData.date || contextData.date || null,
        time: extractedData.time || contextData.time || null,
        notes: extractedData.notes || contextData.notes || null,
        tier: extractedData.tier || contextData.tier || null
      };
    }
    
    // Special handling for times like "8pm" without a colon - converts to proper 24hr format
    if (extractedData.time && !extractedData.time.includes(':')) {
      const timeMatch = extractedData.time.match(/(\d+)\s*(am|pm)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const period = timeMatch[2].toLowerCase();
        
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        extractedData.time = `${hours.toString().padStart(2, '0')}:00`;
      }
    }
    
    return extractedData;
  } catch (error) {
    logger.error("Error extracting event details:", error);
    throw error;
  }
}

/**
 * Create a new session based on extracted details
 * @param {Object} details - Extracted event details
 * @param {string} hostId - Discord ID of the event host
 * @param {string} guildId - Discord guild ID where the event is being created
 * @returns {Promise<Object>} - Created session object
 */
async function createEventFromDetails(details, hostId, guildId) {
  try {
    // Generate session ID
    const sessionId = uuidv4();
    
    // Parse date and time
    const sessionDate = dateUtils.parseUserDateTime(details.date, details.time);
    
    // Log the parsed date for debugging
    logger.info(`Creating session with date: ${sessionDate.toISOString()} (from input: ${details.date} ${details.time})`);
    
    // Create session object with base data
    const sessionData = {
      sessionId,
      guildId,
      gameMode: details.gameMode,
      date: sessionDate,
      host: hostId,
      notes: details.notes || "",
      gamers: []
    };
    
    // Add metadata if needed
    if (details.gameMode === "RBGs" && details.tier) {
      sessionData.meta = {
        rbgTier: details.tier
      };
      logger.info(`Setting tier for RBGs: ${details.tier}`);
    }
    
    // Create new session with data
    const newSession = new Session(sessionData);
    
    // Log session creation attempt
    logger.info(`Attempting to create session with ID: ${sessionId}, guildId: ${guildId}, gameMode: ${details.gameMode}, tier: ${details.tier || 'default'}`);
    
    // Save to database
    await newSession.save();
    logger.info(`Session created successfully with ID: ${sessionId}`);
    
    // Return the created session
    return newSession;
  } catch (error) {
    // Enhanced error logging
    logger.error(`Error creating event from details: ${error.message}`, error);
    if (error.name === 'ValidationError') {
      // Log specific validation errors
      for (let field in error.errors) {
        logger.error(`Validation error in field ${field}: ${error.errors[field].message}`);
      }
    }
    throw error;
  }
}

/**
 * Process event creation from natural language
 * @param {Object} client - Discord client
 * @param {Object} message - Discord message object
 * @returns {Promise<Object>} - Result of processing {success, session, missingFields}
 */
async function processEventCreation(client, message) {
  try {
    // Extract context data if provided
    const contextData = message.contextData || {};
    
    // IMPORTANT: Get guild ID from the message
    const guildId = message.guild?.id;
    
    // Enhanced logging to track the issue
    logger.info(`Processing event creation from message: "${message.content}"`);
    logger.info(`Guild ID from message: ${guildId || 'Not available'}`);
    
    // Check if we have a guild ID
    if (!guildId) {
      logger.error("Cannot create event: Missing guild ID in message");
      return {
        success: false,
        error: "Missing guild ID. This event must be created in a server."
      };
    }
    
    // Extract event details from message
    const extractedDetails = await extractEventDetails(message.content, contextData);
    logger.info("Extracted event details:", JSON.stringify(extractedDetails));
    
    // Check if we have all required fields
    const missingFields = [];
    if (!extractedDetails.gameMode) missingFields.push("game mode");
    if (!extractedDetails.date) missingFields.push("date");
    if (!extractedDetails.time) missingFields.push("time");
    
    // If any required fields are missing, return them
    if (missingFields.length > 0) {
      logger.info(`Missing fields for event creation: ${missingFields.join(', ')}`);
      return {
        success: false,
        missingFields,
        partialDetails: extractedDetails
      };
    }
    
    // Create the event - with additional logging
    logger.info(`Creating event with details: Game mode: ${extractedDetails.gameMode}, Date: ${extractedDetails.date}, Time: ${extractedDetails.time}, Guild: ${guildId}, Tier: ${extractedDetails.tier || 'default'}`);
    const session = await createEventFromDetails(extractedDetails, message.author.id, guildId);
    logger.info(`Event created successfully with ID: ${session.sessionId}`);
    
    // Separately get the display channel and update the session display
    const displayChannelId = process.env.DISPLAY_CHANNEL_ID;
    if (displayChannelId) {
      try {
        logger.info(`Attempting to update session display for ${session.sessionId}`);
        
        // Import the updateSessionDisplay function
        try {
          // Import directly from the service
          const { updateSessionDisplay } = require('../../utils/sessionDisplayService');
          // Pass full session object instead of just ID
          await updateSessionDisplay(client, session);
          logger.info("Session display updated via sessionDisplayService");
        } catch (importError) {
          logger.error("Error importing updateSessionDisplay:", importError);
          
          // If that fails, manually implement a basic version
          try {
            const displayChannel = await client.channels.fetch(displayChannelId);
            if (displayChannel) {
              // Get the constructSessionEmbed function
              const { constructSessionEmbed } = require('../../events/handlers/embedBuilder');
              // Get the createSessionButtons function
              const { createSessionButtons } = require('../../events/handlers/sessionHandlers');
              
              // Create and send the embed
              const embed = await constructSessionEmbed(client, session);
              const buttons = createSessionButtons(session.sessionId);
              
              // Create content text with tier if applicable
              let contentText = `**New ${session.gameMode} Session** | <@${message.author.id}> is organizing`;
              
              // Add tier information for RBGs
              if (session.gameMode === "RBGs" && session.meta && session.meta.rbgTier) {
                contentText = `**New ${session.gameMode} Session (${session.meta.rbgTier.toUpperCase()} RUN)** | <@${message.author.id}> is organizing`;
              }
              
              await displayChannel.send({
                content: contentText,
                embeds: [embed],
                components: buttons
              });
              
              logger.info("Session display created manually as fallback");
            }
          } catch (displayError) {
            logger.error("Error with manual display update:", displayError);
          }
        }
      } catch (displayError) {
        logger.error("Error updating session display:", displayError);
        // Continue even if display update fails
      }
    }
    
    return {
      success: true,
      session
    };
  } catch (error) {
    // Enhanced error logging
    logger.error(`Error in processEventCreation: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate AI response for event creation result
 * @param {Object} result - Result of event creation attempt
 * @returns {Promise<string>} - AI response text
 */
async function generateEventCreationResponse(result) {
  if (!openai) {
    return result.success 
      ? "✅ Event created successfully!" 
      : "❌ Failed to create event. Please try using the /schedule command instead.";
  }
  
  try {
    // Get combined prompt focused on event creation and banter
    const systemPrompt = promptLibrary.getCombinedPrompt(['event', 'banter']);
    
    // Create prompt based on result
    let userPrompt;
    
    if (result.success) {
      const session = result.session;
      
      // Use dateUtils to properly format the time in the requested timezone (ET)
      const { formattedTime, dayOfWeek, month, day, year } = dateUtils.formatDateForDisplay(session.date);
      
      // Get tier information if it exists for RBGs
      const tierInfo = (session.gameMode === "RBGs" && session.meta && session.meta.rbgTier) 
        ? ` This is a ${session.meta.rbgTier.toUpperCase()} run.` 
        : '';
      
      userPrompt = `I've successfully created a ${session.gameMode} event for ${dayOfWeek}, ${month}/${day} at ${formattedTime}.${tierInfo} The session ID is ${session.sessionId}.
      
Write a response confirming the event creation with the above details. Be enthusiastic but include your typical sarcastic humor. Don't format the response as JSON - just write a natural conversational response that confirms the event has been created.`;
    } else if (result.missingFields && result.missingFields.length > 0) {
      // Get the missing fields and any partial details we do have
      const missingList = result.missingFields.join(', ');
      
      // Detailed prompt for missing information
      userPrompt = `I tried to create an event but I'm missing some required information: ${missingList}. 
      
Write a response asking specifically for these missing details, being clear about what I need. Be a bit sassy but still helpful and friendly.
`;
      
      // Include any partial info we have for context
      if (result.partialDetails) {
        userPrompt += "\nPartial details we already have:\n";
        if (result.partialDetails.gameMode) userPrompt += `- Game Mode: ${result.partialDetails.gameMode}\n`;
        if (result.partialDetails.date) userPrompt += `- Date: ${result.partialDetails.date}\n`;
        if (result.partialDetails.time) userPrompt += `- Time: ${result.partialDetails.time}\n`;
        if (result.partialDetails.notes) userPrompt += `- Notes: ${result.partialDetails.notes}\n`;
        if (result.partialDetails.tier) userPrompt += `- Tier: ${result.partialDetails.tier}\n`;
      }
      
      userPrompt += "\nMake it conversational and encouraging them to provide the missing details.";
    } else {
      // Enhanced error details
      const errorDetails = result.error || 'Unknown error';
      logger.error(`Generating error response for: ${errorDetails}`);
      
      userPrompt = `I tried to create an event but encountered an error: ${errorDetails}. 
      
Write a response apologizing for the failure and suggesting they use the /schedule command instead. Add some self-deprecating humor about your AI capabilities.`;
    }
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    // Return the AI's response text
    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error("Error generating event creation response:", error);
    
    // Fallback response
    if (result.success) {
      const session = result.session;
      const { formattedTime } = dateUtils.formatDateForDisplay(session.date);
      
      // Include tier information in fallback if available
      const tierInfo = (session.gameMode === "RBGs" && session.meta && session.meta.rbgTier) 
        ? ` (${session.meta.rbgTier.toUpperCase()} run)` 
        : '';
        
      return `✅ Event created successfully! Your ${session.gameMode}${tierInfo} session is scheduled for ${formattedTime}.`;
    } else if (result.missingFields && result.missingFields.length > 0) {
      return `I need a bit more information to create this event. Could you please tell me the ${result.missingFields.join(', ')}?`;
    } else {
      return "❌ Failed to create event. Please try using the /schedule command instead.";
    }
  }
}

module.exports = {
  isEventCreationRequest,
  extractEventDetails,
  processEventCreation,
  generateEventCreationResponse
};