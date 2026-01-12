require('dotenv').config({ path: '.env.docker' });

const { sequelize } = require('../config/database');

const addPropertyIdToRefreshTokens = async () => {
    console.log('--- Adding property_id column to refresh_tokens table ---');

    try {
        // Check if column already exists
        const result = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'refresh_tokens' 
            AND column_name = 'property_id'
        `);

        if (result[0].length > 0) {
            console.log('✅ property_id column already exists in refresh_tokens table');
            return;
        }

        // Add the property_id column
        await sequelize.query(`
            ALTER TABLE refresh_tokens 
            ADD COLUMN property_id INTEGER NOT NULL DEFAULT 1
        `);

        // Add foreign key constraint
        await sequelize.query(`
            ALTER TABLE refresh_tokens 
            ADD CONSTRAINT refresh_tokens_property_id_fkey 
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
        `);

        // Add index for performance
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS refresh_tokens_property_id_idx 
            ON refresh_tokens(property_id)
        `);

        console.log('✅ Successfully added property_id column to refresh_tokens table');

    } catch (error) {
        console.error('❌ Error adding property_id column:', error.message);
        if (error.parent) {
            console.error('Parent error:', error.parent.message);
        }
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('--- Database connection closed ---');
    }
};

addPropertyIdToRefreshTokens();
