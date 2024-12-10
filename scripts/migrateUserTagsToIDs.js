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
      session.gamers = await Promise.all(
        session.gamers.map(async (gamer) => {
          if (/^\d+$/.test(gamer.userId)) {
            return gamer; // Already a snowflake
          }
          const user = await client.users.fetch(gamer.userId).catch(() => null);
          if (user) {
            return {
              ...gamer.toObject(),
              userId: user.id,
            };
          } else {
            console.log(`User not found for gamer: ${gamer.userId}`);
            return gamer; // Keep original if user not found
          }
        })
      );

      await session.save();
      console.log(`Migrated session: ${session.sessionId}`);
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
