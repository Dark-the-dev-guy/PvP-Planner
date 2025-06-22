// commands/debug.js
const { SlashCommandBuilder } = require("discord.js");
const Session = require("../models/Session");
const logger = require("../utils/logger");
const { validateSession } = require("../utils/sessionValidator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debugsession")
    .setDescription("Debug a session's metadata and roster")
    .addStringOption((option) =>
      option
        .setName("session_id")
        .setDescription("The session ID to debug")
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("repair")
        .setDescription("Attempt to repair inconsistencies in the session")
        .setRequired(false)
    ),
    
  async execute(interaction) {
    // Only allow server admins to use this
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        content: "❌ This command is only available to server administrators.",
        ephemeral: true
      });
    }
    
    const sessionId = interaction.options.getString("session_id");
    const shouldRepair = interaction.options.getBoolean("repair") || false;
    
    try {
      // Fetch the session
      let session = await Session.findOne({ sessionId });
      
      if (!session) {
        return interaction.reply({
          content: "❌ Session not found with that ID.",
          ephemeral: true
        });
      }
      
      // Log that we're debugging this session
      logger.info(`Admin ${interaction.user.tag} (${interaction.user.id}) is debugging session ${sessionId}`);
      
      // If repair is requested, validate and fix the session
      if (shouldRepair) {
        await interaction.deferReply({ ephemeral: true });
        
        // Create a copy of the original session for comparison
        const originalSession = JSON.parse(JSON.stringify(session.toObject()));
        
        // Validate and repair the session
        session = validateSession(session);
        await session.save();
        
        logger.info(`Session ${sessionId} repaired by ${interaction.user.tag}`);
        
        // Detailed information about what was fixed
        const changes = compareSessionChanges(originalSession, session.toObject());
        
        // Format the session data for display
        const debugInfo = `
## Session ${session.sessionId} (REPAIRED)
- Game Mode: ${session.gameMode}
- Category: ${session.meta?.category || "Not set"}
- Date: ${session.date.toISOString()}
- Role Requirements: ${JSON.stringify(session.meta?.roleRequirements || "Not set")}

### Changes Made
${changes.length > 0 ? changes.join('\n') : "No changes were needed"}

### Players (${session.gamers.length})
${session.gamers.map(g => `- ${g.username} (${g.userId}): Status=${g.status}, Role=${g.role || "None"}, Class=${g.wowClass || "None"}, Spec=${g.wowSpec || "None"}`).join('\n')}
        `;
        
        return interaction.editReply({
          content: debugInfo,
          ephemeral: true
        });
      }
      
      // Format the session data for display (no repair)
      const debugInfo = `
## Session ${session.sessionId}
- Game Mode: ${session.gameMode}
- Category: ${session.meta?.category || "Not set"}
- Date: ${session.date.toISOString()}
- Role Requirements: ${JSON.stringify(session.meta?.roleRequirements || "Not set")}

### Players (${session.gamers.length})
${session.gamers.map(g => `- ${g.username} (${g.userId}): Status=${g.status}, Role=${g.role || "None"}, Class=${g.wowClass || "None"}, Spec=${g.wowSpec || "None"}`).join('\n')}
      `;
      
      return interaction.reply({
        content: debugInfo,
        ephemeral: true
      });
    } catch (error) {
      logger.error(`Error debugging session ${sessionId}:`, error);
      
      return interaction.reply({
        content: `❌ Error debugging session: ${error.message}`,
        ephemeral: true
      });
    }
  }
};

/**
 * Compare changes between original and repaired session
 * @param {Object} original - Original session data
 * @param {Object} repaired - Repaired session data
 * @returns {Array} - List of changes made
 */
function compareSessionChanges(original, repaired) {
  const changes = [];
  
  // Check for category changes
  if (original.meta?.category !== repaired.meta?.category) {
    changes.push(`- Category changed from "${original.meta?.category || 'none'}" to "${repaired.meta?.category}"`);
  }
  
  // Check for role requirement changes
  const originalReqs = JSON.stringify(original.meta?.roleRequirements || {});
  const repairedReqs = JSON.stringify(repaired.meta?.roleRequirements || {});
  
  if (originalReqs !== repairedReqs) {
    changes.push(`- Role requirements changed from ${originalReqs} to ${repairedReqs}`);
  }
  
  // Check for changes in player roles
  if (original.gamers && repaired.gamers) {
    for (let i = 0; i < original.gamers.length; i++) {
      if (repaired.gamers[i] && original.gamers[i].userId === repaired.gamers[i].userId) {
        // Check for role changes
        if (original.gamers[i].role !== repaired.gamers[i].role) {
          changes.push(`- User ${original.gamers[i].username}'s role changed from "${original.gamers[i].role || 'none'}" to "${repaired.gamers[i].role || 'none'}"`);
        }
        
        // Check for class/spec changes
        if (original.gamers[i].wowClass !== repaired.gamers[i].wowClass) {
          changes.push(`- User ${original.gamers[i].username}'s class changed from "${original.gamers[i].wowClass || 'none'}" to "${repaired.gamers[i].wowClass || 'none'}"`);
        }
        
        if (original.gamers[i].wowSpec !== repaired.gamers[i].wowSpec) {
          changes.push(`- User ${original.gamers[i].username}'s spec changed from "${original.gamers[i].wowSpec || 'none'}" to "${repaired.gamers[i].wowSpec || 'none'}"`);
        }
      }
    }
  }
  
  return changes;
}