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
const { Property } = require('./models');
const SyncService = require('./services/sync-service');
const eloverblikService = require('./services/eloverblik-service');

async function run() {
    try {
        console.log('Initializing services...');
        const syncService = new SyncService(eloverblikService, sequelize, logger);

        const dateFrom = '2025-01-01';
        const dateTo = '2025-12-31';

        console.log(`Fetching properties to backfill from ${dateFrom} to ${dateTo}...`);
        const properties = await Property.findAll();

        if (properties.length === 0) {
            console.log('No properties found in database to sync.');
            return;
        }

        for (const property of properties) {
            console.log(`\n--- Syncing Property: ${property.name} (ID: ${property.id}) ---`);
            const result = await syncService.syncPropertyConsumption({
                propertyId: property.id,
                dateFrom,
                dateTo
            });
            console.log(`Result for ${property.name}:`, JSON.stringify(result, null, 2));
        }

        console.log('\n✅ All property backfills completed.');
    } catch (error) {
        console.error('Backfill failed:', error);
    } finally {
        await sequelize.close();
    }
}

run();
