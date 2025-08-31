const axios = require('axios');
const logger = require('../utils/logger');

const ELOVERBLIK_BASE_URL = 'https://api.eloverblik.dk/customerapi/api';

class EloverblikService {
    constructor() {
        this.refreshToken = process.env.ELOVERBLIK_REFRESH_TOKEN;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async getAccessToken() {
        // Return cached token if it's still valid
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        try {
            const response = await axios.get(`${ELOVERBLIK_BASE_URL}/token`, {
                headers: { 'Authorization': `Bearer ${this.refreshToken}` }
            });
            
            this.accessToken = response.data.result;
            // Set token expiry to 1 hour from now (token typically expires in 1 hour)
            this.tokenExpiry = Date.now() + (60 * 60 * 1000) - 30000; // 30 seconds buffer
            
            return this.accessToken;
        } catch (error) {
            logger.error('Error getting access token:', error);
            throw new Error('Failed to get access token from Eloverblik');
        }
    }

    async getConsumptionData(meteringPointId, dateFrom, dateTo) {
        try {
            const accessToken = await this.getAccessToken();
            
            const response = await axios.post(
                `${ELOVERBLIK_BASE_URL}/meterdata/gettimeseries/${dateFrom}/${dateTo}/Hour`,
                {
                    meteringPoints: {
                        meteringPoint: [meteringPointId]
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

            return response.data;
        } catch (error) {
            logger.error('Error fetching consumption data:', {
                meteringPointId,
                dateFrom,
                dateTo,
                error: error.response?.data || error.message
            });
            
            if (error.response?.status === 401) {
                // Token might be expired, clear it to force refresh on next request
                this.accessToken = null;
                this.tokenExpiry = null;
            }
            
            throw error;
        }
    }
}

module.exports = new EloverblikService();
