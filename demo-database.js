// Quick Database demonstration script
require('dotenv').config();
const { sequelize } = require('./backend/config/database');

// Load and validate environment variables
const METERING_POINT_ID = process.env.ELOVERBLIK_METERING_POINTS;

// Date Utilities
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
    const today = new Date();
    const dateTo = new Date(today);
    dateTo.setDate(today.getDate() - 1); // Yesterday
    
    const dateFrom = new Date(today);
    dateFrom.setDate(today.getDate() - 2); // 2 days ago
    
    return {
        dateFrom: formatDate(dateFrom),
        dateTo: formatDate(dateTo)
    };
}

function validateDateRange(dateFrom, dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    
    if (fromDate > toDate) {
        return {
            valid: false,
            error: 'Invalid date range: start date must be before end date'
        };
    }
    
    return { valid: true };
}

console.log('🔍 Database Connection Test');
console.log('===========================');
console.log(`✅ Metering Point: ${METERING_POINT_ID || 'Missing'}`);
console.log('');

// Database Query Function
async function queryConsumptionData(meteringPointId, dateFrom, dateTo, aggregationLevel) {
    const { QueryTypes } = require('sequelize');
    
    const query = `
        SELECT 
            timestamp,
            quantity,
            measurement_unit,
            quality,
            aggregation_level
        FROM consumption_data
        WHERE metering_point_id = :meteringPointId
            AND aggregation_level = :aggregationLevel
            AND timestamp >= :dateFrom
            AND timestamp < :dateTo::date + INTERVAL '1 day'
        ORDER BY timestamp ASC
    `;
    
    const results = await sequelize.query(query, {
        replacements: {
            meteringPointId,
            dateFrom,
            dateTo,
            aggregationLevel
        },
        type: QueryTypes.SELECT
    });
    
    return results;
}

// Data Formatting Functions
function displayRawResults(results) {
    console.log('🔍 RAW DATABASE RESULTS:');
    console.log('========================');
    console.log(JSON.stringify(results, null, 2));
    console.log('');
}

function displayParsedSummary(results, meteringPointId, dateFrom, dateTo) {
    console.log('📊 PARSED DATA SUMMARY:');
    console.log('=======================');
    console.log(`📅 Date Range: ${dateFrom} to ${dateTo}`);
    console.log(`🏠 Metering Point: ${meteringPointId}`);
    console.log(`📈 Total Data Points: ${results.length}`);
    console.log('');
    
    // Display first 5 readings
    console.log('⚡ First 5 Hourly Readings:');
    const firstFive = results.slice(0, 5);
    
    firstFive.forEach(record => {
        // Calculate hour position (1-24 format)
        const timestamp = new Date(record.timestamp);
        const hourPosition = timestamp.getHours() + 1; // Convert 0-23 to 1-24
        
        console.log(`   Hour ${hourPosition}: ${record.quantity} ${record.measurement_unit}`);
    });
    console.log('');
}

async function testDatabase() {
    try {
        // Validate required environment variables
        if (!METERING_POINT_ID) {
            console.error('❌ Missing required environment variable: ELOVERBLIK_METERING_POINTS');
            process.exit(1);
        }

        // Test database connection
        console.log('📡 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connection successful!');
        console.log('');

        // Get default date range
        const { dateFrom, dateTo } = getDefaultDateRange();
        
        // Validate date range
        const validation = validateDateRange(dateFrom, dateTo);
        if (!validation.valid) {
            console.error(`❌ ${validation.error}`);
            return;
        }

        console.log('📅 Querying consumption data...');
        console.log(`   Date Range: ${dateFrom} to ${dateTo}`);
        console.log(`   Metering Point: ${METERING_POINT_ID}`);
        console.log('');

        // Query consumption data
        const results = await queryConsumptionData(
            METERING_POINT_ID,
            dateFrom,
            dateTo,
            'Hour'
        );

        // Handle empty result set
        if (!results || results.length === 0) {
            console.error('❌ Data not available for the requested date range');
            return;
        }

        console.log('✅ Data retrieved successfully!');
        console.log(`   Total records: ${results.length}`);
        console.log('');

        // Display raw results
        displayRawResults(results);
        
        // Display parsed summary
        displayParsedSummary(results, METERING_POINT_ID, dateFrom, dateTo);

    } catch (error) {
        if (error.name === 'SequelizeConnectionError') {
            console.error('❌ Database connection failed:', error.message);
        } else if (error.name === 'SequelizeDatabaseError') {
            console.error('❌ Database query failed:', error.message);
        } else {
            console.error('❌ Unexpected error:', error.message);
        }
    } finally {
        // Close database connection
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
testDatabase();
