// assistant/modules/configCreator.js
const GuildConfig = require('../../models/GuildConfig');
const { OpenAI } = require('openai');
const promptLibrary = require('../promptLibrary');
const logger = require('../../utils/logger');

// Initialize OpenAI client
let openai;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  logger.error("Error initializing OpenAI client in configCreator:", error);
}

/**
 * Check if a message is asking to change configuration settings
 * @param {string} content - Message content
 * @returns {boolean} - True if the message appears to be a configuration request
 */
function isConfigurationRequest(content) {
  const lowerContent = content.toLowerCase();
  
  // Direct phrases that should immediately be recognized as config requests
  const directPhrases = [
    'update your persona', 
    'change your persona',
    'switch your persona',
    'set your persona',
    'update persona',
    'change persona',
    'update your config', 
    'change your config',
    'update config',
    'change config',
    'update settings',
    'change settings',
    'update configuration'
  ];
  
  // Check for direct phrases first - these should override other checks
  for (const phrase of directPhrases) {
    if (lowerContent.includes(phrase)) {
      return true;
    }
  }
  
  // Keywords that suggest configuration changes
  const configKeywords = [
    'change', 'set', 'update', 'configure', 'setup', 'modify',
    'switch', 'make you', 'turn', 'adjust', 'settings', 'config'
  ];
  
  // Settings that can be configured
  const settingKeywords = [
    'persona', 'personality', 'sass', 'reminder', 'channel',
    'tone', 'style', 'voice', 'attitude', 'format', 'date',
    'level', 'gender', 'masculine', 'feminine', 'neutral',
    'tavernkeeper', 'bard', 'cleric', 'warlock', 'strategist', 
    'dungeonmaster', 'unhinged'
  ];
  
  // Check if any config keyword is present
  const hasConfigIntent = configKeywords.some(keyword => 
    lowerContent.includes(keyword)
  );
  
  // Check if any setting is mentioned
  const mentionsSetting = settingKeywords.some(setting => 
    lowerContent.includes(setting)
  );
  
  // Consider it a configuration request if it has configuration intent AND mentions a setting
  return hasConfigIntent && mentionsSetting;
}

/**
 * Extract configuration details from message using AI
 * @param {string} content - Message content
 * @param {Object} contextData - Optional context data from previous conversation
 * @returns {Promise<Object>} - Extracted configuration details
 */
async function extractConfigDetails(content, contextData = {}) {
  if (!openai) {
    throw new Error("OpenAI client not initialized");
  }
  
  try {
    // Create a prompt for the AI to extract configuration details
    const systemPrompt = `
You are a helpful assistant that extracts configuration requests from user messages.
Return ONLY a JSON object with these fields:
- setting: The setting to change (persona, tone, sass, reminder, channel, etc.)
- value: The value to set it to (extracted from context)
- confidence: How confident you are in this extraction (0-1)

If you can't determine a setting or value, use null for those fields.
    `;
    
    let userPrompt = `
Extract the configuration request from this message: "${content}"

Return the data as a JSON object with setting, value, and confidence.
Try to map the natural language to the appropriate configuration options.

Valid settings include:
- "persona": Can be one of ["tavernkeeper", "bard", "cleric", "warlock", "strategist", "dungeonmaster", "unhinged"]
- "tone": Can be one of ["neutral", "male", "female"]
- "sass": A number from 0-5
- "reminderTime": Number of minutes (10, 15, 20, 30)
- "dateFormat": Can be "MM-DD" or "DD-MM"
- "display": Channel for displaying events
- "schedule": Channel for schedule discussions
- "events": Channel for event displays
- "regular": Channel for regular chat

Response (JSON only):`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
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
        setting: null,
        value: null,
        confidence: 0
      };
    }
    
    return extractedData;
  } catch (error) {
    logger.error("Error extracting config details:", error);
    throw error;
  }
}

/**
 * Update guild configuration based on extracted details
 * @param {string} guildId - Discord guild ID
 * @param {Object} details - Extracted configuration details
 * @returns {Promise<Object>} - Updated guild configuration
 */
async function updateGuildConfig(guildId, details) {
  try {
    // Get the current guild configuration
    let guildConfig = await GuildConfig.findOne({ guildId });
    if (!guildConfig) {
      guildConfig = await GuildConfig.getDefaultConfig(guildId);
    }
    
    // Map the setting to the appropriate path in the config object
    let updatePath = '';
    let updateValue = details.value;
    
    switch (details.setting) {
      case 'persona':
        updatePath = 'personality.persona';
        break;
      case 'tone':
        updatePath = 'personality.personaTone';
        break;
      case 'sass':
        updatePath = 'personality.sassLevel';
        updateValue = parseInt(updateValue);
        break;
      case 'reminderTime':
        updatePath = 'alerts.channelReminderTime';
        updateValue = parseInt(updateValue);
        break;
      case 'dateFormat':
        updatePath = 'display.dateFormat';
        break;
      case 'display':
      case 'events':
      case 'schedule':
      case 'regular':
        // These would need channel IDs which would be handled separately
        return {
          success: false,
          error: "Channel updates require special handling",
          needsChannelResolution: true,
          channelType: details.setting
        };
      default:
        return {
          success: false,
          error: `Unknown setting: ${details.setting}`
        };
    }
    
// if (details.setting === 'persona' && details.value === 'unhinged' && !guildConfig.personality.isPremium) {
//     return {
//         success: false,
//         error: "The Unhinged persona is only available for premium guilds."
//     };
// }

    
    // Apply the update
    if (updatePath.includes('.')) {
      // Handle nested properties
      const parts = updatePath.split('.');
      let current = guildConfig;
      
      // Navigate to the deepest object
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      
      // Set the value
      current[parts[parts.length - 1]] = updateValue;
    } else {
      // Handle top-level properties
      guildConfig[updatePath] = updateValue;
    }
    
    // Save the updated configuration
    await guildConfig.save();
    logger.info(`Updated guild config: ${updatePath} = ${updateValue}`);
    
    return {
      success: true,
      updatedConfig: guildConfig,
      updatedSetting: details.setting,
      updatedValue: updateValue
    };
  } catch (error) {
    logger.error("Error updating guild config:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process a configuration request from natural language
 * @param {Object} client - Discord client
 * @param {Object} message - Discord message object
 * @returns {Promise<Object>} - Result of processing
 */
async function processConfigurationRequest(client, message) {
  try {
    // Extract context data if provided
    const contextData = message.contextData || {};
    
    // IMPORTANT: Get guild ID from the message
    const guildId = message.guild?.id;
    
    // Check if we have a guild ID
    if (!guildId) {
      logger.error("Cannot update config: Missing guild ID in message");
      return {
        success: false,
        error: "Missing guild ID. Configuration changes must be made in a server."
      };
    }
    
    // Check if the user has permission to change settings
    const member = await message.guild.members.fetch(message.author.id);
    const hasPermission = member.permissions.has("ADMINISTRATOR") || 
                         member.permissions.has("MANAGE_GUILD");
    
    if (!hasPermission) {
      logger.info(`User ${message.author.id} tried to change config without permission`);
      return {
        success: false,
        error: "You need Administrator or Manage Server permissions to change bot configuration."
      };
    }
    
    // Extract configuration details from message
    const extractedDetails = await extractConfigDetails(message.content, contextData);
    logger.info("Extracted config details:", JSON.stringify(extractedDetails));
    
    // Check confidence threshold
    if (extractedDetails.confidence < 0.7) {
      logger.info(`Low confidence config extraction: ${extractedDetails.confidence}`);
      return {
        success: false,
        error: "I'm not sure what setting you want to change. Please be more specific.",
        lowConfidence: true,
        extractedDetails
      };
    }
    
    // Check if we have all required information
    if (!extractedDetails.setting || !extractedDetails.value) {
      logger.info(`Missing config details: ${JSON.stringify(extractedDetails)}`);
      return {
        success: false,
        error: "I couldn't determine what setting you want to change or what value to set it to.",
        missingDetails: true,
        extractedDetails
      };
    }
    
    // Update the guild configuration
    const updateResult = await updateGuildConfig(guildId, extractedDetails);
    
    return updateResult;
  } catch (error) {
    logger.error(`Error in processConfigurationRequest: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate AI response for configuration result
 * @param {Object} result - Result of configuration attempt
 * @returns {Promise<string>} - AI response text
 */
async function generateConfigResponse(result) {
  if (!openai) {
    return result.success 
      ? "✅ Configuration updated successfully!" 
      : "❌ Failed to update configuration.";
  }
  
  try {
    // Get combined prompt focused on helpful response
    const systemPrompt = promptLibrary.getCombinedPrompt(['helpful', 'banter']);
    
    // Create prompt based on result
    let userPrompt;
    
    if (result.success) {
      userPrompt = `
I've successfully updated the bot's configuration. The setting "${result.updatedSetting}" was changed to "${result.updatedValue}".

Write a response confirming the configuration change. Be enthusiastic but include a touch of personality. Don't format the response as JSON - just write a natural conversational response that confirms the change has been made.
`;
    } else if (result.lowConfidence) {
      userPrompt = `
I tried to update a configuration setting but wasn't confident about what the user wanted to change. Here's what I extracted:
Setting: ${result.extractedDetails.setting || "Unknown"}
Value: ${result.extractedDetails.value || "Unknown"}
Confidence: ${result.extractedDetails.confidence}

Write a response asking for clarification about what setting they want to change. Be helpful and provide examples of how to specify settings more clearly.
`;
    } else if (result.missingDetails) {
      userPrompt = `
I tried to update a configuration setting but couldn't determine all the necessary details. Here's what I extracted:
Setting: ${result.extractedDetails?.setting || "Unknown"}
Value: ${result.extractedDetails?.value || "Unknown"}

Write a response asking for the missing information. Be helpful and provide examples of what I need to know.
`;
    } else if (result.needsChannelResolution) {
      userPrompt = `
I understood that the user wants to change a channel setting (${result.channelType}), but I need them to mention the channel by name or tag the channel.

Write a response explaining that I understood their request but need them to specify which channel they want to use.
`;
    } else {
      userPrompt = `
I tried to update a configuration setting but encountered an error: ${result.error || 'Unknown error'}.

Write a response explaining the issue in a helpful way. If this is about the "unhinged" persona being premium-only, explain this politely.
`;
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
    logger.error("Error generating config response:", error);
    
    // Fallback response
    if (result.success) {
      return `✅ Configuration updated successfully! The ${result.updatedSetting} has been set to ${result.updatedValue}.`;
    } else if (result.lowConfidence || result.missingDetails) {
      return "I'm not sure what configuration setting you want to change. Could you be more specific?";
    } else {
      return `❌ Failed to update configuration: ${result.error || "Unknown error"}`;
    }
  }
}

module.exports = {
  isConfigurationRequest,
  extractConfigDetails,
  processConfigurationRequest,
  generateConfigResponse,
  updateGuildConfig
};