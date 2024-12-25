// deploy-commands.js

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");
const dotenv = require("dotenv");

dotenv.config();

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.log(
      `❌ The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("🚀 Deploying slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Slash commands deployed successfully.");
  } catch (error) {
    console.error("❌ Error deploying slash commands:", error);
  }
})();
