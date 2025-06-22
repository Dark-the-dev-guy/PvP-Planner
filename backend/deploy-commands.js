// deploy-commands.js

const fs = require("fs");
const path = require("path");
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

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

console.log(`📝 Found ${commandFiles.length} command files to process...`);

// Files to skip if needed
const skipFiles = ["polldays.js"];

for (const file of commandFiles) {
  // Skip specified files
  if (skipFiles.includes(file)) {
    console.log(`⏭️ Skipping command: ${file}`);
    continue;
  }
  
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
      console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
      console.error(
        `❌ The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  } catch (error) {
    console.error(`❌ Error loading command from ${filePath}:`, error);
  }
}

// Check if we have any commands to deploy
if (commands.length === 0) {
  console.warn("⚠️ No commands to deploy. Exiting...");
  process.exit(0);
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Process command line arguments to allow guild-specific deployment for testing
const args = process.argv.slice(2);
const guildFlag = args.findIndex(arg => arg === "--guild");
const guildId = guildFlag !== -1 ? args[guildFlag + 1] : null;
const cleanupFlag = args.includes("--cleanup");

// NEW FLAG: Add a clear flag that removes all commands before deploying
const clearFlag = args.includes("--clear");

(async () => {
  try {
    // Prepare deployment target (global or guild-specific)
    let route;
    let targetDescription;
    
    if (guildId) {
      route = Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId);
      targetDescription = `guild ${guildId}`;
    } else {
      route = Routes.applicationCommands(process.env.CLIENT_ID);
      targetDescription = "globally";
      
      // Warning for global deployment
      console.log("⚠️ You are deploying commands globally to all servers where your bot is present");
      console.log("⚠️ This may take up to an hour for commands to appear in all servers");
      console.log("ℹ️ For testing, use: node deploy-commands.js --guild YOUR_TEST_GUILD_ID");
      console.log("⚠️ Continuing in 3 seconds...");
      
      // Brief pause to allow cancellation
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // ADDED: Clear all commands first if requested
    if (clearFlag) {
      console.log(`🗑️ Clearing all existing commands ${targetDescription}...`);
      await rest.put(route, { body: [] });
      console.log(`✅ Successfully cleared all commands ${targetDescription}.`);
      
      // If only clearing, exit
      if (args.includes("--clear-only")) {
        console.log("✅ Command clearing complete. Exiting as requested.");
        process.exit(0);
      }
    }

    // Perform cleanup check if requested
    if (cleanupFlag) {
      console.log(`🧹 Checking for outdated commands ${targetDescription}...`);
      
      // Get existing commands
      const existingCommands = await rest.get(route);
      
      // Find commands that exist on Discord but not in our local files
      const commandsToRemove = existingCommands.filter(
        existingCmd => !commands.some(localCmd => localCmd.name === existingCmd.name)
      );
      
      if (commandsToRemove.length > 0) {
        console.log(`🗑️ Found ${commandsToRemove.length} outdated commands to remove:`);
        commandsToRemove.forEach(cmd => console.log(`  - ${cmd.name}`));
        
        // Remove each outdated command
        for (const cmdToRemove of commandsToRemove) {
          const deleteRoute = guildId 
            ? Routes.applicationGuildCommand(process.env.CLIENT_ID, guildId, cmdToRemove.id)
            : Routes.applicationCommand(process.env.CLIENT_ID, cmdToRemove.id);
            
          await rest.delete(deleteRoute);
          console.log(`✅ Removed outdated command: ${cmdToRemove.name}`);
        }
      } else {
        console.log("✅ No outdated commands found.");
      }
    }
    
    // ADDED: Check for duplicate commands
    console.log(`🔍 Checking for potential duplicate commands ${targetDescription}...`);
    const existingCommands = await rest.get(route);
    const duplicateNames = new Set();
    
    // Find commands with the same name
    existingCommands.forEach(cmd => {
      const matchingLocalCommands = commands.filter(localCmd => localCmd.name === cmd.name);
      if (matchingLocalCommands.length > 0) {
        duplicateNames.add(cmd.name);
      }
    });
    
    if (duplicateNames.size > 0) {
      console.log(`⚠️ Warning: Found ${duplicateNames.size} commands that might create duplicates:`);
      duplicateNames.forEach(name => console.log(`  - ${name}`));
      console.log("⚠️ Consider using --clear flag to remove all commands first");
    }

    console.log(`🚀 Deploying ${commands.length} slash commands ${targetDescription}...`);

    // Actual deployment
    const data = await rest.put(route, { body: commands });

    console.log(`✅ Successfully deployed ${data.length} slash commands ${targetDescription}.`);
    
    if (!guildId) {
      console.log("ℹ️ Note: Global commands may take up to an hour to appear in all servers.");
    }
  } catch (error) {
    // Enhanced error handling with specific error codes
    if (error.code === 429) {
      console.error("❌ Rate limited by Discord API. Please try again later.");
    } else if (error.code === 401) {
      console.error("❌ Authentication failed. Check your bot token.");
    } else if (error.code === 403) {
      console.error("❌ Permission denied. Ensure your bot has the necessary permissions.");
    } else {
      console.error("❌ Error deploying slash commands:", error);
    }
    process.exit(1);
  }
})();