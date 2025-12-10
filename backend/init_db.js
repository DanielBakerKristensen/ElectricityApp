process.env.DB_HOST = 'localhost';
const { sequelize } = require('./config/database');

// Register models to ensure they are known to Sequelize
require('./models/RefreshToken');
require('./models/MeteringPoint');

async function initDb() {
    try {
        console.log('🔌 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Connection established.');

        console.log('🔄 Syncing database models...');
        // alter: true will create tables if missing, or update them if they exist
        await sequelize.sync({ alter: true });
        console.log('✅ Database models synced successfully.');

    } catch (error) {
        console.error('❌ Error syncing database:', error);
    } finally {
        await sequelize.close();
    }
}

initDb();
