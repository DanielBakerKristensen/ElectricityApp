const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const logger = require('../utils/logger');
const { Property, MeteringPoint } = require('../models');
const { sequelize } = require('../config/database');
const EloverblikService = require('../services/eloverblik-service');
const SyncService = require('../services/sync-service');

async function manualSyncGap() {
    try {
        await sequelize.authenticate();
        logger.info('Database connection established successfully.');

        // Initialize services
        const syncService = new SyncService(EloverblikService, sequelize, logger);

        const propertyId = process.env.DEBUG_PROPERTY_ID; // Optional: target specific property

        logger.info('Starting manual gap sync...');

        // Defined gap period
        const dateFrom = '2026-01-14';
        const dateTo = '2026-01-21';

        logger.info(`Target period: ${dateFrom} to ${dateTo}`);

        const result = await syncService.syncPropertyConsumption({
            propertyId: propertyId ? parseInt(propertyId) : undefined,
            dateFrom,
            dateTo
        });

        logger.info('Gap sync completed', { result: JSON.stringify(result, null, 2) });

    } catch (error) {
        logger.error('Error executing gap sync:', error);
    } finally {
        await sequelize.close();
    }
}

manualSyncGap();
