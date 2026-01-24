const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const AnalyticsService = require('../services/analytics-service');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

async function testWeekOverWeek() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const analyticsService = new AnalyticsService(sequelize, logger);

        const meteringPointId = '571313144500430342';
        const dateFrom = '2026-01-07';
        const dateTo = '2026-01-14';

        console.log(`Testing Week-Over-Week for ${meteringPointId} from ${dateFrom} to ${dateTo}`);

        const result = await analyticsService.getWeekOverWeekComparison({
            meteringPointId,
            dateFrom,
            dateTo
        });

        console.log('Result count:', result.length);
        if (result.length > 0) {
            console.log('Sample record:', JSON.stringify(result[0], null, 2));
        } else {
            console.warn('No records returned.');
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await sequelize.close();
    }
}

testWeekOverWeek();
