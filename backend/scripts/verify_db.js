const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME || 'electricity_app',
    process.env.DB_USER || 'electricity_user',
    process.env.DB_PASSWORD || 'electricity_password',
    {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        logging: false,
    }
);

async function check() {
    try {
        await sequelize.authenticate();
        console.log('DB Connected.');

        const consumption = await sequelize.query(
            `SELECT metering_point_id, MAX(timestamp) as last_val, COUNT(*) as count 
             FROM consumption_data 
             GROUP BY metering_point_id`,
            { type: sequelize.QueryTypes.SELECT }
        );
        console.log('--- Consumption Data ---');
        console.table(consumption);

        const logs = await sequelize.query(
            `SELECT * FROM data_sync_log ORDER BY created_at DESC LIMIT 5`,
            { type: sequelize.QueryTypes.SELECT }
        );
        console.log('--- Latest Sync Logs ---');
        console.table(logs);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
}

check();
