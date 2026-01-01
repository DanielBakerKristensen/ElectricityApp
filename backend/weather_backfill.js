#!/usr/bin/env node

/**
 * Weather Data Backfill Script
 * 
 * This script backfills historical weather data from Open-Meteo API
 * for correlation analysis with electricity consumption data.
 * 
 * Usage:
 *   node weather_backfill.js [start_date] [end_date]
 *   
 * Examples:
 *   node weather_backfill.js 2024-01-01 2024-12-31
 *   node weather_backfill.js 2023-06-01 2023-08-31
 * 
 * Date format: YYYY-MM-DD
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
const WeatherSyncService = require('./services/weather-sync-service');
const logger = require('./utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('❌ Error: Please provide start and end dates');
    console.error('Usage: node weather_backfill.js <start_date> <end_date>');
    console.error('Example: node weather_backfill.js 2024-01-01 2024-12-31');
    process.exit(1);
}

const startDate = args[0];
const endDate = args[1];

// Validate date format (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    console.error('❌ Error: Invalid date format. Use YYYY-MM-DD');
    console.error('Example: 2024-01-01');
    process.exit(1);
}

// Validate date range
const start = new Date(startDate);
const end = new Date(endDate);

if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('❌ Error: Invalid dates provided');
    process.exit(1);
}

if (start >= end) {
    console.error('❌ Error: Start date must be before end date');
    process.exit(1);
}

// Check if end date is too recent (weather data might not be available)
const today = new Date();
const daysDiff = Math.ceil((today - end) / (1000 * 60 * 60 * 24));

if (daysDiff < 2) {
    console.warn('⚠️  Warning: End date is very recent. Weather data might not be available yet.');
    console.warn('   Open-Meteo typically has data available 1-2 days after the date.');
}

// Calculate total days
const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

console.log('🌤️  Weather Data Backfill Script');
console.log('================================');
console.log(`📅 Date Range: ${startDate} to ${endDate}`);
console.log(`📊 Total Days: ${totalDays}`);
console.log(`🌍 Location: ${process.env.WEATHER_LATITUDE || '55.0444'}, ${process.env.WEATHER_LONGITUDE || '9.4117'}`);
console.log('');

async function main() {
    let weatherSyncService;

    try {
        // Test database connection
        console.log('🔌 Testing database connection...');
        await testConnection();
        console.log('✅ Database connection successful');

        // Initialize weather sync service
        weatherSyncService = new WeatherSyncService(sequelize, logger);

        // Check if weather_data table exists
        try {
            await sequelize.query('SELECT 1 FROM weather_data LIMIT 1');
            console.log('✅ Weather data table exists');
        } catch (error) {
            console.error('❌ Weather data table does not exist. Please run database migrations first.');
            process.exit(1);
        }

        // Check for existing data in the date range
        const [existingRecords] = await sequelize.query(`
            SELECT COUNT(*) as count 
            FROM weather_data 
            WHERE timestamp::date BETWEEN $1 AND $2
        `, {
            bind: [startDate, endDate],
            type: sequelize.QueryTypes.SELECT
        });

        if (existingRecords.count > 0) {
            console.log(`⚠️  Found ${existingRecords.count} existing weather records in this date range`);
            console.log('   Existing records will be updated if different');
        }

        console.log('');
        console.log('🚀 Starting weather data backfill...');
        console.log('');

        // Start backfill process
        const startTime = Date.now();
        
        const result = await weatherSyncService.backfillWeatherData({
            startDate,
            endDate,
            location: {
                latitude: parseFloat(process.env.WEATHER_LATITUDE || '55.0444'),
                longitude: parseFloat(process.env.WEATHER_LONGITUDE || '9.4117')
            }
        });

        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);

        console.log('');
        console.log('📊 Backfill Results:');
        console.log('===================');
        console.log(`✅ Success: ${result.success}`);
        console.log(`📦 Total Batches: ${result.batches}`);
        console.log(`📈 Total Records: ${result.totalRecords}`);
        console.log(`⏱️  Duration: ${duration} seconds`);
        console.log(`📊 Rate: ${Math.round(result.totalRecords / duration)} records/second`);

        if (result.results) {
            const successful = result.results.filter(r => r.success).length;
            const failed = result.results.filter(r => !r.success).length;
            
            console.log(`✅ Successful Batches: ${successful}`);
            if (failed > 0) {
                console.log(`❌ Failed Batches: ${failed}`);
                
                // Show failed batch details
                result.results.filter(r => !r.success).forEach(failedResult => {
                    console.log(`   - ${failedResult.dateFrom} to ${failedResult.dateTo}: ${failedResult.error}`);
                });
            }
        }

        console.log('');
        
        if (result.success) {
            console.log('🎉 Weather data backfill completed successfully!');
            
            // Show some sample data
            const [sampleData] = await sequelize.query(`
                SELECT 
                    timestamp,
                    temperature_celsius,
                    humidity_percent,
                    weather_condition
                FROM weather_data 
                WHERE timestamp::date BETWEEN $1 AND $2
                ORDER BY timestamp 
                LIMIT 5
            `, {
                bind: [startDate, endDate],
                type: sequelize.QueryTypes.SELECT
            });

            if (sampleData && sampleData.length > 0) {
                console.log('');
                console.log('📋 Sample Weather Data:');
                console.log('======================');
                sampleData.forEach(record => {
                    const date = new Date(record.timestamp).toLocaleString();
                    console.log(`${date}: ${record.temperature_celsius}°C, ${record.humidity_percent}%, ${record.weather_condition}`);
                });
            } else {
                console.log('');
                console.log('ℹ️  No sample data available to display');
            }
        } else {
            console.log('❌ Weather data backfill completed with errors');
            process.exit(1);
        }

    } catch (error) {
        console.error('');
        console.error('❌ Fatal Error:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        // Close database connection
        if (sequelize) {
            try {
                await sequelize.close();
                console.log('');
                console.log('🔌 Database connection closed');
            } catch (error) {
                console.error('Error closing database connection:', error.message);
            }
        }
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('');
    console.log('⚠️  Received SIGINT, shutting down gracefully...');
    
    if (sequelize) {
        try {
            await sequelize.close();
            console.log('🔌 Database connection closed');
        } catch (error) {
            console.error('Error closing database connection:', error.message);
        }
    }
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('');
    console.log('⚠️  Received SIGTERM, shutting down gracefully...');
    
    if (sequelize) {
        try {
            await sequelize.close();
            console.log('🔌 Database connection closed');
        } catch (error) {
            console.error('Error closing database connection:', error.message);
        }
    }
    
    process.exit(0);
});

// Run the main function
main().catch(error => {
    console.error('Unhandled error in main function:', error);
    process.exit(1);
});