process.env.DB_HOST = 'localhost';
const { sequelize } = require('./config/database');

async function checkTables() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log('Tables in database:', tables);

        const requiredTables = ['refresh_tokens', 'metering_points_config'];
        const missingTables = requiredTables.filter(t => !tables.includes(t));

        if (missingTables.length > 0) {
            console.error('❌ Missing tables:', missingTables);
            console.log('💡 Hint: If NODE_ENV is "production", automatic table creation is disabled.');
        } else {
            console.log('✅ All required tables exist.');
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

checkTables();
