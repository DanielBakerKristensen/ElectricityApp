const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function updateSchema() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');

        // Delete orphaned weather data
        const [results] = await sequelize.query('DELETE FROM weather_data WHERE property_id IS NULL');
        console.log(`Deleted ${results.rowCount} orphaned weather data records.`);


        // Remove old constraint and indexes
        await queryInterface.removeConstraint('weather_data', 'weather_data_location_timestamp_unique');
        await queryInterface.removeIndex('weather_data', 'weather_data_location_idx');

        // Remove location_id column
        await queryInterface.removeColumn('weather_data', 'location_id');
        console.log('Column location_id removed from weather_data table.');

        // Add new indexes
        await queryInterface.addIndex('weather_data', ['property_id', 'timestamp'], {
            unique: true,
            name: 'weather_data_property_timestamp_unique'
        });
        await queryInterface.addIndex('weather_data', ['property_id'], {
            name: 'weather_data_property_idx'
        });
        console.log('New indexes created on weather_data table.');

        // Make property_id not nullable
        await queryInterface.changeColumn('weather_data', 'property_id', {
            type: DataTypes.INTEGER,
            allowNull: false
        });
        console.log('Column property_id in weather_data table set to NOT NULL.');

    } catch (error) {
        console.error('Unable to update database schema:', error);
    } finally {
        await sequelize.close();
    }
}

updateSchema();
