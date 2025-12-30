const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

// Load env vars similar to server.js
const envPath = path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });

// Force localhost for local execution if not in docker
if (!process.env.DOCKER_ENV) {
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'electricity_user';
    process.env.DB_PASSWORD = 'electricity_password';
}

const { sequelize } = require('./config/database');
const SyncService = require('./services/sync-service');
const eloverblikService = require('./services/eloverblik-service');

async function run() {
    try {
        console.log('Initializing services...');
        const syncService = new SyncService(eloverblikService, sequelize, logger);

        console.log('Starting backfill for range: 2024-01-01 to 2024-12-31');
        const result = await syncService.syncConsumptionData({
            dateFrom: '2024-01-01',
            dateTo: '2024-12-31'
        });

        console.log('Backfill completed. Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Backfill failed:', error);
    } finally {
        await sequelize.close();
    }
}

run();
