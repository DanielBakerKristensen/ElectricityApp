const axios = require('axios');
const logger = require('../utils/logger');

class OpenMeteoService {
    constructor() {
        this.archiveBaseUrl = 'https://archive-api.open-meteo.com/v1/archive';
        this.forecastBaseUrl = 'https://api.open-meteo.com/v1/forecast';
        
        // Default location (Denmark coordinates from your sample)
        this.defaultLocation = {
            latitude: 55.0444,
            longitude: 9.4117
        };
        
        // Standard hourly parameters we want to fetch
        this.hourlyParams = [
            'temperature_2m',
            'relative_humidity_2m', 
            'precipitation',
            'weather_code',
            'wind_speed_10m',
            'pressure_msl'
        ];
    }

    /**
     * Fetch historical weather data for a date range
     * @param {Object} options - Query options
     * @param {string} options.startDate - Start date (YYYY-MM-DD)
     * @param {string} options.endDate - End date (YYYY-MM-DD)
     * @param {number} options.latitude - Latitude (optional, uses default)
     * @param {number} options.longitude - Longitude (optional, uses default)
     * @param {string[]} options.hourlyParams - Weather parameters (optional, uses default)
     * @returns {Promise<Object>} Weather data response
     */
    async fetchHistoricalWeather(options) {
        const {
            startDate,
            endDate,
            latitude = this.defaultLocation.latitude,
            longitude = this.defaultLocation.longitude,
            hourlyParams = this.hourlyParams
        } = options;

        try {
            const params = new URLSearchParams({
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                start_date: startDate,
                end_date: endDate,
                hourly: hourlyParams.join(','),
                timezone: 'auto'
            });

            const url = `${this.archiveBaseUrl}?${params}`;
            logger.info(`Fetching weather data: ${startDate} to ${endDate}`);

            const response = await axios.get(url, {
                timeout: 30000, // 30 second timeout
                headers: {
                    'User-Agent': 'ElectricityApp/1.0'
                }
            });

            logger.info(`Weather data fetched successfully: ${response.data.hourly.time.length} hours`);
            return response.data;

        } catch (error) {
            logger.error('Failed to fetch weather data:', {
                error: error.message,
                startDate,
                endDate,
                latitude,
                longitude
            });
            throw new Error(`Weather API error: ${error.message}`);
        }
    }

    /**
     * Fetch current weather forecast (for recent days)
     * @param {Object} options - Query options
     * @param {number} options.pastDays - Number of past days to include (default: 7)
     * @param {number} options.forecastDays - Number of forecast days (default: 1)
     * @returns {Promise<Object>} Weather forecast data
     */
    async fetchCurrentWeather(options = {}) {
        const {
            pastDays = 7,
            forecastDays = 1,
            latitude = this.defaultLocation.latitude,
            longitude = this.defaultLocation.longitude
        } = options;

        try {
            const params = new URLSearchParams({
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                hourly: this.hourlyParams.join(','),
                past_days: pastDays.toString(),
                forecast_days: forecastDays.toString(),
                timezone: 'auto'
            });

            const url = `${this.forecastBaseUrl}?${params}`;
            logger.info(`Fetching current weather with ${pastDays} past days`);

            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'ElectricityApp/1.0'
                }
            });

            return response.data;

        } catch (error) {
            logger.error('Failed to fetch current weather:', error.message);
            throw new Error(`Weather forecast API error: ${error.message}`);
        }
    }

    /**
     * Transform Open-Meteo response to our internal format
     * @param {Object} weatherData - Raw Open-Meteo response
     * @returns {Array} Array of weather records for database storage
     */
    transformWeatherData(weatherData) {
        const { hourly, latitude, longitude, timezone } = weatherData;
        
        if (!hourly || !hourly.time) {
            throw new Error('Invalid weather data format');
        }

        const records = [];
        
        for (let i = 0; i < hourly.time.length; i++) {
            const record = {
                location_id: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
                timestamp: new Date(hourly.time[i]),
                temperature_celsius: hourly.temperature_2m?.[i] || null,
                humidity_percent: hourly.relative_humidity_2m?.[i] || null,
                precipitation_mm: hourly.precipitation?.[i] || null,
                weather_condition: this.getWeatherCondition(hourly.weather_code?.[i]),
                wind_speed_kmh: hourly.wind_speed_10m?.[i] || null,
                pressure_hpa: hourly.pressure_msl?.[i] || null,
                timezone: timezone || 'UTC'
            };
            
            records.push(record);
        }

        return records;
    }

    /**
     * Convert WMO weather code to human-readable condition
     * @param {number} code - WMO weather code
     * @returns {string} Weather condition description
     */
    getWeatherCondition(code) {
        if (!code) return 'Unknown';
        
        const weatherCodes = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Fog',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            71: 'Slight snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            95: 'Thunderstorm',
            96: 'Thunderstorm with hail',
            99: 'Thunderstorm with heavy hail'
        };

        return weatherCodes[code] || `Weather code ${code}`;
    }

    /**
     * Get the optimal date range for batch processing
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {number} maxDaysPerBatch - Maximum days per API call (default: 365)
     * @returns {Array} Array of date range objects
     */
    getBatchDateRanges(startDate, endDate, maxDaysPerBatch = 365) {
        const ranges = [];
        let currentStart = new Date(startDate);
        
        while (currentStart < endDate) {
            let currentEnd = new Date(currentStart);
            currentEnd.setDate(currentEnd.getDate() + maxDaysPerBatch - 1);
            
            if (currentEnd > endDate) {
                currentEnd = new Date(endDate);
            }
            
            ranges.push({
                startDate: currentStart.toISOString().split('T')[0],
                endDate: currentEnd.toISOString().split('T')[0]
            });
            
            currentStart = new Date(currentEnd);
            currentStart.setDate(currentStart.getDate() + 1);
        }
        
        return ranges;
    }
}

module.exports = OpenMeteoService;