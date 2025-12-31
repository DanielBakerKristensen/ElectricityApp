const { sequelize } = require('../config/database');
const { User, Property, UserProperty, MeteringPoint } = require('../models');

const syncSchema = async () => {
    try {
        console.log('🔄 Authenticating...');
        await sequelize.authenticate();
        console.log('✅ Connected to database.');

        console.log('🔄 Syncing schema (safe alter)...');
        await sequelize.sync({ alter: true });
        console.log('✅ Schema synced successfully.');

        // Verify tables exist
        const allTables = await sequelize.getQueryInterface().showAllTables();
        console.log('📊 Existing tables:', allTables);

        const expectedTables = ['users', 'properties', 'user_properties'];
        const missing = expectedTables.filter(t => !allTables.includes(t));

        if (missing.length === 0) {
            console.log('✅ ALL expected tables exist.');
        } else {
            console.error('❌ Missing tables:', missing);
            process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
};

syncSchema();
