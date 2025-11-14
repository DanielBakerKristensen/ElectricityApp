// Load environment variables from the .env file
require('dotenv').config();

// Import the axios library for making HTTP requests
const axios = require('axios');

// Get the refresh token and metering point ID from environment variables
const REFRESH_TOKEN = process.env.ELOVERBLIK_REFRESH_TOKEN;
const METERING_POINT_ID = process.env.ELOVERBLIK_METERING_POINTS;

// --- DEBUGGING: Check if environment variables are loaded ---
console.log(`REFRESH_TOKEN loaded: ${REFRESH_TOKEN ? 'Yes, length ' + REFRESH_TOKEN.length : 'No'}`);
console.log(`METERING_POINT_ID loaded: ${METERING_POINT_ID ? 'Yes' : 'No'}`);
// ----------------------------------------------------------

// Define the base URL for the Eloverblik API
const API_BASE_URL = 'https://api.eloverblik.dk/customerapi/api';

/**
 * Fetches a new, short-lived access token using the long-lived refresh token.
 * This token is required for all subsequent data requests.
 * @returns {Promise<string>} The new access token.
 */
async function getAccessToken() {
    console.log('Fetching a new access token...');
    try {
        const response = await axios.get(`${API_BASE_URL}/token`, {
            headers: {
                // The refresh token is used here for authorization
                'Authorization': `Bearer ${REFRESH_TOKEN}`,
            },
        });

        // The access token is found in the 'result' field of the response
        const accessToken = response.data.result;
        console.log('Access token successfully fetched.');
        return accessToken;
    } catch (error) {
        console.error('Error fetching access token:', error);
        throw new Error('Failed to get access token. Please check your REFRESH_TOKEN.');
    }
}

/**
 * Fetches time-series data for a given metering point and date range.
 * @param {string} dateFrom - The start date in 'YYYY-MM-DD' format.
 * @param {string} dateTo - The end date in 'YYYY-MM-DD' format.
 * @returns {Promise<object>} The time-series data.
 */
async function getMeterData(dateFrom, dateTo) {
    // Get a fresh access token before making the data request
    let accessToken;
    try {
        accessToken = await getAccessToken();
    } catch (error) {
        return; // Exit if we can't get an access token
    }

    console.log(`Fetching hourly data for metering point ${METERING_POINT_ID} from ${dateFrom} to ${dateTo}...`);
    try {
        // Construct the URL with dynamic date range and aggregation parameters
        const url = `${API_BASE_URL}/meterdata/gettimeseries/${dateFrom}/${dateTo}/Hour`;
        
        // Define the JSON request body
        const requestBody = {
            "meteringPoints": {
                "meteringPoint": [
                    METERING_POINT_ID
                ]
            }
        };
        
        const response = await axios.post(url, requestBody, {
            headers: {
                // The new access token is used here for authorization
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
        });

        console.log('Hourly data fetched successfully!');
        
        // Return the data from the API response
        return response.data;
    } catch (error) {
        console.error('Error fetching meter data:', error);
        throw new Error('Failed to get meter data. Please check your METERING_POINT_ID and date format.');
    }
}

// Example usage of the getMeterData function
// We'll fetch data for a 2-day range ending yesterday (since today's data might not be available yet).
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1); // Go back one day

const dayBeforeYesterday = new Date();
dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2); // Go back two days

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const dateFrom = formatDate(dayBeforeYesterday);
const dateTo = formatDate(yesterday);

// An async IIFE (Immediately Invoked Function Expression) to run the main logic
(async () => {
    try {
        console.log(`Fetching data from: ${dateFrom} to: ${dateTo}`);
        const hourlyData = await getMeterData(dateFrom, dateTo);
        console.log('--------------------------------------------------');
        console.log('Received JSON Data:');
        console.log(JSON.stringify(hourlyData, null, 2));
    } catch (error) {
        console.error('Script execution failed:', error.message);
    }
})();
