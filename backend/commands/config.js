// commands/config.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require("discord.js");
const GuildConfig = require("../models/GuildConfig");
const logger = require("../utils/logger");

// Helper function to check admin permissions
function hasAdminPermission(interaction) {
  return interaction.member.permissions.has("ADMINISTRATOR") || 
         interaction.member.permissions.has("MANAGE_GUILD");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure the Tavernkeeper bot for your server"),

  async execute(interaction) {
    try {
      // Check permissions - only admins can change config
      if (!hasAdminPermission(interaction)) {
        return interaction.reply({
          content: "❌ You need Administrator or Manage Server permissions to change bot configuration.",
          ephemeral: true
        });
      }

      const guildId = interaction.guild.id;
      
      // Get current config or create default
      let guildConfig = await GuildConfig.findOne({ guildId });
      if (!guildConfig) {
        guildConfig = await GuildConfig.getDefaultConfig(guildId);
      }
      
      // Create an embed to display current configuration
      const configEmbed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle("🍺 Tavernkeeper Configuration")
        .setDescription(`Current settings for ${interaction.guild.name}`)
        .addFields(
          { name: "🎭 Persona", value: `${guildConfig.personality.persona || "tavernkeeper"}`, inline: true },
          { name: "🔊 Persona Tone", value: `${guildConfig.personality.personaTone || "neutral"}`, inline: true },
          { name: "💬 Sass Level", value: `${guildConfig.personality.sassLevel || 3}/5`, inline: true },
          { name: "⏰ Reminder Time", value: `${guildConfig.alerts.channelReminderTime || 15} minutes before`, inline: true },
          { name: "📅 Date Format", value: guildConfig.display.dateFormat || "MM-DD", inline: true },
          { name: "🔔 Reminders Channel", value: guildConfig.alerts.reminderChannelId ? 
            `<#${guildConfig.alerts.reminderChannelId}>` : "Same as display channel", inline: true }
        )
        .setFooter({ text: "Use the buttons below to change these settings" });
        
      // Display channels as a list
      if (guildConfig.displayChannels && guildConfig.displayChannels.length > 0) {
        const channelList = guildConfig.displayChannels.map(id => `<#${id}>`).join(', ');
        configEmbed.addFields({ name: "📢 Display Channels", value: channelList });
      }
      
      // Display specialty channels if configured
      if (guildConfig.channels) {
        const channelFields = [];
        
        if (guildConfig.channels.scheduleChannelId) {
          channelFields.push({
            name: "📆 Schedule Channel",
            value: `<#${guildConfig.channels.scheduleChannelId}>`,
            inline: true
          });
        }
        
        if (guildConfig.channels.eventsChannelId) {
          channelFields.push({
            name: "🎪 Events Channel",
            value: `<#${guildConfig.channels.eventsChannelId}>`,
            inline: true
          });
        }
        
        if (guildConfig.channels.regularChannelId) {
          channelFields.push({
            name: "💬 Regular Chat Channel",
            value: `<#${guildConfig.channels.regularChannelId}>`,
            inline: true
          });
        }
        
        if (channelFields.length > 0) {
          configEmbed.addFields(channelFields);
        }
      }
        
      // Create first row of action buttons
      const actionRow1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`config_persona_menu`)
            .setLabel("Change Persona")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`config_tone_menu`)
            .setLabel("Change Tone")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`config_sass_menu`)
            .setLabel("Adjust Sass")
            .setStyle(ButtonStyle.Secondary)
        );
      
      // Create second row of action buttons
      const actionRow2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`config_reminder_menu`)
            .setLabel("Reminder Settings")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`config_dates_menu`)
            .setLabel("Date Format")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`config_channels_menu`)
            .setLabel("Channel Settings")
            .setStyle(ButtonStyle.Primary)
        );
      
      // Create third row with less common settings
      const actionRow3 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`config_display_menu`)
            .setLabel("Set Display Channel")
            .setStyle(ButtonStyle.Secondary)
        );
        
      return interaction.reply({ 
        embeds: [configEmbed], 
        components: [actionRow1, actionRow2, actionRow3], 
        ephemeral: true 
      });
    } catch (error) {
      logger.error("Error in /config command:", error);
      return interaction.reply({
        content: "❌ An error occurred while updating configuration. Please try again later.",
        ephemeral: true
      });
    }
  },
  
  // Handler for button interactions related to config
  async handleConfigButton(interaction) {
    try {
      // Check permissions
      if (!hasAdminPermission(interaction)) {
        return interaction.reply({
          content: "❌ You need Administrator or Manage Server permissions to change bot configuration.",
          ephemeral: true
        });
      }
      
      const [_, action, subaction] = interaction.customId.split("_");
      const guildId = interaction.guild.id;
      
      // Get current config
      let guildConfig = await GuildConfig.findOne({ guildId });
      if (!guildConfig) {
        guildConfig = await GuildConfig.getDefaultConfig(guildId);
      }
      
      // Handle different button actions
      switch (`${action}_${subaction}`) {
        case "persona_menu": {
          // Create select menu for persona
          const row = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("config_set_persona")
                .setPlaceholder("Select a persona")
                .addOptions([
                  { label: "Tavernkeeper (Witty)", value: "tavernkeeper", description: "A sarcastic fantasy barkeep", emoji: "🍺" },
                  { label: "Bard (Chaotic & Musical)", value: "bard", description: "Enthusiastic and lyrical", emoji: "🎵" },
                  { label: "Cleric (Supportive & Calm)", value: "cleric", description: "Helpful and serene", emoji: "🕊️" },
                  { label: "Warlock (Dark Humor)", value: "warlock", description: "Edgy with demonic references", emoji: "😈" },
                  { label: "Strategist (Tactical)", value: "strategist", description: "Efficient and focused", emoji: "🎯" },
                  { label: "Dungeon Master (Storyteller)", value: "dungeonmaster", description: "Immersive narrator", emoji: "🎲" },
                  { label: "Unhinged (Premium)", value: "unhinged", description: "Chaotic and unpredictable", emoji: "🔥" }
                ])
            );
            
          return interaction.reply({
            content: "Select the personality type for the bot:",
            components: [row],
            ephemeral: true
          });
        }
        
        case "tone_menu": {
          // Create select menu for persona tone
          const row = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("config_set_tone")
                .setPlaceholder("Select persona tone")
                .addOptions([
                  { label: "Neutral Tone", value: "neutral", description: "Default, neutral tone", emoji: "⚖️" },
                  { label: "Male-Coded", value: "male", description: "Masculine-leaning language", emoji: "👨" },
                  { label: "Female-Coded", value: "female", description: "Feminine-leaning language", emoji: "👩" }
                ])
            );
            
          return interaction.reply({
            content: "Select the tone for the bot's personality:",
            components: [row],
            ephemeral: true
          });
        }
        
        case "sass_menu": {
          // Create select menu for sass level
          const row = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("config_set_sass")
                .setPlaceholder("Select sass level")
                .addOptions([
                  { label: "Level 0: Pure Helper", value: "0", description: "No sass, just helpful", emoji: "😇" },
                  { label: "Level 1: Mild", value: "1", description: "Slightly playful", emoji: "🙂" },
                  { label: "Level 2: Moderate", value: "2", description: "Occasional quips", emoji: "😏" },
                  { label: "Level 3: Sassy", value: "3", description: "Regular banter", emoji: "😎" },
                  { label: "Level 4: Extra Spicy", value: "4", description: "Frequent teasing", emoji: "🔥" },
                  { label: "Level 5: Verbal Duelist", value: "5", description: "Maximum sass", emoji: "☠️" }
                ])
            );
            
          return interaction.reply({
            content: "Select the sass level for the bot:",
            components: [row],
            ephemeral: true
          });
        }
        
        case "reminder_menu": {
          // Create select menu for reminder time
          const row = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("config_set_reminder")
                .setPlaceholder("Select reminder time")
                .addOptions([
                  { label: "10 minutes before", value: "10", description: "Short notice" },
                  { label: "15 minutes before", value: "15", description: "Standard timing" },
                  { label: "20 minutes before", value: "20", description: "Extra time to prepare" },
                  { label: "30 minutes before", value: "30", description: "Plenty of advance notice" }
                ])
            );
            
          return interaction.reply({
            content: "Select how long before events to send reminders:",
            components: [row],
            ephemeral: true
          });
        }
        
        case "dates_menu": {
          // Create select menu for date format
          const row = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("config_set_dateformat")
                .setPlaceholder("Select date format")
                .addOptions([
                  { label: "MM-DD (US Style)", value: "MM-DD", description: "Month first, then day" },
                  { label: "DD-MM (European Style)", value: "DD-MM", description: "Day first, then month" }
                ])
            );
            
          return interaction.reply({
            content: "Select your preferred date format:",
            components: [row],
            ephemeral: true
          });
        }
        
        case "display_menu": {
          // CHANGED: Create a dropdown of text channels instead of asking for manual input
          // Get all text channels with send message permissions
          const eligibleChannels = interaction.guild.channels.cache.filter(
            channel => channel.type === ChannelType.GuildText && 
                      channel.permissionsFor(interaction.guild.members.me).has('SendMessages')
          );
          
          // If no eligible channels found, notify the user
          if (eligibleChannels.size === 0) {
            return interaction.reply({
              content: "❌ No text channels found where I have permission to send messages. Please check my permissions and try again.",
              ephemeral: true
            });
          }
          
          // Create channel select menu
          const channelOptions = eligibleChannels.map(channel => ({
            label: channel.name.length > 25 ? channel.name.substring(0, 22) + '...' : channel.name,
            value: channel.id,
            description: `#${channel.name}`.substring(0, 50)
          }));
          
          const row = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("config_set_displayChannel")
                .setPlaceholder("Select a channel")
                .addOptions(channelOptions)
            );
            
          return interaction.reply({
            content: "Select a channel to set as your display channel:",
            components: [row],
            ephemeral: true
          });
        }
        
        case "channels_menu": {
          // Create message explaining channel setup with buttons
          const row1 = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId("config_set_scheduleChannel")
                .setLabel("Set Schedule Channel")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("config_set_eventsChannel")
                .setLabel("Set Events Channel")
                .setStyle(ButtonStyle.Primary)
            );
            
          const row2 = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId("config_set_regularChannel")
                .setLabel("Set Regular Channel")
                .setStyle(ButtonStyle.Secondary)
            );
          
          return interaction.reply({
            content: "Configure channels for different functions. Select a button to set each channel type:",
            components: [row1, row2],
            ephemeral: true
          });
        }
        
        case "select_display": {
          // REMOVED: No longer needed as we now use a dropdown
          return interaction.reply({
            content: "This option has been updated. Please use the new channel selector instead.",
            ephemeral: true
          });
        }
        
        case "set_scheduleChannel": 
        case "set_eventsChannel":
        case "set_regularChannel": {
          // CHANGED: Create a dropdown of text channels instead of asking for manual input
          const channelType = subaction.replace('set_', '').replace('Channel', '');
          
          // Get all text channels with send message permissions
          const eligibleChannels = interaction.guild.channels.cache.filter(
            channel => channel.type === ChannelType.GuildText && 
                      channel.permissionsFor(interaction.guild.members.me).has('SendMessages')
          );
          
          // If no eligible channels found, notify the user
          if (eligibleChannels.size === 0) {
            return interaction.reply({
              content: "❌ No text channels found where I have permission to send messages. Please check my permissions and try again.",
              ephemeral: true
            });
          }
          
          // Create channel select menu
          const channelOptions = eligibleChannels.map(channel => ({
            label: channel.name.length > 25 ? channel.name.substring(0, 22) + '...' : channel.name,
            value: channel.id,
            description: `#${channel.name}`.substring(0, 50)
          }));
          
          const row = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`config_select_${channelType}Channel`)
                .setPlaceholder("Select a channel")
                .addOptions(channelOptions)
            );
            
          return interaction.reply({
            content: `Select a channel to set as the ${channelType} channel:`,
            components: [row],
            ephemeral: true
          });
        }
        
        default:
          return interaction.reply({
            content: "❌ Unknown button action.",
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error("Error handling config button:", error);
      return interaction.reply({
        content: "❌ An error occurred while processing the button. Please try again later.",
        ephemeral: true
      });
    }
  },
  
  // Handler for select menu interactions related to config
  async handleConfigSelect(interaction) {
    try {
      // Check permissions
      if (!hasAdminPermission(interaction)) {
        return interaction.reply({
          content: "❌ You need Administrator or Manage Server permissions to change bot configuration.",
          ephemeral: true
        });
      }
      
      const [_, action, setting] = interaction.customId.split("_");
      const value = interaction.values[0];
      const guildId = interaction.guild.id;
      
      // Get current config
      let guildConfig = await GuildConfig.findOne({ guildId });
      if (!guildConfig) {
        guildConfig = await GuildConfig.getDefaultConfig(guildId);
      }
      
      // Handle different select actions
      if (action === "set") {
        switch (setting) {
          case "persona": {
            // Check for premium restrictions
            //if (value === "unhinged" && !guildConfig.personality.isPremium) {
            //  return interaction.update({
            //    content: "❌ The Unhinged persona is only available for premium guilds. Please upgrade or select a different persona.",
            //    components: []
            //  });
            //}
            
            // Update persona setting
            guildConfig.personality.persona = value;
            await guildConfig.save();
            
            // Get a sample message based on persona
            const sampleMessages = {
              tavernkeeper: "Aye there, I'll be schedulin' yer event! Just don't be late or I'll have to cut ye off for the night!",
              bard: "💫 Oh joyous day! Another gathering of heroes to be scheduled with song and merriment! 🎵 Your event awaits!",
              cleric: "Blessings upon you. I shall schedule your event with care and ensure all are notified in proper time.",
              warlock: "Heh... your event is scheduled. Let's hope everyone survives the encounter... I need more souls for my collection.",
              strategist: "Event scheduled efficiently. Participants are confirmed at 15:00. Review your tactical positioning before engagement.",
              dungeonmaster: "The scrolls have been inscribed, adventurer! Your quest awaits on the morrow. May the dice favor your journey!",
              unhinged: "I SCHEDULED YOUR STUPID EVENT. Happy now? *eye twitches* I mean... it's at 8pm. I might show up. Might burn the place down instead. We'll see!"
            };
            
            const personality = sampleMessages[value] || "Your event has been scheduled.";
            
            return interaction.update({
              content: `✅ Persona updated to: **${value}**\n\n**Sample message with new persona:**\n${personality}`,
              components: []
            });
          }
          
          case "tone": {
            // Update persona tone setting
            guildConfig.personality.personaTone = value;
            await guildConfig.save();
            
            // Get sample messages based on tone and current persona
            const currentPersona = guildConfig.personality.persona || "tavernkeeper";
            
            // Sample messages for different tones across personas
            const toneExamples = {
              neutral: {
                tavernkeeper: "Welcome to the tavern! What'll it be?",
                bard: "A tale for the ages begins now!",
                cleric: "May the light guide your path.",
                warlock: "The shadows whisper of your arrival.",
                strategist: "Analyzing the situation. Proceed with caution.",
                dungeonmaster: "The adventure awaits brave souls!",
                unhinged: "Is anyone else hearing these voices or just me?"
              },
              male: {
                tavernkeeper: "Grab a seat, lad! What'll ya have?",
                bard: "Ho there, brave sir! A song for your journey?",
                cleric: "My brother in faith, let me offer a blessing.",
                warlock: "Dark forces bend to my will, mortal man.",
                strategist: "Stand at attention, soldier! We have a plan to execute.",
                dungeonmaster: "Gather round, brave warriors! Your quest beckons!",
                unhinged: "Listen here, buddy, I don't take orders from anyone!"
              },
              female: {
                tavernkeeper: "Welcome, dear! Find a cozy spot by the fire.",
                bard: "My lady, shall I compose a ballad for your journey?",
                cleric: "My sister in faith, may light surround you.",
                warlock: "The darkness speaks through me, mortal woman.",
                strategist: "The pieces are in place. We move on my command.",
                dungeonmaster: "Gather close, my dears, as I spin tales of adventure!",
                unhinged: "Oh sweetie, you have NO idea what I'm capable of..."
              }
            };
            
            const sampleMessage = toneExamples[value]?.[currentPersona] || 
                                "Your event has been scheduled.";
            
            return interaction.update({
              content: `✅ Persona tone updated to: **${value}**\n\n**Sample message with new tone:**\n${sampleMessage}`,
              components: []
            });
          }
          
          case "sass": {
            // Update sass level
            const sassLevel = parseInt(value);
            guildConfig.personality.sassLevel = sassLevel;
            await guildConfig.save();
            
            // Get sample message based on sass level
            let sampleMessage;
            switch (sassLevel) {
              case 0:
                sampleMessage = "I'll help set up your schedule and send polite reminders to everyone.";
                break;
              case 1:
                sampleMessage = "I'll set up your event and remind your group when it's time to play.";
                break;
              case 2:
                sampleMessage = "I've scheduled your event. Don't worry, I'll remind everyone so they don't forget.";
                break;
              case 3:
                sampleMessage = "Event scheduled! I'll remind everyone, though some of you clearly need a better memory potion.";
                break;
              case 4:
                sampleMessage = "Fine, I've scheduled your event. Try actually showing up this time instead of going AFK in Goldshire.";
                break;
              case 5:
                sampleMessage = "Another event? Look at the calendar sometime - I'm not your personal secretary. But fine, it's scheduled. Don't be late or I'll sign you up as a healer next time.";
                break;
              default:
                sampleMessage = "I've scheduled your event and will remind everyone when it's time.";
            }
            
            return interaction.update({
              content: `✅ Sass level updated to: **${sassLevel}/5**\n\n**Sample message with new sass level:**\n${sampleMessage}`,
              components: []
            });
          }
          
          case "reminder": {
            // Update reminder time
            const reminderTime = parseInt(value);
            guildConfig.alerts.channelReminderTime = reminderTime;
            await guildConfig.save();
            
            return interaction.update({
              content: `✅ Reminder time updated to: **${reminderTime} minutes** before events`,
              components: []
            });
          }
          
          case "dateformat": {
            // Update date format
            guildConfig.display.dateFormat = value;
            await guildConfig.save();
            
            // Create sample date in both formats
            const now = new Date();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            
            const sampleMmDd = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
            const sampleDdMm = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
            
            return interaction.update({
              content: `✅ Date format has been set to **${value}**\n\nToday's date will now display as: ${value === "MM-DD" ? sampleMmDd : sampleDdMm}`,
              components: []
            });
          }
          
          // ADDED: Handle channel selection for display and specific channel types
          case "displayChannel": {
            // Add to displayChannels if not already included
            if (!guildConfig.displayChannels) {
              guildConfig.displayChannels = [];
            }
            
            // Add to displayChannels if not already included
            if (!guildConfig.displayChannels.includes(value)) {
              guildConfig.displayChannels.push(value);
            }
            
            await guildConfig.save();
            
            // Get channel info for confirmation message
            const channel = interaction.guild.channels.cache.get(value);
            
            return interaction.update({
              content: `✅ Display channel has been set to <#${value}> (${channel ? channel.name : 'Unknown Channel'}).`,
              components: []
            });
          }
          
          // Added handlers for the channel type selections
          default:
            // Check if this is a channel selection action
            if (setting.endsWith('Channel')) {
              const channelType = setting.replace('Channel', '');
              
              // Ensure the channels object exists
              if (!guildConfig.channels) {
                guildConfig.channels = {};
              }
              
              // Set the appropriate channel
              const channelSettingKey = `${channelType}ChannelId`;
              guildConfig.channels[channelSettingKey] = value;
              await guildConfig.save();
              
              // Get channel info for confirmation message
              const channel = interaction.guild.channels.cache.get(value);
              
              return interaction.update({
                content: `✅ ${channelType.charAt(0).toUpperCase() + channelType.slice(1)} channel has been set to <#${value}> (${channel ? channel.name : 'Unknown Channel'}).`,
                components: []
              });
            }
            
            return interaction.update({
              content: "❌ Unknown setting type.",
              components: []
            });
        }
      }
      
      // Handle selection menus for channel settings
      if (action === "select") {
        if (setting.endsWith('Channel')) {
          const channelType = setting.replace('Channel', '');
          
          // Ensure the channels object exists
          if (!guildConfig.channels) {
            guildConfig.channels = {};
          }
          
          // Set the appropriate channel type
          const channelSettingKey = `${channelType}ChannelId`;
          guildConfig.channels[channelSettingKey] = value;
          
          await guildConfig.save();
          
          // Get channel info for confirmation message
          const channel = interaction.guild.channels.cache.get(value);
          const displayName = channelType.charAt(0).toUpperCase() + channelType.slice(1);
          
          return interaction.update({
            content: `✅ ${displayName} channel has been set to <#${value}> (${channel ? channel.name : 'Unknown Channel'}).`,
            components: []
          });
        }
      }
      
      return interaction.update({
        content: "❌ Unknown select menu action.",
        components: []
      });
    } catch (error) {
      logger.error("Error handling config select menu:", error);
      return interaction.update({
        content: "❌ An error occurred while processing your selection. Please try again later.",
        components: []
      });
    }
  },
  
  // SIMPLIFIED: No longer need to handle message responses
  async handleConfigMessage(message, configAction) {
    try {
      await message.reply("This method has been updated. Please use the channel selector from the configuration menu instead.");
    } catch (error) {
      logger.error("Error in handleConfigMessage:", error);
    }
  }
};