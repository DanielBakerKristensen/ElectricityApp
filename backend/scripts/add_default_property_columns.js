const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

async function migrate() {
    try {
        console.log('Starting migration to add defaultPropertyId and defaultMeetingPointId...');
        await sequelize.authenticate();
        console.log('Database connected.');

        const queryInterface = sequelize.getQueryInterface();

        // Add defaultPropertyId column if it doesn't exist
        try {
            await queryInterface.addColumn('users', 'defaultPropertyId', {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'properties',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
            console.log('Added defaultPropertyId column.');
        } catch (error) {
            if (error.original && error.original.code === '42701') {
                console.log('defaultPropertyId column already exists.');
            } else {
                console.error('Error adding defaultPropertyId:', error.message);
            }
        }

        // Add defaultMeetingPointId column if it doesn't exist
        try {
            await queryInterface.addColumn('users', 'defaultMeetingPointId', {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'metering_points_config',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
            console.log('Added defaultMeetingPointId column.');
        } catch (error) {
            if (error.original && error.original.code === '42701') {
                console.log('defaultMeetingPointId column already exists.');
            } else {
                console.error('Error adding defaultMeetingPointId:', error.message);
            }
        }

        console.log('Migration completed.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
