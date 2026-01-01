#!/usr/bin/env node

/**
 * Create Weather Data Table
 * 
 * This script creates the weather_data table if it doesn't exist
 */

const path = require('path');
const fs = require('fs');

// Auto-detect environment and load appropriate .env file
const isDocker = fs.existsSync('/.dockerenv') ||
  process.env.DOCKER_ENV === 'true' ||
  process.env.HOSTNAME?.includes('docker') ||
  fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');

const envFile = isDocker ? '.env.docker' : '.env.local';
const envPath = isDocker ?
  (fs.existsSync(path.join(__dirname, envFile)) ? path.join(__dirname, envFile) : path.join(__dirname, '..', envFile)) :
  path.join(__dirname, '..', envFile);

const finalEnvPath = fs.existsSync(envPath) ? envPath : path.join(__dirname, '../.env');

require('dotenv').config({ path: finalEnvPath });

const { sequelize, testConnection } = require('./config/database');
const logger = require('./utils/logger');

async function createWeatherTable() {
    try {
        console.log('🔌 Testing database connection...');
        await testConnection();
        console.log('✅ Database connection successful');

        console.log('🏗️  Creating weather_data table...');
        
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS weather_data (
                id SERIAL PRIMARY KEY,
                location_id VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                temperature_celsius DECIMAL(5,2),
                humidity_percent DECIMAL(5,2),
                precipitation_mm DECIMAL(6,2),
                weather_condition VARCHAR(100),
                weather_code INTEGER,
                wind_speed_kmh DECIMAL(6,2),
                pressure_hpa DECIMAL(7,2),
                data_source VARCHAR(50) NOT NULL DEFAULT 'open-meteo',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT weather_data_location_timestamp_unique UNIQUE (location_id, timestamp)
            );
        `;

        await sequelize.query(createTableQuery);
        console.log('✅ weather_data table created successfully');

        console.log('📊 Creating indexes...');
        
        const indexQueries = [
            'CREATE INDEX IF NOT EXISTS weather_data_timestamp_idx ON weather_data(timestamp);',
            'CREATE INDEX IF NOT EXISTS weather_data_location_idx ON weather_data(location_id);'
        ];

        for (const query of indexQueries) {
            await sequelize.query(query);
        }
        
        console.log('✅ Indexes created successfully');

        // Check if table exists and show structure
        const [tableInfo] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'weather_data' 
            ORDER BY ordinal_position;
        `);

        console.log('');
        console.log('📋 Weather Data Table Structure:');
        console.log('================================');
        tableInfo.forEach(col => {
            console.log(`${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        console.log('');
        console.log('🎉 Weather data table setup completed successfully!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Run weather backfill: node backend/weather_backfill.js 2024-01-01 2024-12-31');
        console.log('2. Start the server to enable daily weather sync');
        console.log('3. Visit /weather page to view consumption-temperature analysis');

    } catch (error) {
        console.error('❌ Error creating weather table:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        if (sequelize) {
            try {
                await sequelize.close();
                console.log('🔌 Database connection closed');
            } catch (error) {
                console.error('Error closing database connection:', error.message);
            }
        }
    }
}

// Run the setup
createWeatherTable().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});