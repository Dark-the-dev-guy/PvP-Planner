// scripts/migrateUserTagsToIDs.js

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Session = require("../models/Session");
const { Client, GatewayIntentBits } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log("Logged in as", client.user.tag);

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const sessions = await Session.find();

    for (const session of sessions) {
      // Assign sessionId if missing
      if (!session.sessionId) {
        session.sessionId = uuidv4();
        console.log(
          `🔄 Assigned new sessionId to session originally hosted by: ${session.host}`
        );
      }

      // Migrate host
      if (!/^\d+$/.test(session.host)) {
        // If host is not a snowflake (Discord ID)
        const user = await client.users.fetch(session.host).catch(() => null);
        if (user) {
          session.host = user.id;
          console.log(
            `🔄 Updated host for session ${session.sessionId} to ${user.id}`
          );
        } else {
          console.log(`🔍 User not found for host: ${session.host}`);
        }
      }

      // Migrate gamers
      session.gamers = await Promise.all(
        session.gamers.map(async (gamer) => {
          if (/^\d+$/.test(gamer.userId)) {
            return gamer; // Already a snowflake
          }
          const user = await client.users.fetch(gamer.userId).catch(() => null);
          if (user) {
            console.log(
              `🔄 Updated gamer ${gamer.userId} to ${user.id} in session ${session.sessionId}`
            );
            return {
              ...gamer.toObject(),
              userId: user.id,
            };
          } else {
            console.log(`🔍 User not found for gamer: ${gamer.userId}`);
            return gamer; // Keep original if user not found
          }
        })
      );

      await session.save();
      console.log(`✅ Migrated session: ${session.sessionId}`);
    }

    console.log("🎉 Migration completed successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN);
