#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Auto-detect environment and load appropriate .env file
const isDocker = fs.existsSync('/.dockerenv');
const envPath = isDocker ? path.join(__dirname, '../.env.docker') : path.join(__dirname, '../.env');

require('dotenv').config({ path: envPath });

const { sequelize } = require('./config/database');

async function migrate() {
    try {
        console.log('🔌 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Connected.');

        // 1. Ensure Property has refresh_token column
        console.log('🏗️ Checking property table columns...');
        await sequelize.query(`
            ALTER TABLE properties 
            ADD COLUMN IF NOT EXISTS refresh_token TEXT;
        `);

        // 2. Get the default property
        const properties = await sequelize.query(`SELECT id FROM properties ORDER BY id ASC LIMIT 1`, {
            type: sequelize.QueryTypes.SELECT
        });

        let defaultPropertyId;
        if (properties.length === 0) {
            console.warn('⚠️ No properties found. Creating a default one.');
            const [result] = await sequelize.query(`
                INSERT INTO properties (name, latitude, longitude, weather_sync_enabled, "createdAt", "updatedAt")
                VALUES ('Default Property', 55.0444, 9.4117, TRUE, NOW(), NOW())
                RETURNING id;
            `);
            defaultPropertyId = result[0].id;
        } else {
            defaultPropertyId = properties[0].id;
        }

        console.log(`📍 Using Property ID: ${defaultPropertyId} as target for migration.`);

        // 3. Migrate RefreshTokens from table to Property
        console.log('📦 Migrating Refresh Tokens...');

        // Check if table exists first
        const [tableExists] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'refresh_tokens'
            );
        `);

        if (tableExists[0].exists) {
            const tokens = await sequelize.query(`SELECT token FROM refresh_tokens ORDER BY "createdAt" DESC LIMIT 1`, {
                type: sequelize.QueryTypes.SELECT
            });

            const envToken = process.env.ELOVERBLIK_REFRESH_TOKEN;
            const targetToken = (tokens.length > 0 ? tokens[0].token : null) || envToken;

            if (targetToken) {
                console.log('🔑 Found token to migrate.');
                await sequelize.query(`
                    UPDATE properties 
                    SET refresh_token = $1 
                    WHERE id = $2 AND (refresh_token IS NULL OR refresh_token = '');
                `, {
                    bind: [targetToken, defaultPropertyId]
                });
                console.log('✅ Token migrated to default property.');
            }
        } else {
            console.log('ℹ️ refresh_tokens table does not exist, checking ENV only.');
            const envToken = process.env.ELOVERBLIK_REFRESH_TOKEN;
            if (envToken) {
                await sequelize.query(`
                    UPDATE properties 
                    SET refresh_token = $1 
                    WHERE id = $2 AND (refresh_token IS NULL OR refresh_token = '');
                `, {
                    bind: [envToken, defaultPropertyId]
                });
                console.log('✅ Token from ENV set as default.');
            }
        }

        // 4. Migrate MeteringPoints - Link orphaned ones to default property
        console.log('📏 Migrating Metering Points...');
        await sequelize.query(`
            UPDATE metering_points_config 
            SET property_id = $1 
            WHERE property_id IS NULL;
        `, {
            bind: [defaultPropertyId]
        });
        console.log(`✅ Linked metering points to property.`);

        // 5. Optionally create metering points from ENV if table is empty
        const [existingMps] = await sequelize.query(`SELECT COUNT(*) as count FROM metering_points_config`);
        if (parseInt(existingMps[0].count) === 0 && process.env.ELOVERBLIK_METERING_POINTS) {
            console.log('🌱 Creating metering points from ENV variables...');
            const envMps = process.env.ELOVERBLIK_METERING_POINTS.split(',');
            for (const mpId of envMps) {
                await sequelize.query(`
                    INSERT INTO metering_points_config (name, "meteringPointId", property_id, "createdAt", "updatedAt")
                    VALUES ('Default Meter', $1, $2, NOW(), NOW())
                `, {
                    bind: [mpId.trim(), defaultPropertyId]
                });
            }
            console.log('✅ Created metering points from ENV.');
        }

        console.log('🎉 Settings migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

migrate();
