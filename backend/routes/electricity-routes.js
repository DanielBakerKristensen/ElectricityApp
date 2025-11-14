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
        
        const hour = timestamp.getHours() + 1; // 1-24 format
        periodsByDay[dayKey].Point.push({
            position: hour.toString(),
            "out_Quantity.quantity": record.quantity.toString(),
            "out_Quantity.quality": record.quality || "OK"
        });
    });
    
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

router.get('/test-data/', async (req, res) => {
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
        // Query database
        const results = await queryConsumptionData(
            METERING_POINT_ID,
            dateFrom,
            dateTo,
            'Hour'
        );
        
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
