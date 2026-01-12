require('dotenv').config({ path: '.env.docker' });

const { sequelize } = require('../config/database');
const { User, Property, MeteringPoint, WeatherData, RefreshToken, UserProperty } = require('../models');

const testSummaryEndpoint = async (userId) => {
    if (!userId) {
        console.error('Please provide a user ID.');
        process.exit(1);
    }

    console.log(`--- Testing summary logic for user ID: ${userId} ---`);

    try {
        const startTime = Date.now();
        
        // Step 1: Find the user
        const user = await User.findByPk(userId);
        if (!user) {
            console.error(`User with ID ${userId} not found.`);
            process.exit(1);
        }
        console.log(`Found user: ${user.email}`);

        // Step 2: Find properties owned solely by this user
        const properties = await user.getProperties({
            include: [{ model: User, as: 'users', attributes: ['id'] }]
        });
        const propertiesToDelete = properties.filter(p => p.users.length === 1 && p.users[0].id === parseInt(userId, 10));
        console.log(`Found ${propertiesToDelete.length} properties to delete.`);

        // Step 3: Count dependent data with simple, fast queries
        let propertiesToDeleteCount = propertiesToDelete.length;
        let meteringPointsToDeleteCount = 0;
        let weatherDataToDeleteCount = 0;
        let refreshTokensToDeleteCount = 0;

        console.log(`Starting count loops for ${propertiesToDelete.length} properties...`);
        for (const property of propertiesToDelete) {
            console.log(`Counting for property ID: ${property.id}`);
            
            // Count metering points for this property
            const mpCount = await MeteringPoint.count({ where: { property_id: property.id } });
            console.log(`  - Found ${mpCount} metering points.`);
            meteringPointsToDeleteCount += mpCount;

            // Count weather data for this property
            const wdCount = await WeatherData.count({ where: { property_id: property.id } });
            console.log(`  - Found ${wdCount} weather data records.`);
            weatherDataToDeleteCount += wdCount;

            // Count refresh tokens for this property
            const rtCount = await RefreshToken.count({ where: { property_id: property.id } });
            console.log(`  - Found ${rtCount} refresh tokens.`);
            refreshTokensToDeleteCount += rtCount;
        }
        console.log('Finished count loops.');

        const summary = {
            properties: propertiesToDeleteCount,
            meteringPoints: meteringPointsToDeleteCount,
            weatherDataRecords: weatherDataToDeleteCount,
            refreshTokens: refreshTokensToDeleteCount
        };

        const endTime = Date.now();
        console.log(`\n✅ Summary generated in ${endTime - startTime}ms:`);
        console.log(JSON.stringify(summary, null, 2));

    } catch (error) {
        console.error('\n❌ Error during summary test:', error.message);
        console.error('Error Name:', error.name);
        if (error.parent) {
            console.error('Parent Error:', error.parent.message);
            console.error('Parent Detail:', error.parent.detail);
        }
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('\n--- Database connection closed ---');
    }
};

// Get user ID from command line arguments
const userIdToTest = process.argv[2];

if (!userIdToTest) {
    console.log('Usage: node scripts/test-summary-logic.js <user_id>');
    console.log('Example: node scripts/test-summary-logic.js 9');
    process.exit(1);
}

testSummaryEndpoint(parseInt(userIdToTest, 10));
