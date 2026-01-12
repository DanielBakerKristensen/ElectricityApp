const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function addColumn() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');

        const table = await queryInterface.describeTable('weather_data');

        if (!table.property_id) {
            await queryInterface.addColumn('weather_data', 'property_id', {
                type: DataTypes.INTEGER,
                allowNull: true, // Allow null temporarily for backfill
                references: {
                    model: 'properties',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
            console.log('Column property_id added to weather_data table.');
        } else {
            console.log('Column property_id already exists in weather_data table.');
        }

    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await sequelize.close();
    }
}

addColumn();
