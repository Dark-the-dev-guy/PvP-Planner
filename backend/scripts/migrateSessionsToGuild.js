// scripts/migrateSessionsToGuild.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Session = require("../models/Session");
const { Client, GatewayIntentBits } = require("discord.js");
const logger = require("../utils/logger");

dotenv.config();

// Use the guild ID provided as argument or default to environment variable
const targetGuildId = process.argv[2] || process.env.GUILD_ID;

if (!targetGuildId) {
  console.error("❌ No guild ID provided. Please specify a target guild ID.");
  console.error("Usage: node migrateSessionsToGuild.js <guildId>");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  logger.info(`Migration script starting - adding guildId: ${targetGuildId} to all sessions`);

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
    logger.info("Connected to MongoDB for session migration");

    // Find all sessions without a guildId
    const sessions = await Session.find({ guildId: { $exists: false } });
    
    if (sessions.length === 0) {
      console.log("No sessions found needing migration.");
      logger.info("No sessions found without guildId - migration may have already completed");
      await mongoose.disconnect();
      client.destroy();
      return;
    }
    
    console.log(`Found ${sessions.length} sessions to migrate...`);
    logger.info(`Found ${sessions.length} sessions without guildId to migrate`);

    // Update all sessions with the target guild ID
    let migratedCount = 0;
    
    for (const session of sessions) {
      session.guildId = targetGuildId;
      await session.save();
      migratedCount++;
      
      if (migratedCount % 10 === 0 || migratedCount === sessions.length) {
        console.log(`Migrated ${migratedCount}/${sessions.length} sessions...`);
        logger.info(`Migration progress: ${migratedCount}/${sessions.length} sessions updated`);
      }
    }

    console.log(`✅ Successfully migrated ${migratedCount} sessions to guild ID: ${targetGuildId}`);
    logger.info(`Migration completed successfully - ${migratedCount} sessions updated with guildId: ${targetGuildId}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    logger.error("Session migration failed:", error);
  } finally {
    await mongoose.disconnect();
    client.destroy();
    console.log("Disconnected from MongoDB and Discord");
    logger.info("Migration script completed - disconnected from services");
  }
});

// Handle connection errors
client.on("error", (error) => {
  console.error("Discord client error:", error);
  logger.error("Discord client error during migration:", error);
  process.exit(1);
});

// Login to Discord
console.log("Connecting to Discord...");
client.login(process.env.DISCORD_TOKEN);