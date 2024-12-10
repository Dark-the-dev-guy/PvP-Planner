// index.js

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

// Initialize Discord Client with necessary intents
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Initialize a Collection (map) for your commands
client.commands = new Collection();

// Path to the Commands directory
const commandsPath = path.join(__dirname, "Commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

// Load each command into the client's commands collection
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  // Ensure the command has both `data` and `execute` properties
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.log(
      `❌ The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

// Path to the Events directory
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

// Load each event handler
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if ("name" in event && "execute" in event) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`✅ Registered event: ${event.name}`);
  } else {
    console.log(
      `❌ The event at ${filePath} is missing a required "name" or "execute" property.`
    );
  }
}

// Connect to MongoDB without deprecated options
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("🔄 Shutting down gracefully...");
  mongoose.disconnect();
  client.destroy();
  process.exit(0);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
