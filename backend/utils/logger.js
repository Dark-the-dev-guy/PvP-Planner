// utils/logger.js
let logger;

try {
  const winston = require('winston');
  
  // Create console transport that always works
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${service || 'Bot'}] ${level}: ${message} ${metaString}`;
      })
    )
  });
  
  // Create file transports
  const fileTransports = [
    new winston.transports.File({ 
      filename: "error.log", 
      level: "error",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: "combined.log",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),
  ];
  
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    defaultMeta: { service: "PvP-Planner-Bot" },
    transports: [
      consoleTransport, // Always include console transport for EB
      ...fileTransports
    ],
    // Handle uncaught exceptions
    exceptionHandlers: [
      consoleTransport,
      new winston.transports.File({ filename: 'exceptions.log' })
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
      consoleTransport,
      new winston.transports.File({ filename: 'rejections.log' })
    ]
  });
  
  // Test the logger immediately
  logger.info('Winston logger initialized successfully');
  
} catch (error) {
  // Fallback logger if winston fails to initialize
  console.error('Failed to initialize winston logger:', error);
  logger = {
    info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
    error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
    warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
    debug: (...args) => console.log('[DEBUG]', new Date().toISOString(), ...args),
    // Add other log levels as needed
  };
  
  // Test fallback logger
  logger.info('Fallback console logger initialized');
}

module.exports = logger;