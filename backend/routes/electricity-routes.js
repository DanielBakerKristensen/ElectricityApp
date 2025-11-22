const express = require('express');
const axios = require('axios');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const router = express.Router();

const ELOVERBLIK_BASE_URL = 'https://api.eloverblik.dk/customerapi/api';
const REFRESH_TOKEN = process.env.ELOVERBLIK_REFRESH_TOKEN;
const METERING_POINT_ID = process.env.ELOVERBLIK_METERING_POINTS;

// Helper function to get a new access token
async function getAccessToken() {
    try {
        const response = await axios.get(`${ELOVERBLIK_BASE_URL}/token`, {
            headers: { 'Authorization': `Bearer ${REFRESH_TOKEN}` }
        });
        return response.data.result;
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to get access token from Eloverblik');
    }
}

// Database query function to fetch consumption data
async function queryConsumptionData(meteringPointId, dateFrom, dateTo, aggregationLevel) {
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

// Format database results to match Eloverblik API structure
function formatForFrontend(dbResults) {
    console.log('🔄 Formatting', dbResults.length, 'records for frontend');
    
    // Group results by day
    const periodsByDay = {};
    
    dbResults.forEach(record => {
        const timestamp = new Date(record.timestamp);
        const dayKey = timestamp.toISOString().split('T')[0];
        
        if (!periodsByDay[dayKey]) {
            periodsByDay[dayKey] = {
                timeInterval: { start: `${dayKey}T00:00:00Z` },
                Point: []
            };
        }
        
        const hour = timestamp.getUTCHours() + 1; // 1-24 format, use UTC to match database
        periodsByDay[dayKey].Point.push({
            position: hour.toString(),
            "out_Quantity.quantity": record.quantity.toString(),
            "out_Quantity.quality": record.quality || "OK"
        });
    });
    
    console.log('🔄 Grouped into', Object.keys(periodsByDay).length, 'days');
    console.log('🔄 First day points:', periodsByDay[Object.keys(periodsByDay)[0]]?.Point?.length);
    
    return {
        result: [{
            success: true,
            errorCode: 10000,
            MyEnergyData_MarketDocument: {
                TimeSeries: [{
                    measurement_Unit: { name: "kWh" },
                    Period: Object.values(periodsByDay)
                }]
            }
        }]
    };
}

/**
 * @swagger
 * /api/test-data:
 *   get:
 *     summary: Fetch electricity consumption data from Eloverblik API
 *     description: Retrieves hourly electricity consumption data directly from the Eloverblik API for a specified date range
 *     tags:
 *       - Electricity Data
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-31"
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Successfully retrieved consumption data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required query parameters
 *       500:
 *         description: Failed to fetch data from Eloverblik API
 */
router.get('/test-data', async (req, res) => {
    const { dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'Missing dateFrom or dateTo query parameters' });
    }

    try {
        const accessToken = await getAccessToken();

        const response = await axios.post(
            `${ELOVERBLIK_BASE_URL}/meterdata/gettimeseries/${dateFrom}/${dateTo}/Hour`,
            {
                meteringPoints: {
                    meteringPoint: [METERING_POINT_ID]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from Eloverblik:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch data from Eloverblik API' });
    }
});

/**
 * @swagger
 * /api/database-demo:
 *   get:
 *     summary: Fetch electricity consumption data from local database
 *     description: Retrieves hourly electricity consumption data from the local PostgreSQL database for a specified date range
 *     tags:
 *       - Electricity Data
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-31"
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Successfully retrieved consumption data from database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required query parameters
 *       500:
 *         description: Failed to fetch data from database
 */
// Database demo endpoint
router.get('/database-demo', async (req, res) => {
    const { dateFrom, dateTo } = req.query;
    
    // Validate parameters
    if (!dateFrom || !dateTo) {
        return res.status(400).json({ 
            error: 'Missing dateFrom or dateTo query parameters' 
        });
    }
    
    try {
        console.log('📊 Database query:', { 
            meteringPointId: METERING_POINT_ID, 
            dateFrom, 
            dateTo 
        });
        
        // Query database
        const results = await queryConsumptionData(
            METERING_POINT_ID,
            dateFrom,
            dateTo,
            'Hour'
        );
        
        console.log('📊 Query results:', { 
            recordCount: results.length,
            firstRecord: results[0],
            lastRecord: results[results.length - 1]
        });
        
        // Format for frontend
        const formattedData = formatForFrontend(results);
        
        res.json(formattedData);
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch data from database',
            details: error.message 
        });
    }
});

module.exports = router;
