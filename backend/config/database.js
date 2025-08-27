const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Database configuration with environment variables
const sequelize = new Sequelize(
    process.env.DB_NAME || 'electricity_app',
    process.env.DB_USER || 'electricity_user',
    process.env.DB_PASSWORD || 'electricity_password',
    {
        host: process.env.DB_HOST || 'database', // Using service name from docker-compose
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        logging: (msg) => logger.debug(msg),
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Test the database connection
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        logger.info('Database connection has been established successfully.');
        return true;
    } catch (error) {
        logger.error('Unable to connect to the database:', error);
        throw error;
    }
};

module.exports = {
    sequelize,
    testConnection
};
