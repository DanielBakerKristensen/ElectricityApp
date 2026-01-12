const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { sequelize } = require('../config/database');
const { Property, WeatherData } = require('../models');

async function backfillData() {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');

        const properties = await Property.findAll();
        const [weatherDataToUpdate] = await sequelize.query(
            'SELECT id, location_id FROM weather_data WHERE property_id IS NULL'
        );

        for (const record of weatherDataToUpdate) {
            if (!record.location_id) {
                console.warn(`Skipping record ${record.id} as it has no location_id.`);
                continue;
            }

            const [latitude, longitude] = record.location_id.split(',').map(parseFloat);

            const property = properties.find(p => 
                parseFloat(p.latitude) === latitude && parseFloat(p.longitude) === longitude
            );

            if (property) {
                await WeatherData.update(
                    { property_id: property.id },
                    { where: { id: record.id } }
                );
                console.log(`Updated weather data record ${record.id} with property_id ${property.id}`);
            } else {
                console.warn(`No property found for weather data record ${record.id} with location_id ${record.location_id}`);
            }
        }

    } catch (error) {
        console.error('Unable to backfill data:', error);
    } finally {
        await sequelize.close();
    }
}

backfillData();
