require('dotenv').config({ path: '.env.docker' });

const { sequelize } = require('../config/database');
const { User, Property, MeteringPoint, WeatherData, RefreshToken, UserProperty } = require('../models');

const deleteUserManually = async (userId) => {
    if (!userId) {
        console.error('Please provide a user ID.');
        process.exit(1);
    }

    console.log(`--- Starting manual deletion for user ID: ${userId} ---`);

    let transaction;
    try {
        // Step 0: Find the user
        const user = await User.findByPk(userId);
        if (!user) {
            console.error(`User with ID ${userId} not found.`);
            process.exit(1);
        }
        console.log(`Found user: ${user.email}`);

        // Step 1: Find properties owned solely by this user
        const properties = await user.getProperties({
            include: [{ model: User, as: 'users', attributes: ['id'] }]
        });

        const propertiesToDelete = properties.filter(p => p.users.length === 1 && p.users[0].id === parseInt(userId, 10));
        console.log(`Found ${propertiesToDelete.length} properties to delete.`);

        // Step 2: Delete dependent data for each property
        let totalRefreshTokensDeleted = 0;
        for (const property of propertiesToDelete) {
            console.log(`\nProcessing Property ID: ${property.id} (${property.name})`);
            
            // 2a: Delete weather data
            const weatherDataDeleted = await WeatherData.destroy({ where: { property_id: property.id } });
            console.log(`  - Deleted ${weatherDataDeleted} weather data records.`);
            
            // 2b: Delete metering points
            const meteringPointsDeleted = await MeteringPoint.destroy({ where: { property_id: property.id } });
            console.log(`  - Deleted ${meteringPointsDeleted} metering points.`);
            
            // 2c: Delete refresh tokens
            const refreshTokensDeleted = await RefreshToken.destroy({ where: { property_id: property.id } });
            totalRefreshTokensDeleted += refreshTokensDeleted;
            console.log(`  - Deleted ${refreshTokensDeleted} refresh tokens.`);
            
            // 2d: Delete the property itself
            await property.destroy({});
            console.log(`  - Deleted property.`);
        }

        // Step 3: Delete the user
        console.log('\nDeleting user...');
        transaction = await sequelize.transaction();
        try {
            // Delete the user. Cascading deletes on UserProperty will clean up associations.
            await User.destroy({ where: { id: userId }, transaction });
            console.log(`  - Deleted user.`);

            await transaction.commit();
            console.log('\n--- Transaction committed successfully ---');
        } catch (txError) {
            await transaction.rollback();
            console.error('\n--- Transaction failed, rolled back ---');
            throw txError;
        }

        console.log(`\n✅ Successfully deleted user ${userId} and all associated data.`);
        console.log(`Total refresh tokens deleted: ${totalRefreshTokensDeleted}`);

    } catch (error) {
        console.error('\n❌ Error during manual deletion:', error.message);
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
const userIdToDelete = process.argv[2];

if (!userIdToDelete) {
    console.log('Usage: node scripts/manual-delete-user.js <user_id>');
    console.log('Example: node scripts/manual-delete-user.js 8');
    process.exit(1);
}

deleteUserManually(parseInt(userIdToDelete, 10));
