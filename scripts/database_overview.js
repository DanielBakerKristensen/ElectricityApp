// Override database config for local connection
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'electricity_app';
process.env.DB_USER = 'electricity_user';
process.env.DB_PASSWORD = 'electricity_password';

const { sequelize } = require('./config/database');
const User = require('./models/User');
const Property = require('./models/Property');
const UserProperty = require('./models/UserProperty');
const MeteringPoint = require('./models/MeteringPoint');
const WeatherData = require('./models/WeatherData');
const RefreshToken = require('./models/RefreshToken');

// Import legacy models if they exist
const { DataTypes } = require('sequelize');

// Define legacy models for the original schema
const LegacyMeteringPoint = sequelize.define('LegacyMeteringPoint', {
    metering_point_id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    alias: DataTypes.STRING,
    type_of_mp: DataTypes.STRING,
    balance_supplier_name: DataTypes.STRING,
    postcode: DataTypes.STRING,
    city_name: DataTypes.STRING,
    street_name: DataTypes.STRING,
    building_number: DataTypes.STRING,
    floor_id: DataTypes.STRING,
    room_id: DataTypes.STRING,
    settlement_method: DataTypes.STRING,
    meter_reading_occurrence: DataTypes.STRING,
    first_consumer_party_name: DataTypes.STRING,
    second_consumer_party_name: DataTypes.STRING,
    meter_number: DataTypes.STRING,
    consumer_start_date: DataTypes.DATE,
    has_relation: DataTypes.BOOLEAN,
    is_active: DataTypes.BOOLEAN
}, { 
    tableName: 'metering_points',
    timestamps: false 
});

const ConsumptionData = sequelize.define('ConsumptionData', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    metering_point_id: DataTypes.STRING,
    timestamp: DataTypes.DATE,
    aggregation_level: DataTypes.STRING,
    quantity: DataTypes.DECIMAL,
    quality: DataTypes.STRING,
    measurement_unit: DataTypes.STRING,
    business_type: DataTypes.STRING,
    curve_type: DataTypes.STRING
}, { 
    tableName: 'consumption_data',
    timestamps: false 
});

const MeterReadings = sequelize.define('MeterReadings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    metering_point_id: DataTypes.STRING,
    reading_date: DataTypes.DATE,
    registration_date: DataTypes.DATE,
    meter_number: DataTypes.STRING,
    meter_reading: DataTypes.DECIMAL,
    measurement_unit: DataTypes.STRING
}, { 
    tableName: 'meter_readings',
    timestamps: false 
});

const TariffData = sequelize.define('TariffData', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    metering_point_id: DataTypes.STRING,
    tariff_type: DataTypes.STRING,
    tariff_name: DataTypes.STRING,
    tariff_description: DataTypes.TEXT,
    gln_number: DataTypes.STRING,
    price: DataTypes.DECIMAL,
    price_discount: DataTypes.DECIMAL,
    hour_from: DataTypes.INTEGER,
    hour_to: DataTypes.INTEGER,
    valid_from: DataTypes.DATE,
    valid_to: DataTypes.DATE
}, { 
    tableName: 'tariff_data',
    timestamps: false 
});

const DataSyncLog = sequelize.define('DataSyncLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    metering_point_id: DataTypes.STRING,
    sync_type: DataTypes.STRING,
    date_from: DataTypes.DATE,
    date_to: DataTypes.DATE,
    aggregation_level: DataTypes.STRING,
    status: DataTypes.STRING,
    error_message: DataTypes.TEXT,
    records_synced: DataTypes.INTEGER
}, { 
    tableName: 'data_sync_log',
    timestamps: false 
});

const AppConfig = sequelize.define('AppConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    refresh_token: DataTypes.TEXT,
    access_token: DataTypes.TEXT,
    token_expires_at: DataTypes.DATE
}, { 
    tableName: 'app_config',
    timestamps: false 
});

async function getDatabaseOverview() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Get all users
        const users = await User.findAll({
            attributes: ['id', 'email', 'name'],
            order: [['id', 'ASC']]
        });

        console.log('\n=== DATABASE OVERVIEW ===\n');
        console.log('Users found:', users.length);

        // Create table header
        console.log('| User ID | Email | Name | Properties | Metering Points | Consumption Data | Meter Readings | Tariff Data | Weather Data | Refresh Tokens | Sync Logs |');
        console.log('|---------|-------|------|------------|-----------------|------------------|----------------|-------------|---------------|----------------|-----------|');

        for (const user of users) {
            const userId = user.id;
            const userEmail = user.email || 'N/A';
            const userName = user.name || 'N/A';

            // Get user's properties through UserProperty junction table
            const userProperties = await UserProperty.findAll({
                where: { user_id: userId },
                attributes: ['property_id']
            });
            
            const propertyIds = userProperties.map(up => up.property_id);
            
            // Count properties
            const propertyCount = propertyIds.length;

            // Count metering points (both new and legacy)
            let meteringPointCount = 0;
            if (propertyIds.length > 0) {
                const newMeteringPoints = await MeteringPoint.findAll({
                    where: { property_id: propertyIds },
                    attributes: ['id']
                });
                meteringPointCount += newMeteringPoints.length;
            }

            // For legacy data, we need to check if there are any metering points
            // Since legacy schema doesn't have user associations, we'll count all legacy data
            const legacyMeteringPoints = await LegacyMeteringPoint.findAll({
                attributes: ['metering_point_id']
            });
            const legacyMeteringPointIds = legacyMeteringPoints.map(mp => mp.metering_point_id);

            // Count consumption data (legacy)
            let consumptionDataCount = 0;
            if (legacyMeteringPointIds.length > 0) {
                const consumptionData = await ConsumptionData.findAll({
                    where: { metering_point_id: legacyMeteringPointIds },
                    attributes: ['id']
                });
                consumptionDataCount = consumptionData.length;
            }

            // Count meter readings (legacy)
            let meterReadingsCount = 0;
            if (legacyMeteringPointIds.length > 0) {
                const meterReadings = await MeterReadings.findAll({
                    where: { metering_point_id: legacyMeteringPointIds },
                    attributes: ['id']
                });
                meterReadingsCount = meterReadings.length;
            }

            // Count tariff data (legacy)
            let tariffDataCount = 0;
            if (legacyMeteringPointIds.length > 0) {
                const tariffData = await TariffData.findAll({
                    where: { metering_point_id: legacyMeteringPointIds },
                    attributes: ['id']
                });
                tariffDataCount = tariffData.length;
            }

            // Count weather data (new schema)
            let weatherDataCount = 0;
            if (propertyIds.length > 0) {
                const weatherData = await WeatherData.findAll({
                    where: { property_id: propertyIds },
                    attributes: ['id']
                });
                weatherDataCount = weatherData.length;
            }

            // Count refresh tokens (new schema)
            let refreshTokenCount = 0;
            if (propertyIds.length > 0) {
                const refreshTokens = await RefreshToken.findAll({
                    where: { property_id: propertyIds },
                    attributes: ['id']
                });
                refreshTokenCount = refreshTokens.length;
            }

            // Count sync logs (legacy)
            let syncLogCount = 0;
            if (legacyMeteringPointIds.length > 0) {
                const syncLogs = await DataSyncLog.findAll({
                    where: { metering_point_id: legacyMeteringPointIds },
                    attributes: ['id']
                });
                syncLogCount = syncLogs.length;
            }

            // Check for app config (legacy, single user)
            const appConfigCount = await AppConfig.count();

            console.log(`| ${userId} | ${userEmail} | ${userName} | ${propertyCount} | ${meteringPointCount} | ${consumptionDataCount} | ${meterReadingsCount} | ${tariffDataCount} | ${weatherDataCount} | ${refreshTokenCount} | ${syncLogCount} |`);
        }

        // Add summary section
        console.log('\n=== SUMMARY ===\n');
        
        const totalUsers = await User.count();
        const totalProperties = await Property.count();
        const totalMeteringPoints = await MeteringPoint.count();
        const totalLegacyMeteringPoints = await LegacyMeteringPoint.count();
        const totalConsumptionData = await ConsumptionData.count();
        const totalMeterReadings = await MeterReadings.count();
        const totalTariffData = await TariffData.count();
        const totalWeatherData = await WeatherData.count();
        const totalRefreshTokens = await RefreshToken.count();
        const totalSyncLogs = await DataSyncLog.count();
        const totalAppConfigs = await AppConfig.count();

        console.log('**Total Counts:**');
        console.log(`- Users: ${totalUsers}`);
        console.log(`- Properties: ${totalProperties}`);
        console.log(`- Metering Points (New): ${totalMeteringPoints}`);
        console.log(`- Metering Points (Legacy): ${totalLegacyMeteringPoints}`);
        console.log(`- Consumption Data Records: ${totalConsumptionData}`);
        console.log(`- Meter Readings: ${totalMeterReadings}`);
        console.log(`- Tariff Data Records: ${totalTariffData}`);
        console.log(`- Weather Data Records: ${totalWeatherData}`);
        console.log(`- Refresh Tokens: ${totalRefreshTokens}`);
        console.log(`- Sync Logs: ${totalSyncLogs}`);
        console.log(`- App Configs: ${totalAppConfigs}`);

    } catch (error) {
        console.error('Error querying database:', error);
    } finally {
        await sequelize.close();
    }
}

getDatabaseOverview();
