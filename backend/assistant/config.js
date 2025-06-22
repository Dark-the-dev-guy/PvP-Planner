// assistant/config.js
module.exports = {
  // OpenAI model to use
  model: "gpt-4o",

  // Maximum tokens for response (bumped from 750)
  maxTokens: 800,

  // Temperature (0-1): lower = more focused, higher = more creative
  temperature: 0.8,

  // Whether to enable AI responses in DMs
  enableDMs: true,

  // Whether to enable AI responses when mentioned in servers
  enableMentions: true,

  // Max response length in characters (increased from 2000)
  maxResponseLength: 1500,

  // Enable conversational event creation
  enableEventCreation: true,

  // Enable conversational participation (signing up through conversation)
  enableParticipationHandling: true,

  // Enable config creation/updating at runtime
  enableConfigCreation: true,

  // Enable humor and banter
  enableBanter: true,

  // Set the confidence threshold for detecting intents (lowered from 0.65)
  intentThreshold: 0.6,

  // Set the bot's nickname (used in responses)
  botNickname: "PvPal",

  // Cooldown between AI responses (in milliseconds)
  responseCooldown: 1500,

  // Log level: 'debug', 'info', 'warn', 'error'
  logLevel: 'info'
};
