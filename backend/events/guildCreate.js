// events/guildCreate.js
const GuildConfig = require('../models/GuildConfig');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildCreate',
  once: false,
  async execute(guild) {
    try {
      logger.info(`Bot joined new guild: ${guild.name} (${guild.id})`);
      
      // Create default configuration for the guild
      const guildConfig = await GuildConfig.getDefaultConfig(guild.id);
      
      // Log success
      logger.info(`Created default configuration for guild ${guild.id}`);
      
      // Attempt to find a good default channel for announcements
      // Look for common channel names
      const possibleChannels = ['general', 'bot-commands', 'bot', 'schedule', 'announcements'];
      
      let defaultChannel = null;
      
      for (const channelName of possibleChannels) {
        const channel = guild.channels.cache.find(
          ch => ch.name.toLowerCase().includes(channelName) && 
                ch.type === 0 && // Text channel
                ch.permissionsFor(guild.members.me).has('SendMessages')
        );
        
        if (channel) {
          defaultChannel = channel;
          break;
        }
      }
      
      // If we found a suitable channel, send a welcome message
      if (defaultChannel) {
        await defaultChannel.send({
          content: `
👋 Hello! I'm PvP Planner Bot, here to help you schedule gaming sessions!

Use \`/config\` to configure me for your server.
Use \`/schedule\` to create a new event.
Use \`/viewcalendar\` to see upcoming events.

Need help? Ask me anything by mentioning me: @PvP-Planner Bot
          `
        });
        
        // Save this as the default display channel
        guildConfig.displayChannels = [defaultChannel.id];
        await guildConfig.save();
        
        logger.info(`Sent welcome message to channel ${defaultChannel.name} (${defaultChannel.id}) in guild ${guild.id}`);
      } else {
        logger.warn(`Could not find suitable channel for welcome message in guild ${guild.id}`);
      }
    } catch (error) {
      logger.error(`Error handling guildCreate event for guild ${guild.id}:`, error);
    }
  }
};