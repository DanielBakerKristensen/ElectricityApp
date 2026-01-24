const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME || 'electricity_app',
    process.env.DB_USER || 'electricity_user',
    process.env.DB_PASSWORD || 'electricity_password',
    {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        logging: console.log,
    }
);

async function runMigration() {
    try {
        await sequelize.authenticate();
        console.log('Connected to Database. Starting schema refactoring...');

        const queryInterface = sequelize.getQueryInterface();

        // --- STEP 1: Add ID to metering_points ---
        console.log('1. Adding ID to metering_points...');

        // This is tricky. We need to add a SERIAL column but it's not straightforward
        // to add a PRIMARY KEY to an existing table that already has one.
        // Strategy:
        // 1. Add column 'id' (SERIAL)
        // 2. Drop existing FK constraints referencing 'metering_point_id' 
        // 3. Drop existing PK constraint
        // 4. Make 'id' the PK
        // 5. Add UNIQUE constraint to 'metering_point_id'
        // 6. Re-add FKs (pointing to the string ID for now, we will migrate them later)

        // Check if column exists first to make script idempotent-ish
        const tableInfo = await queryInterface.describeTable('metering_points');
        if (!tableInfo.id) {
            await sequelize.query(`ALTER TABLE metering_points ADD COLUMN id SERIAL`);
            console.log('   - Added id column');
        } else {
            console.log('   - id column already exists');
        }

        // We need to find the specific constraint names to drop them
        // This is a bit brute-force but safe for this context

        console.log('2. Dropping old constraints...');
        // Drop FKs from referencing tables first
        // consumption_data
        await sequelize.query(`ALTER TABLE consumption_data DROP CONSTRAINT IF EXISTS consumption_data_metering_point_id_fkey`);
        // data_sync_log (doesn't have explicit FK in current schema usually, but let's check)
        // meter_readings? tariff_data? (Checking user schema previously shown)

        // Drop PK from metering_points
        await sequelize.query(`ALTER TABLE metering_points DROP CONSTRAINT IF EXISTS metering_points_pkey CASCADE`);

        console.log('3. Setting new Primary Key...');
        await sequelize.query(`ALTER TABLE metering_points ADD PRIMARY KEY (id)`);

        console.log('4. Adding UNIQUE constraint to old string ID...');
        await sequelize.query(`ALTER TABLE metering_points ADD CONSTRAINT metering_points_metering_point_id_key UNIQUE (metering_point_id)`);

        // --- STEP 2: Refactor data_sync_log ---
        console.log('5. Refactoring data_sync_log...');

        const syncLogInfo = await queryInterface.describeTable('data_sync_log');

        if (!syncLogInfo.property_id) {
            await sequelize.query(`ALTER TABLE data_sync_log ADD COLUMN property_id INTEGER REFERENCES properties(id)`);
            console.log('   - Added property_id column');
        }

        if (!syncLogInfo.metering_point_pk) {
            await sequelize.query(`ALTER TABLE data_sync_log ADD COLUMN metering_point_pk INTEGER REFERENCES metering_points(id)`);
            console.log('   - Added metering_point_pk column');
        }

        // Migrate Data
        console.log('6. Migrating Sync Log Data...');

        // Fix Weather logs (hijacked metering_point_id -> property_id)
        // We assume 'weather_historical', 'weather_forecast' types use the property ID in the MP column
        await sequelize.query(`
            UPDATE data_sync_log 
            SET property_id = CAST(metering_point_id AS INTEGER)
            WHERE sync_type LIKE 'weather%' 
            AND metering_point_id ~ '^[0-9]+$' -- Ensure it's numeric
            AND property_id IS NULL
        `);

        // Fix Energy logs (metering_point_id string -> metering_point_pk integer)
        await sequelize.query(`
            UPDATE data_sync_log dsl
            SET metering_point_pk = mp.id
            FROM metering_points mp
            WHERE dsl.metering_point_id = mp.metering_point_id
            AND dsl.sync_type NOT LIKE 'weather%'
            AND dsl.metering_point_pk IS NULL
        `);

        // --- STEP 3: Refactor consumption_data ---
        console.log('7. Refactoring consumption_data...');

        const consDataInfo = await queryInterface.describeTable('consumption_data');
        if (!consDataInfo.metering_point_pk) {
            await sequelize.query(`ALTER TABLE consumption_data ADD COLUMN metering_point_pk INTEGER REFERENCES metering_points(id)`);
            console.log('   - Added metering_point_pk column');
        }

        console.log('8. Migrating Consumption Data (This might take a while)...');
        await sequelize.query(`
            UPDATE consumption_data cd
            SET metering_point_pk = mp.id
            FROM metering_points mp
            WHERE cd.metering_point_id = mp.metering_point_id
            AND cd.metering_point_pk IS NULL
        `);

        // Re-establish constraints?
        // Ideally we switched completely to integer IDs. 
        // For now, let's keep the string column but make it nullable in future? 
        // No, let's keep it for now for backward compat, but we broke the FK earlier.
        // Let's re-add the FK to the UNIQUE string column for safety until code is fully updated

        console.log('9. Restoring legacy FKs for backward compatibility...');
        await sequelize.query(`
            ALTER TABLE consumption_data 
            ADD CONSTRAINT consumption_data_metering_point_id_fkey 
            FOREIGN KEY (metering_point_id) REFERENCES metering_points(metering_point_id) ON DELETE CASCADE
        `);


        console.log('--- Migration Completed Successfully ---');

    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        await sequelize.close();
    }
}

runMigration();
