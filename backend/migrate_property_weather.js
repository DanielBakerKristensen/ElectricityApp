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

        console.log('🏗️ Adding new columns to properties table...');

        await sequelize.query(`
            ALTER TABLE properties 
            ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6),
            ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6),
            ADD COLUMN IF NOT EXISTS weather_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE;
        `);

        console.log('✅ Columns added successfully.');

        // Update existing properties with default coordinates if needed
        const defaultLat = process.env.WEATHER_LATITUDE || '55.0444';
        const defaultLng = process.env.WEATHER_LONGITUDE || '9.4117';

        console.log(`📍 Updating existing properties with default location: ${defaultLat}, ${defaultLng}`);

        await sequelize.query(`
            UPDATE properties 
            SET latitude = $1, longitude = $2 
            WHERE latitude IS NULL OR longitude IS NULL;
        `, {
            bind: [defaultLat, defaultLng]
        });

        console.log('✅ Existing properties updated.');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

migrate();
