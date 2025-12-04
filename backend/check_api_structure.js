const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ELOVERBLIK_BASE_URL = 'https://api.eloverblik.dk/customerapi/api';
const REFRESH_TOKEN = process.env.ELOVERBLIK_REFRESH_TOKEN;
const METERING_POINT_ID = process.env.ELOVERBLIK_METERING_POINTS;

async function getAccessToken() {
    const response = await axios.get(`${ELOVERBLIK_BASE_URL}/token`, {
        headers: { 'Authorization': `Bearer ${REFRESH_TOKEN}` }
    });
    return response.data.result;
}

async function testApi() {
    try {
        const token = await getAccessToken();
        const dateFrom = '2025-11-22';
        const dateTo = '2025-11-23';

        console.log(`Fetching data for ${dateFrom} to ${dateTo}...`);

        const response = await axios.post(
            `${ELOVERBLIK_BASE_URL}/meterdata/gettimeseries/${dateFrom}/${dateTo}/Hour`,
            {
                meteringPoints: {
                    meteringPoint: [METERING_POINT_ID]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const points = response.data.result[0].MyEnergyData_MarketDocument.TimeSeries[0].Period[0].Point;
        console.log('First point structure:', JSON.stringify(points[0], null, 2));

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.error('Response data:', error.response.data);
    }
}

testApi();
