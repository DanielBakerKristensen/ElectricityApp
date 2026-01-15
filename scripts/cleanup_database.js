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

// Legacy models
const { DataTypes } = require('sequelize');

const LegacyMeteringPoint = sequelize.define('LegacyMeteringPoint', {
    metering_point_id: {
        type: DataTypes.STRING,
        primaryKey: true
    }
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
    metering_point_id: DataTypes.STRING
}, { 
    tableName: 'consumption_data',
    timestamps: false 
});

const DataSyncLog = sequelize.define('DataSyncLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    }
}, { 
    tableName: 'data_sync_log',
    timestamps: false 
});

async function cleanupDatabase() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        console.log('\n=== DATABASE CLEANUP ===\n');

        // Start transaction
        const transaction = await sequelize.transaction();

        try {
            // 1. Find all user-linked property IDs
            const userProperties = await UserProperty.findAll({
                attributes: ['property_id'],
                transaction
            });
            const linkedPropertyIds = userProperties.map(up => up.property_id);
            console.log('Properties linked to users:', linkedPropertyIds);

            // 2. Find unlinked properties
            const allProperties = await Property.findAll({
                attributes: ['id', 'name'],
                transaction
            });
            const unlinkedProperties = allProperties.filter(p => !linkedPropertyIds.includes(p.id));
            console.log('\nUnlinked properties to delete:');
            unlinkedProperties.forEach(p => console.log(`- ID: ${p.id}, Name: ${p.name}`));

            // 3. Find metering points linked to unlinked properties
            const unlinkedPropertyIds = unlinkedProperties.map(p => p.id);
            let unlinkedMeteringPoints = [];
            if (unlinkedPropertyIds.length > 0) {
                unlinkedMeteringPoints = await MeteringPoint.findAll({
                    where: { property_id: unlinkedPropertyIds },
                    attributes: ['id', 'name', 'property_id'],
                    transaction
                });
                console.log('\nMetering points linked to unlinked properties:');
                unlinkedMeteringPoints.forEach(mp => console.log(`- ID: ${mp.id}, Name: ${mp.name}, Property ID: ${mp.property_id}`));
            }

            // 4. Find weather data linked to unlinked properties
            let unlinkedWeatherData = [];
            if (unlinkedPropertyIds.length > 0) {
                unlinkedWeatherData = await WeatherData.findAll({
                    where: { property_id: unlinkedPropertyIds },
                    attributes: ['id', 'property_id', 'timestamp'],
                    transaction
                });
                console.log(`\nWeather data records linked to unlinked properties: ${unlinkedWeatherData.length}`);
            }

            // 5. Find refresh tokens linked to unlinked properties
            let unlinkedRefreshTokens = [];
            if (unlinkedPropertyIds.length > 0) {
                unlinkedRefreshTokens = await RefreshToken.findAll({
                    where: { property_id: unlinkedPropertyIds },
                    attributes: ['id', 'property_id', 'name'],
                    transaction
                });
                console.log(`\nRefresh tokens linked to unlinked properties: ${unlinkedRefreshTokens.length}`);
            }

            // 6. Get all sync logs
            const allSyncLogs = await DataSyncLog.findAll({
                attributes: ['id', 'sync_type', 'created_at'],
                transaction
            });
            console.log(`\nTotal sync logs to delete: ${allSyncLogs.length}`);

            // 7. Get legacy metering points that have no consumption data
            const allLegacyMeteringPoints = await LegacyMeteringPoint.findAll({
                attributes: ['metering_point_id'],
                transaction
            });
            const legacyMeteringPointIds = allLegacyMeteringPoints.map(mp => mp.metering_point_id);

            // Check which legacy metering points have consumption data
            let legacyMeteringPointsWithData = [];
            if (legacyMeteringPointIds.length > 0) {
                const consumptionData = await ConsumptionData.findAll({
                    where: { metering_point_id: legacyMeteringPointIds },
                    attributes: ['metering_point_id'],
                    group: ['metering_point_id'],
                    transaction
                });
                legacyMeteringPointsWithData = consumptionData.map(cd => cd.metering_point_id);
            }

            // Find legacy metering points WITHOUT consumption data (safe to delete)
            const legacyMeteringPointsWithoutData = allLegacyMeteringPoints.filter(
                mp => !legacyMeteringPointsWithData.includes(mp.metering_point_id)
            );
            console.log(`\nLegacy metering points without consumption data (safe to delete): ${legacyMeteringPointsWithoutData.length}`);
            legacyMeteringPointsWithoutData.forEach(mp => console.log(`- ${mp.metering_point_id}`));

            // CONFIRMATION PROMPT
            console.log('\n=== READY TO DELETE ===');
            console.log(`Properties: ${unlinkedProperties.length}`);
            console.log(`Metering Points: ${unlinkedMeteringPoints.length}`);
            console.log(`Weather Data: ${unlinkedWeatherData.length}`);
            console.log(`Refresh Tokens: ${unlinkedRefreshTokens.length}`);
            console.log(`Sync Logs: ${allSyncLogs.length}`);
            console.log(`Legacy Metering Points (no data): ${legacyMeteringPointsWithoutData.length}`);
            
            console.log('\nProceeding with deletion...');

            // EXECUTE DELETIONS

            // Delete weather data for unlinked properties
            if (unlinkedWeatherData.length > 0) {
                const weatherIds = unlinkedWeatherData.map(w => w.id);
                await WeatherData.destroy({
                    where: { id: weatherIds },
                    transaction
                });
                console.log(`✓ Deleted ${unlinkedWeatherData.length} weather data records`);
            }

            // Delete refresh tokens for unlinked properties
            if (unlinkedRefreshTokens.length > 0) {
                const tokenIds = unlinkedRefreshTokens.map(t => t.id);
                await RefreshToken.destroy({
                    where: { id: tokenIds },
                    transaction
                });
                console.log(`✓ Deleted ${unlinkedRefreshTokens.length} refresh tokens`);
            }

            // Delete metering points for unlinked properties
            if (unlinkedMeteringPoints.length > 0) {
                const meteringIds = unlinkedMeteringPoints.map(mp => mp.id);
                await MeteringPoint.destroy({
                    where: { id: meteringIds },
                    transaction
                });
                console.log(`✓ Deleted ${unlinkedMeteringPoints.length} metering points`);
            }

            // Delete unlinked properties
            if (unlinkedProperties.length > 0) {
                const propertyIds = unlinkedProperties.map(p => p.id);
                await Property.destroy({
                    where: { id: propertyIds },
                    transaction
                });
                console.log(`✓ Deleted ${unlinkedProperties.length} properties`);
            }

            // Delete all sync logs
            if (allSyncLogs.length > 0) {
                await DataSyncLog.destroy({
                    where: {},
                    transaction
                });
                console.log(`✓ Deleted ${allSyncLogs.length} sync logs`);
            }

            // Delete legacy metering points without consumption data
            if (legacyMeteringPointsWithoutData.length > 0) {
                const legacyIds = legacyMeteringPointsWithoutData.map(mp => mp.metering_point_id);
                await LegacyMeteringPoint.destroy({
                    where: { metering_point_id: legacyIds },
                    transaction
                });
                console.log(`✓ Deleted ${legacyMeteringPointsWithoutData.length} legacy metering points`);
            }

            // Commit transaction
            await transaction.commit();
            console.log('\n✅ Database cleanup completed successfully!');

        } catch (error) {
            // Rollback on error
            await transaction.rollback();
            console.error('❌ Error during cleanup, transaction rolled back:', error);
            throw error;
        }

        // Show final counts
        console.log('\n=== FINAL DATABASE STATE ===');
        const finalUsers = await User.count();
        const finalProperties = await Property.count();
        const finalMeteringPoints = await MeteringPoint.count();
        const finalLegacyMeteringPoints = await LegacyMeteringPoint.count();
        const finalConsumptionData = await ConsumptionData.count();
        const finalWeatherData = await WeatherData.count();
        const finalRefreshTokens = await RefreshToken.count();
        const finalSyncLogs = await DataSyncLog.count();

        console.log(`Users: ${finalUsers}`);
        console.log(`Properties: ${finalProperties}`);
        console.log(`Metering Points (New): ${finalMeteringPoints}`);
        console.log(`Metering Points (Legacy): ${finalLegacyMeteringPoints}`);
        console.log(`Consumption Data: ${finalConsumptionData}`);
        console.log(`Weather Data: ${finalWeatherData}`);
        console.log(`Refresh Tokens: ${finalRefreshTokens}`);
        console.log(`Sync Logs: ${finalSyncLogs}`);

    } catch (error) {
        console.error('Error during database cleanup:', error);
    } finally {
        await sequelize.close();
    }
}

cleanupDatabase();
