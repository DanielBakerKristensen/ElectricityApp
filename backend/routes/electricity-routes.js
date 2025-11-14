const express = require('express');
const axios = require('axios');
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

module.exports = router;
