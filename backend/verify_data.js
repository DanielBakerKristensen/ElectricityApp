const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Force localhost for local execution
if (!process.env.DOCKER_ENV) {
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'electricity_user';
    process.env.DB_PASSWORD = 'electricity_password';
}

const { sequelize } = require('./config/database');

async function checkData() {
    try {
        const results = await sequelize.query(
            `SELECT timestamp, quantity, aggregation_level 
             FROM consumption_data 
             WHERE timestamp >= '2025-11-14' AND timestamp <= '2025-11-24'
             ORDER BY timestamp ASC`,
            { type: sequelize.QueryTypes.SELECT }
        );

        console.log(`Found ${results.length} records.`);
        if (results.length > 0) {
            console.log('Sample records:', results.slice(0, 3));
            console.log('Last records:', results.slice(-3));
        }
    } catch (error) {
        console.error('Error querying database:', error);
    } finally {
        await sequelize.close();
    }
}

checkData();
