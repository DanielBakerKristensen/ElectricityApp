const winston = require('winston');
const { combine, timestamp, printf, colorize, json } = winston.format;

// Define log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ' ' + JSON.stringify(metadata, null, 2);
    }
    return msg;
});

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        process.env.NODE_ENV === 'production' ? json() : combine(colorize(), logFormat)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ],
    exitOnError: false
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const logDir = 'logs';

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Add a stream for morgan (HTTP request logging)
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

module.exports = logger;
