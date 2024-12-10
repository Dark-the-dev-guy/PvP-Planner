// events/interactionCreate.js

const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Session = require("../models/Session");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton()) {
      const { customId } = interaction;
      const userId = interaction.user.id;
      const username = interaction.user.tag;

      // Expected customId formats:
      // 'letsgo_<sessionId>' or 'cantmakeit_<sessionId>'
      const [action, sessionId] = customId.split("_");

      if (!sessionId) {
        return interaction.reply({
          content: "❌ Invalid button interaction.",
          ephemeral: true,
        });
      }

      // Fetch the session by sessionId
      const session = await Session.findOne({ sessionId });

      if (!session) {
        return interaction.reply({
          content: "❌ Session not found.",
          ephemeral: true,
        });
      }

      if (action === "letsgo") {
        // Handle "Let's Go!" button
        await handleJoin(interaction, session, userId, username);
      } else if (action === "cantmakeit") {
        // Handle "Can't make it, cause I suck!" button
        await handleCantMakeIt(interaction, session, userId, username);
      }
    }
  },
};

// Handler Functions

async function handleJoin(interaction, session, userId, username) {
  const existingGamer = session.gamers.find((gamer) => gamer.userId === userId);

  if (existingGamer) {
    if (existingGamer.status === "attending") {
      return interaction.reply({
        content: "✅ You are already marked as attending the session.",
        ephemeral: true,
      });
    } else {
      existingGamer.status = "attending";
      existingGamer.reason = "";
      await session.save();
      await interaction.reply({
        content: "✅ Your status has been updated to attending the session.",
        ephemeral: true,
      });
    }
  } else {
    session.gamers.push({
      userId,
      username,
      status: "attending",
      reason: "",
    });
    await session.save();
    await interaction.reply({
      content: "✅ You have joined the session as a Gamer!",
      ephemeral: true,
    });
  }

  // Update the session display embed
  await updateSessionDisplay(interaction.client, session.sessionId);
}

async function handleCantMakeIt(interaction, session, userId, username) {
  const existingGamer = session.gamers.find((gamer) => gamer.userId === userId);

  if (existingGamer) {
    if (existingGamer.status === "not attending") {
      return interaction.reply({
        content: "✅ You are already marked as not attending the session.",
        ephemeral: true,
      });
    } else {
      existingGamer.status = "not attending";
      existingGamer.reason = ""; // Clear any previous reasons
      await session.save();
      await interaction.reply({
        content:
          "✅ Your status has been updated to not attending the session.",
        ephemeral: true,
      });
    }
  } else {
    session.gamers.push({
      userId,
      username,
      status: "not attending",
      reason: "",
    });
    await session.save();
    await interaction.reply({
      content: "✅ You have marked yourself as not attending the session.",
      ephemeral: true,
    });
  }

  // Update the session display embed
  await updateSessionDisplay(interaction.client, session.sessionId);
}

async function updateSessionDisplay(client, sessionId) {
  // Fetch the session
  const session = await Session.findOne({ sessionId });

  if (!session) {
    console.error(
      `Session with ID ${sessionId} not found during display update.`
    );
    return;
  }

  // Define the display channel
  const displayChannelId = process.env.DISPLAY_CHANNEL_ID; // Use environment variable
  const displayChannel = await client.channels
    .fetch(displayChannelId)
    .catch((err) => {
      console.error("Error fetching display channel:", err);
      return null;
    });

  if (!displayChannel) {
    console.error("Display channel not found.");
    return;
  }

  // Fetch the latest message with the specific embed title
  const messages = await displayChannel.messages.fetch({ limit: 100 });
  let displayMessage = messages.find(
    (msg) =>
      msg.author.id === client.user.id &&
      msg.embeds.length > 0 &&
      msg.embeds[0].title === "🎮 PvP Session Details"
  );

  if (!displayMessage) {
    // If no display message exists, send a new one
    displayMessage = await displayChannel.send({
      embeds: [constructEmbed(session)],
    });
  } else {
    // Edit the existing display message
    await displayMessage.edit({ embeds: [constructEmbed(session)] });
  }
}

function constructEmbed(session) {
  const attending = session.gamers.filter(
    (gamer) => gamer.status === "attending"
  );
  const notAttending = session.gamers.filter(
    (gamer) => gamer.status === "not attending"
  );
  const late = session.gamers.filter((gamer) => gamer.status === "late");

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("🎮 PvP Session Details")
    .addFields(
      {
        name: `Gamers (${attending.length})`,
        value:
          attending.length > 0
            ? attending.map((g) => `• <@${g.userId}>`).join("\n")
            : "No gamers have joined yet.",
      },
      {
        name: `Who Sucks? (${notAttending.length})`,
        value:
          notAttending.length > 0
            ? notAttending.map((g) => `• <@${g.userId}>`).join("\n")
            : "No one has opted out yet.",
      },
      {
        name: `Going to be Late (${late.length})`,
        value:
          late.length > 0
            ? late.map((g) => `• <@${g.userId}>`).join("\n")
            : "No one is marked as late.",
      }
    )
    .setTimestamp();

  return embed;
}
