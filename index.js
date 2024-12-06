// index.js

require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Create a new Discord client instance with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // If you handle message content
    // Add other intents as needed
  ],
});

// Initialize a Collection for commands
client.commands = new Collection();

// Path to the commands directory
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Ensure command has 'data' and 'execute' properties
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

// Path to the events directory
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    console.log(`Registered event: ${event.name}`);
  }
}

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Log in to Discord with your client's token
client
  .login(process.env.DISCORD_TOKEN)
  .then(() => console.log(`✅ Logged in as ${client.user.tag}!`))
  .catch((err) => console.error("❌ Discord login error:", err));

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});
