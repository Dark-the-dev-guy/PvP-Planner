// backend/reminderSystem.js
const { scheduleJob } = require('node-schedule');
const Session = require('./models/Session');
const GuildConfig = require('./models/GuildConfig');
const logger = require('./utils/logger');
const emojiManager = require('./utils/emojiManager');
const dateUtils = require('./utils/dateUtils');

// Default reminder time in minutes
const DEFAULT_REMINDER_TIME = 15;

/**
 * Initialize the reminder system
 * @param {Client} client - Discord.js client
 */
async function initReminderSystem(client) {
  logger.info('Initializing reminder system');
  
  // Schedule job to check for upcoming sessions every minute
  // Changed from */5 to * to run every minute for more precise timing
  scheduleJob('* * * * *', async () => {
    try {
      await checkUpcomingSessions(client);
    } catch (error) {
      logger.error('Error in reminder check:', error);
    }
  });
  
  // Also run an immediate check on startup
  try {
    await checkUpcomingSessions(client);
  } catch (error) {
    logger.error('Error in initial reminder check:', error);
  }
  
  logger.info('Reminder system initialized and running');
}

/**
 * Check for sessions that need reminders across all guilds
 * @param {Client} client - Discord.js client
 */
async function checkUpcomingSessions(client) {
  try {
    // Current time
    const now = new Date();
    
    // Get all guild configs to use their reminder settings
    const guildConfigs = await GuildConfig.find({});
    logger.info(`Found ${guildConfigs.length} guild configurations`);
    
    // Create a map of guild settings for easier lookup
    const guildSettings = new Map();
    guildConfigs.forEach(config => {
      guildSettings.set(config.guildId, {
        reminderTime: config.alerts?.channelReminderTime || DEFAULT_REMINDER_TIME,
        reminderChannel: config.alerts?.reminderChannelId || "",
        displayChannels: config.displayChannels || []
      });
    });
    
    // Process each guild's upcoming sessions
    for (const [guildId, settings] of guildSettings.entries()) {
      try {
        await checkGuildSessions(client, guildId, settings, now);
      } catch (guildError) {
        logger.error(`Error checking sessions for guild ${guildId}:`, guildError);
        // Continue with other guilds even if one fails
      }
    }
    
  } catch (error) {
    logger.error('Error in checkUpcomingSessions:', error);
  }
}

/**
 * Check sessions for a specific guild
 * @param {Client} client - Discord.js client
 * @param {string} guildId - Guild ID
 * @param {Object} settings - Guild settings
 * @param {Date} now - Current time
 */
async function checkGuildSessions(client, guildId, settings, now) {
  const reminderTime = settings.reminderTime || DEFAULT_REMINDER_TIME;
  
  // Calculate the time window for sending reminders
  // FIXED: Use a 1-minute window centered on the exact reminder time
  // This results in reminders between 15.5 and 14.5 minutes before (for a 15-minute setting)
  const halfMinuteMs = 30 * 1000; // 30 seconds
  const reminderWindowStart = new Date(now.getTime() + (reminderTime * 60 * 1000) - halfMinuteMs);
  const reminderWindowEnd = new Date(now.getTime() + (reminderTime * 60 * 1000) + halfMinuteMs);
  
  logger.info(`Guild ${guildId} - Reminder window: ${reminderWindowStart.toISOString()} to ${reminderWindowEnd.toISOString()} (${reminderTime} min before)`);
  
  // Find sessions for this guild that need reminders
  const sessions = await Session.find({
    guildId: guildId,
    date: {
      $gte: reminderWindowStart,
      $lt: reminderWindowEnd
    },
    'reminderSent': { $ne: true } // Only get sessions where reminder hasn't been sent
  });
  
  logger.info(`Found ${sessions.length} sessions needing reminders in guild ${guildId}`);
  
  // Process each session
  for (const session of sessions) {
    await sendSessionReminder(client, session, settings);
    
    // Mark reminder as sent
    session.reminderSent = true;
    await session.save();
    logger.info(`Marked session ${session.sessionId} as having sent reminder`);
  }
}

/**
 * Send a reminder for a specific session
 * @param {Client} client - Discord.js client
 * @param {Object} session - Session object
 * @param {Object} settings - Guild settings
 */
async function sendSessionReminder(client, session, settings) {
  try {
    // Get the reminder channel for this guild
    let reminderChannelId = settings.reminderChannel;
    
    // If no dedicated reminder channel, use the first display channel
    if (!reminderChannelId && settings.displayChannels && settings.displayChannels.length > 0) {
      reminderChannelId = settings.displayChannels[0];
    }
    
    // If we still don't have a channel ID, try to find a suitable channel
    if (!reminderChannelId) {
      // Try to find the guild
      const guild = await client.guilds.fetch(session.guildId).catch(() => null);
      if (guild) {
        // Look for a channel with "schedule" in the name
        const scheduleChannel = guild.channels.cache.find(
          ch => ch.name.toLowerCase().includes('schedule') && 
                ch.type === 0 && // Text channel
                ch.permissionsFor(guild.members.me).has('SendMessages')
        );
        
        if (scheduleChannel) {
          reminderChannelId = scheduleChannel.id;
        }
      }
    }
    
    if (!reminderChannelId) {
      logger.error(`No reminder channel found for session ${session.sessionId} in guild ${session.guildId}`);
      return;
    }
    
    logger.info(`Sending reminder for session ${session.sessionId} to channel ${reminderChannelId}`);
    
    const channel = await client.channels.fetch(reminderChannelId);
    if (!channel) {
      logger.error(`Reminder channel not found: ${reminderChannelId}`);
      return;
    }
    
    // Format session information
    const gameMode = session.gameMode;
    
    // Format time using our utility
    const { formattedTime } = dateUtils.formatDateForDisplay(session.date);
    
    // Count attending players
    const attending = session.gamers.filter(gamer => gamer.status === "attending").length;
    
    // Get emoji for the game mode if available
    const modeEmoji = gameMode === "2v2" ? "🔵" : 
                    gameMode === "3v3" ? "🟣" : 
                    gameMode === "RBGs" ? "🟠" : "🎮";
    
    // Get ready emoji if available                
    const readyEmoji = emojiManager.getEmoji('ready', client) || "🎮";
    
    const reminderMessage = `@here **${modeEmoji} REMINDER: ${gameMode} starting in ${settings.reminderTime} minutes!** (${formattedTime})\n\n` +
      `${readyEmoji} ${attending} player${attending !== 1 ? 's' : ''} currently signed up. ` +
      `Use \`/viewcalendar\` to see details or join now!`;
    
    // Send the reminder
    await channel.send({
      content: reminderMessage,
      allowedMentions: { parse: ['everyone'] } // Needed for @here to work
    });
    
    logger.info(`Successfully sent reminder for ${gameMode} session ${session.sessionId} in guild ${session.guildId}`);
  } catch (error) {
    logger.error(`Error sending reminder for session ${session.sessionId}:`, error);
  }
}

module.exports = {
  initReminderSystem
};