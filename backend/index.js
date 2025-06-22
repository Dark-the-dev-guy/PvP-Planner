// index.js (main bot file)
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
require('dotenv').config();

// Log startup information
console.log('=== PvP Planner Bot Starting ===');
console.log('Node version:', process.version);
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('Discord.js version:', require('discord.js').version);

// Validate critical environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  const errorMsg = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
  console.error('❌', errorMsg);
  logger.error(errorMsg);
  process.exit(1);
}

// Log environment status
logger.info('Environment variables validated successfully');
if (process.env.OPENAI_API_KEY) {
  logger.info('OpenAI API key found');
} else {
  logger.warn('OpenAI API key not found - AI features will be disabled');
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    // Add other intents as needed
  ]
});

logger.info('Discord client created with intents: Guilds, GuildMessages, MessageContent, GuildMessageReactions');

// Create a collection for commands
client.commands = new Collection();

// Load commands from Commands directory
const commandsPath = path.join(__dirname, 'commands');
let commandFiles = [];

try {
  commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  logger.info(`Found ${commandFiles.length} command files`);
} catch (error) {
  logger.error('Error reading commands directory:', error);
}

// Register commands
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`✅ Registered command: ${command.data.name}`);
    } else {
      logger.warn(`⚠️  The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  } catch (error) {
    logger.error(`❌ Error loading command from ${filePath}:`, error);
  }
}

// Register events
const eventsPath = path.join(__dirname, 'events');
let eventFiles = [];

try {
  eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') && !file.startsWith('handlers'));
  logger.info(`Found ${eventFiles.length} event files`);
} catch (error) {
  logger.error('Error reading events directory:', error);
}

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  try {
    const event = require(filePath);
    if (event.name) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
        logger.info(`✅ Registered one-time event: ${event.name}`);
      } else {
        client.on(event.name, (...args) => event.execute(...args));
        logger.info(`✅ Registered recurring event: ${event.name}`);
      }
    } else {
      logger.warn(`⚠️  Event file ${file} is missing 'name' property`);
    }
  } catch (error) {
    logger.error(`❌ Error loading event from ${filePath}:`, error);
  }
}

// Deploy commands to Discord
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    const commands = [];
    for (const command of client.commands.values()) {
      commands.push(command.data.toJSON());
    }

    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // Deploy globally
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    logger.info(`✅ Successfully reloaded ${commands.length} application (/) commands.`);
  } catch (error) {
    logger.error('❌ Error deploying commands:', error);
    throw error; // Re-throw to handle in main flow
  }
}

// Connect to MongoDB
logger.info('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('✅ Connected to MongoDB successfully');
    // Deploy commands and login after DB connection is established
    return deployCommands();
  })
  .then(() => {
    logger.info('Starting Discord client login...');
    return client.login(process.env.DISCORD_TOKEN);
  })
  .then(() => {
    logger.info('Discord client login initiated');
  })
  .catch(err => {
    logger.error('❌ Critical startup error:', err);
    console.error('Critical startup error:', err);
    process.exit(1);
  });

// When the client is ready, run this code (only once)
client.once('ready', () => {
  logger.info(`🎉 Bot is ready! Logged in as ${client.user.tag}`);
  logger.info(`Bot is in ${client.guilds.cache.size} guilds`);
  console.log(`🎉 Bot is ready! Logged in as ${client.user.tag}`);
  
  // Log some basic info about the bot's state
  logger.info(`Bot has access to ${client.channels.cache.size} channels`);
  logger.info(`Bot can see ${client.users.cache.size} users`);
  
  // Initialize the reminder system after the client is ready
  try {
    const { initReminderSystem } = require('./reminderSystem');
    initReminderSystem(client);
    logger.info('✅ Reminder system initialized successfully');
  } catch (error) {
    logger.error('❌ Error initializing reminder system:', error);
  }
});

// Handle errors
client.on('error', error => {
  logger.error('Discord client error:', error);
  console.error('Discord client error:', error);
});

client.on('warn', warning => {
  logger.warn('Discord client warning:', warning);
});

client.on('debug', info => {
  // Only log debug info if LOG_LEVEL is debug
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('Discord client debug:', info);
  }
});

// Enhanced process error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection at:', promise, 'reason:', reason);
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error('Uncaught exception:', error);
  // Exit gracefully
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  client.destroy();
  mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  client.destroy();
  mongoose.disconnect();
  process.exit(0);
});