// backend/assistant/debugHandler.js
const config = require('./config');

async function processMessage(client, message) {
  // Log all messages received
  console.log('----DEBUG----');
  console.log(`Message received: ${message.content}`);
  console.log(`Channel type: ${message.channel.type}`);
  console.log(`Author: ${message.author.tag}`);
  console.log(`Is DM: ${message.channel.type === 1}`);
  console.log(`Bot mentioned: ${message.mentions.users.has(client.user.id)}`);
  console.log(`OpenAI Key exists: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`OpenAI Key prefix: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 3) + '...' : 'null'}`);
  console.log('--------------');
  
  // Reply to any DM with a debug message
  if (message.channel.type === 1 && !message.author.bot) {
    await message.reply(`Debug Mode: I received your message "${message.content}". 
Channel Type: ${message.channel.type}
OpenAI Key Set: ${!!process.env.OPENAI_API_KEY}`);
  }
}

module.exports = { processMessage };