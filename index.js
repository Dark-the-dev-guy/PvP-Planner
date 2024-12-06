// index.js

require('dotenv').config();
const { Client, Intents, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Create a new Discord client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Initialize a Collection for commands
client.commands = new Collection();

// Path to the events directory using a relative path
const eventsPath = path.join(__dirname, 'events');

// Read all event files from the events directory
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

// Register each event
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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN)
.then(() => {
    console.log(`Logged in as ${client.user.tag}!`);
})
.catch(err => {
    console.error('Discord login error:', err);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
