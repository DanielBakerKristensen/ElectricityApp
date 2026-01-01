const express = require('express');
const axios = require('axios');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { Property, MeteringPoint } = require('../models');
const router = express.Router();

const ELOVERBLIK_BASE_URL = 'https://api.eloverblik.dk/customerapi/api';

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
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: integer
 *         description: ID of the property to use (for refresh token)
 *       - in: query
 *         name: meteringPointId
 *         schema:
 *           type: string
 *         description: Database ID of the metering point
 *     responses:
 *       200:
 *         description: Successfully retrieved consumption data
 */
router.get('/test-data', async (req, res) => {
    const { dateFrom, dateTo, propertyId, meteringPointId: dbMpId } = req.query;

    if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'Missing dateFrom or dateTo query parameters' });
    }

    try {
        let refreshToken;
        let meteringPointId;

        // 1. Resolve Metering Point and Property
        if (dbMpId) {
            const mpDoc = await MeteringPoint.findByPk(dbMpId, { include: ['property'] });
            if (!mpDoc) return res.status(404).json({ error: 'Metering Point not found' });

            meteringPointId = mpDoc.meteringPointId.trim();
            refreshToken = mpDoc.property?.refresh_token;
            console.log(`🔌 Using metering point: ${mpDoc.name} (${meteringPointId})`);
        } else if (propertyId) {
            const prop = await Property.findByPk(propertyId, { include: ['meteringPoints'] });
            if (!prop) return res.status(404).json({ error: 'Property not found' });

            refreshToken = prop.refresh_token;
            if (prop.meteringPoints && prop.meteringPoints.length > 0) {
                meteringPointId = prop.meteringPoints[0].meteringPointId.trim();
            }
        } else {
            // Default to first property/meter if none specified
            const defaultProp = await Property.findOne({ include: ['meteringPoints'] });
            if (!defaultProp || !defaultProp.meteringPoints?.length) {
                return res.status(400).json({ error: 'No properties/metering points configured in database' });
            }
            refreshToken = defaultProp.refresh_token;
            meteringPointId = defaultProp.meteringPoints[0].meteringPointId.trim();
        }

        if (!refreshToken) return res.status(400).json({ error: 'No refresh token available for selected property' });
        if (!meteringPointId) return res.status(400).json({ error: 'No metering point ID available' });

        // 2. Get Access Token
        const tokenRes = await axios.get(`${ELOVERBLIK_BASE_URL}/token`, {
            headers: { 'Authorization': `Bearer ${refreshToken}` }
        });
        const accessToken = tokenRes.data.result;

        // 3. Get Time Series
        const response = await axios.post(
            `${ELOVERBLIK_BASE_URL}/meterdata/gettimeseries/${dateFrom}/${dateTo}/Hour`,
            { meteringPoints: { meteringPoint: [meteringPointId] } },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching from Eloverblik:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch data from Eloverblik API' });
    }
});

/**
 * @swagger
 * /api/database-demo:
 *   get:
 *     summary: Fetch electricity consumption data from local database
 *     description: Retrieves hourly electricity consumption data from the local PostgreSQL database
 *     tags:
 *       - Electricity Data
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: meteringPointId
 *         schema:
 *           type: string
 *         description: Database ID of the metering point
 *     responses:
 *       200:
 *         description: Successfully retrieved consumption data
 */
router.get('/database-demo', async (req, res) => {
    const { dateFrom, dateTo, meteringPointId: dbMpId } = req.query;

    if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'Missing dateFrom or dateTo query parameters' });
    }

    try {
        let actualMpId;

        if (dbMpId) {
            const mp = await MeteringPoint.findByPk(dbMpId);
            if (!mp) return res.status(404).json({ error: 'Metering point not found' });
            actualMpId = mp.meteringPointId.trim();
        } else {
            // Default to first metering point
            const defaultMp = await MeteringPoint.findOne();
            if (!defaultMp) return res.status(400).json({ error: 'No metering points configured in database' });
            actualMpId = defaultMp.meteringPointId.trim();
        }

        const results = await queryConsumptionData(actualMpId, dateFrom, dateTo, 'Hour');
        res.json(formatForFrontend(results));
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Failed to fetch data from database', details: error.message });
    }
});

module.exports = router;
