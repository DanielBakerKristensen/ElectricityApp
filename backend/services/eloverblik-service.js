const axios = require('axios');
const logger = require('../utils/logger');

const ELOVERBLIK_BASE_URL = 'https://api.eloverblik.dk/customerapi/api';

class EloverblikService {
    constructor() {
        this.tokens = new Map(); // Cache tokens keyed by refreshToken
    }

    async getAccessToken(refreshToken) {
        if (!refreshToken) {
            throw new Error('Refresh token is required');
        }

        const cached = this.tokens.get(refreshToken);
        if (cached && cached.expiry > Date.now()) {
            logger.debug('Using cached access token');
            return cached.token;
        }

        try {
            logger.info('Requesting new access token from Eloverblik');
            const response = await axios.get(`${ELOVERBLIK_BASE_URL}/token`, {
                headers: { 'Authorization': `Bearer ${refreshToken}` }
            });

            const accessToken = response.data.result;
            const expiry = Date.now() + (60 * 60 * 1000) - 30000;

            this.tokens.set(refreshToken, {
                token: accessToken,
                expiry: expiry
            });

            logger.info('Successfully obtained access token');
            return accessToken;
        } catch (error) {
            logger.error('Error getting access token:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw new Error('Failed to get access token from Eloverblik');
        }
    }

    async getConsumptionData(refreshToken, meteringPointId, dateFrom, dateTo) {
        try {
            const accessToken = await this.getAccessToken(refreshToken);

            logger.info('Fetching consumption data from Eloverblik', {
                meteringPointId,
                dateFrom,
                dateTo,
                url: `${ELOVERBLIK_BASE_URL}/meterdata/gettimeseries/${dateFrom}/${dateTo}/Hour`
            });

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
                    timeout: 15000 // Increased timeout for larger requests
                }
            );

            logger.info('Successfully fetched consumption data', {
                recordCount: response.data?.result?.length || 0
            });

            return response.data;
        } catch (error) {
            logger.error('Error fetching consumption data:', {
                meteringPointId,
                dateFrom,
                dateTo,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseData: error.response?.data,
                error: error.message
            });

            if (error.response?.status === 401) {
                // Token might be expired, clear it to force refresh on next request
                this.tokens.delete(refreshToken);
            }

            throw error;
        }
    }
}

module.exports = new EloverblikService();
