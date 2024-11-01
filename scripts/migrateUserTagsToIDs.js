// scripts/migrateUserTagsToIDs.js

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Session = require("../models/Session");
const { Client, GatewayIntentBits } = require("discord.js");

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log("Logged in as", client.user.tag);

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    const sessions = await Session.find();

    for (const session of sessions) {
      // Migrate host
      if (!/^\d+$/.test(session.host)) {
        // If host is not a snowflake
        const user = await client.users.fetch(session.host).catch(() => null);
        if (user) {
          session.host = user.id;
        } else {
          console.log(`User not found for host: ${session.host}`);
        }
      }

      // Migrate participants
      session.participants = await Promise.all(
        session.participants.map(async (participant) => {
          if (/^\d+$/.test(participant)) {
            return participant; // Already a snowflake
          }
          const user = await client.users.fetch(participant).catch(() => null);
          return user ? user.id : participant;
        })
      );

      await session.save();
      console.log(`Migrated session: ${session._id}`);
    }

    console.log("Migration completed.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN);
