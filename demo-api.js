// Quick API demonstration script
require('dotenv').config();
const axios = require('axios');

const REFRESH_TOKEN = process.env.ELOVERBLIK_REFRESH_TOKEN;
const METERING_POINT_ID = process.env.ELOVERBLIK_METERING_POINTS;
const API_BASE_URL = 'https://api.eloverblik.dk/customerapi/api';

console.log('🔍 API Connection Test');
console.log('======================');
console.log(`✅ Refresh Token: ${REFRESH_TOKEN ? 'Present (length: ' + REFRESH_TOKEN.length + ')' : 'Missing'}`);
console.log(`✅ Metering Point: ${METERING_POINT_ID || 'Missing'}`);
console.log('');

async function testAPI() {
    try {
        // Step 1: Get Access Token
        console.log('📡 Step 1: Getting access token...');
        const tokenResponse = await axios.get(`${API_BASE_URL}/token`, {
            headers: { 'Authorization': `Bearer ${REFRESH_TOKEN}` }
        });
        
        const accessToken = tokenResponse.data.result;
        console.log('✅ Access token obtained successfully!');
        console.log('');

        // Step 2: Get Meter Data (yesterday's data)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBefore = new Date();
        dayBefore.setDate(dayBefore.getDate() - 2);
        
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const dateFrom = formatDate(dayBefore);
        const dateTo = formatDate(yesterday);
        
        console.log(`📊 Step 2: Fetching meter data from ${dateFrom} to ${dateTo}...`);
        
        const dataResponse = await axios.post(
            `${API_BASE_URL}/meterdata/gettimeseries/${dateFrom}/${dateTo}/Hour`,
            {
                "meteringPoints": {
                    "meteringPoint": [METERING_POINT_ID]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Meter data retrieved successfully!');
        console.log('');
        console.log('🔍 RAW API RESPONSE:');
        console.log('====================');
        console.log(JSON.stringify(dataResponse.data, null, 2));
        
        // Extract and show key information
        if (dataResponse.data && dataResponse.data.result) {
            const result = dataResponse.data.result[0];
            if (result && result.MyEnergyData_MarketDocument && result.MyEnergyData_MarketDocument.TimeSeries) {
                const timeSeries = result.MyEnergyData_MarketDocument.TimeSeries[0];
                if (timeSeries && timeSeries.Period && timeSeries.Period[0] && timeSeries.Period[0].Point) {
                    const points = timeSeries.Period[0].Point;
                    console.log('');
                    console.log('📈 PARSED DATA SUMMARY:');
                    console.log('========================');
                    console.log(`📅 Date Range: ${dateFrom} to ${dateTo}`);
                    console.log(`⚡ Total Data Points: ${points.length}`);
                    console.log(`🏠 Metering Point: ${METERING_POINT_ID}`);
                    console.log('');
                    console.log('📊 First 5 hourly readings:');
                    points.slice(0, 5).forEach((point, index) => {
                        console.log(`   Hour ${point.position}: ${point.out_Quantity.quantity} ${timeSeries.measurement_Unit.name}`);
                    });
                }
            }
        }

    } catch (error) {
        console.error('❌ API Test Failed:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            console.error('🔐 Authentication failed - check your refresh token');
        } else if (error.response?.status === 400) {
            console.error('📅 Bad request - check date format or metering point ID');
        }
    }
}

// Run the test
testAPI();
