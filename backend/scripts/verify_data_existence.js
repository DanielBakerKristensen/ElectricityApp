const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize } = require('../config/database');

async function verifyData() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const meteringPointId = '571313144500430342'; // ID from previous log
        const dateFrom = '2026-01-07';

        const query = `
            SELECT timestamp, quantity, quality 
            FROM consumption_data 
            WHERE metering_point_id = :mpId 
            AND timestamp >= :dateFrom
            ORDER BY timestamp ASC
        `;

        const results = await sequelize.query(query, {
            replacements: { mpId: meteringPointId, dateFrom },
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`Found ${results.length} records since ${dateFrom}`);
        if (results.length > 0) {
            console.log('First 3 records:', results.slice(0, 3));
            console.log('Last 3 records:', results.slice(-3));
        } else {
            console.log('WARN: No records found!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

verifyData();
