const express = require('express');
const axios = require('axios');
const router = express.Router();
const logger = require('../utils/logger');

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
        const errorMessage = error.response ? 
            `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}` : 
            error.message;
        logger.error('Error fetching access token:', errorMessage);
        throw new Error('Failed to get access token from Eloverblik');
    }
}

/**
 * @openapi
 * /api/test:
 *   get:
 *     summary: Test endpoint for Eloverblik API
 *     description: Fetches consumption data from Eloverblik API
 *     tags: [Test]
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date in YYYY-MM-DD format
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Successfully fetched data from Eloverblik
 *       400:
 *         description: Missing or invalid parameters
 *       500:
 *         description: Error fetching data from Eloverblik
 */
router.get('/', async (req, res) => {
    const { dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
        return res.status(400).json({ 
            success: false,
            error: 'Missing required parameters: dateFrom and dateTo',
            received: { dateFrom, dateTo }
        });
    }

    try {
        logger.info(`Fetching data from ${dateFrom} to ${dateTo} for metering point ${METERING_POINT_ID}`);
        
        // Get access token
        const accessToken = await getAccessToken();
        
        // Fetch consumption data
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
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            }
        );

        logger.info('Successfully fetched data from Eloverblik API');
        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        const statusCode = error.response?.status || 500;
        const errorData = error.response?.data || {};
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        
        logger.error('Error in test endpoint:', {
            message: errorMessage,
            status: statusCode,
            error: errorData,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        res.status(statusCode).json({
            success: false,
            error: 'Failed to fetch data from Eloverblik',
            message: errorMessage,
            ...(process.env.NODE_ENV === 'development' && {
                details: errorData,
                stack: error.stack
            })
        });
    }
});

// Export the router
module.exports = router;
