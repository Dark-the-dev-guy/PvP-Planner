const { REST, Routes } = require("discord.js");
const dotenv = require("dotenv");

dotenv.config();

// Validate essential environment variables
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN in environment variables");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("❌ Missing CLIENT_ID in environment variables");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Parse command-line arguments for optional guild scope
const args = process.argv.slice(2);
const guildFlag = args.findIndex(arg => arg === "--guild");
const guildId = guildFlag !== -1 ? args[guildFlag + 1] : null;

(async () => {
  try {
    let route;

    if (guildId) {
      console.log(`🗑️ Clearing all commands for guild ${guildId}...`);
      route = Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId);
    } else {
      console.log("🗑️ Clearing all global commands...");
      route = Routes.applicationCommands(process.env.CLIENT_ID);
    }

    // Overwrite with an empty array to delete all commands
    await rest.put(route, { body: [] });

    if (guildId) {
      console.log(`✅ Successfully cleared all commands for guild ${guildId}.`);
    } else {
      console.log("✅ Successfully cleared all global commands.");
    }
  } catch (error) {
    // Enhanced error handling
    if (error.code === 429) {
      console.error("❌ Rate limited by Discord API. Please try again later.");
    } else if (error.code === 401) {
      console.error("❌ Authentication failed. Check your bot token.");
    } else if (error.code === 403) {
      console.error("❌ Permission denied. Ensure your bot has the necessary permissions.");
    } else {
      console.error("❌ Error clearing commands:", error);
    }
    process.exit(1);
  }
})();
