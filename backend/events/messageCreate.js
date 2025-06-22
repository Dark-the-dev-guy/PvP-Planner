// events/messageCreate.js
const { Events } = require('discord.js');
const assistantHandler = require('../assistant/assistantHandler');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    try {
      // Skip messages from the bot itself to prevent loops
      if (message.author.bot) return;
      
      // Enhanced logging for debugging
      const channelInfo = message.guild ? 
        `${message.guild.name} / ${message.channel.name}` : 
        'DM';
      
      logger.info(`[Message] 📨 Received message from ${message.author.tag} in ${channelInfo}`);
      logger.info(`[Message] 💬 Content: "${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`);
      
      // Check if bot is mentioned - multiple ways
      const botId = message.client.user.id;
      const isMentioned = message.mentions.users.has(botId) || 
                         message.content.includes(`<@${botId}>`) || 
                         message.content.includes(`<@!${botId}>`);
      
      // Check if it's a DM
      const isDM = message.channel.type === 1; // ChannelType.DM in newer versions
      
      // Log mention detection
      if (isMentioned) {
        logger.info(`[Message] 🏷️  Bot was mentioned by ${message.author.tag}`);
      }
      
      if (isDM) {
        logger.info(`[Message] 📩 Received DM from ${message.author.tag}`);
      }
      
      // Process message through assistant handler when bot is mentioned or messaged directly
      if (isMentioned || isDM) {
        logger.info(`[Message] 🔄 Processing message through assistant handler...`);
        await assistantHandler.processMessage(message.client, message);
        logger.info(`[Message] ✅ Message processed successfully`);
      } else {
        // Check if it's a reply to the bot
        if (message.reference && message.reference.messageId) {
          try {
            logger.info(`[Message] 🔍 Checking if this is a reply to bot...`);
            const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedTo.author.id === message.client.user.id) {
              logger.info(`[Message] ↩️  Detected reply to bot message from ${message.author.tag}`);
              await assistantHandler.processMessage(message.client, message);
              logger.info(`[Message] ✅ Reply processed successfully`);
            } else {
              logger.info(`[Message] ➡️  Reply was to ${repliedTo.author.tag}, not bot - ignoring`);
            }
          } catch (error) {
            logger.error(`[Message] ❌ Error checking replied message: ${error.message}`);
          }
        } else {
          logger.info(`[Message] ⏭️  Message not directed at bot - ignoring`);
        }
      }
    } catch (error) {
      logger.error(`[Message] ❌ Error processing message: ${error.stack || error.message || error}`);
      console.error('Message processing error:', error);
    }
  },
};