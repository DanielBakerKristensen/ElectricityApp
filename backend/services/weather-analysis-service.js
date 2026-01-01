const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * WeatherAnalysisService - Handles analytical queries relating weather data to consumption
 */
class WeatherAnalysisService {
    /**
     * Get daily consumption combined with daily weather statistics
     * @param {Object} params - Query parameters
     * @param {string} params.dateFrom - Start date (YYYY-MM-DD)
     * @param {string} params.dateTo - End date (YYYY-MM-DD)
     * @param {string} params.meteringPointId - Metering point ID
     * @returns {Promise<Array>} Combined daily data
     */
    async getConsumptionTemperatureData({ dateFrom, dateTo, meteringPointId }) {
        const query = `
            WITH daily_consumption AS (
                SELECT 
                    DATE(timestamp) as date,
                    SUM(quantity) as daily_consumption
                FROM consumption_data 
                WHERE metering_point_id = $1
                    AND DATE(timestamp) BETWEEN $2 AND $3
                    AND aggregation_level = 'Hour'
                GROUP BY DATE(timestamp)
            ),
            daily_weather AS (
                SELECT 
                    DATE(timestamp) as date,
                    AVG(temperature_celsius) as avg_temperature,
                    MIN(temperature_celsius) as min_temperature,
                    MAX(temperature_celsius) as max_temperature,
                    AVG(humidity_percent) as avg_humidity,
                    SUM(precipitation_mm) as total_precipitation,
                    MODE() WITHIN GROUP (ORDER BY weather_condition) as weather_condition
                FROM weather_data 
                WHERE DATE(timestamp) BETWEEN $2 AND $3
                GROUP BY DATE(timestamp)
            )
            SELECT 
                COALESCE(dc.date, dw.date) as date,
                COALESCE(dc.daily_consumption, 0) as daily_consumption,
                ROUND(dw.avg_temperature::numeric, 1) as avg_temperature,
                ROUND(dw.min_temperature::numeric, 1) as min_temperature,
                ROUND(dw.max_temperature::numeric, 1) as max_temperature,
                ROUND(dw.avg_humidity::numeric, 1) as avg_humidity,
                ROUND(dw.total_precipitation::numeric, 2) as total_precipitation,
                dw.weather_condition,
                CASE 
                    WHEN dc.daily_consumption IS NULL THEN 'no_consumption_data'
                    WHEN dw.avg_temperature IS NULL THEN 'no_weather_data'
                    ELSE 'complete'
                END as data_status
            FROM daily_consumption dc
            FULL OUTER JOIN daily_weather dw ON dc.date = dw.date
            ORDER BY COALESCE(dc.date, dw.date)
        `;

        const results = await sequelize.query(query, {
            bind: [meteringPointId, dateFrom, dateTo],
            type: sequelize.QueryTypes.SELECT
        });

        return results;
    }

    /**
     * Calculate correlation statistics between consumption and temperature
     * @param {Object} params - Query parameters
     * @param {string} params.dateFrom - Start date
     * @param {string} params.dateTo - End date
     * @param {string} params.meteringPointId - Metering point ID
     * @returns {Promise<Object>} Correlation statistics
     */
    async getCorrelationAnalysis({ dateFrom, dateTo, meteringPointId }) {
        const correlationQuery = `
            WITH daily_data AS (
                SELECT 
                    DATE(cd.timestamp) as date,
                    SUM(cd.quantity) as daily_consumption,
                    AVG(wd.temperature_celsius) as avg_temperature
                FROM consumption_data cd
                JOIN weather_data wd ON DATE(cd.timestamp) = DATE(wd.timestamp)
                WHERE cd.metering_point_id = $1
                    AND DATE(cd.timestamp) BETWEEN $2 AND $3
                    AND cd.aggregation_level = 'Hour'
                    AND wd.temperature_celsius IS NOT NULL
                GROUP BY DATE(cd.timestamp)
                HAVING SUM(cd.quantity) > 0 AND AVG(wd.temperature_celsius) IS NOT NULL
            ),
            stats AS (
                SELECT 
                    COUNT(*) as n,
                    AVG(daily_consumption) as avg_consumption,
                    AVG(avg_temperature) as avg_temp,
                    STDDEV(daily_consumption) as std_consumption,
                    STDDEV(avg_temperature) as std_temp
                FROM daily_data
            )
            SELECT 
                s.n as sample_size,
                ROUND(s.avg_consumption::numeric, 2) as avg_consumption,
                ROUND(s.avg_temp::numeric, 1) as avg_temperature,
                CASE 
                    WHEN s.std_consumption > 0 AND s.std_temp > 0 THEN
                        ROUND(
                            (SUM((dd.daily_consumption - s.avg_consumption) * (dd.avg_temperature - s.avg_temp)) / (s.n - 1)) 
                            / (s.std_consumption * s.std_temp)
                        ::numeric, 3)
                    ELSE NULL
                END as correlation_coefficient
            FROM daily_data dd, stats s
            GROUP BY s.n, s.avg_consumption, s.avg_temp, s.std_consumption, s.std_temp
        `;

        const correlationResults = await sequelize.query(correlationQuery, {
            bind: [meteringPointId, dateFrom, dateTo],
            type: sequelize.QueryTypes.SELECT
        });

        const result = correlationResults[0] || {
            sample_size: 0,
            avg_consumption: null,
            avg_temperature: null,
            correlation_coefficient: null
        };

        // Interpret correlation strength
        let correlationStrength = 'No correlation';
        let correlationDescription = 'Insufficient data or no correlation found';

        if (result.correlation_coefficient !== null) {
            const absCorr = Math.abs(result.correlation_coefficient);
            if (absCorr >= 0.7) {
                correlationStrength = 'Strong';
                correlationDescription = result.correlation_coefficient > 0
                    ? 'Strong positive correlation - higher temperatures increase consumption'
                    : 'Strong negative correlation - higher temperatures decrease consumption';
            } else if (absCorr >= 0.3) {
                correlationStrength = 'Moderate';
                correlationDescription = result.correlation_coefficient > 0
                    ? 'Moderate positive correlation - temperatures somewhat increase consumption'
                    : 'Moderate negative correlation - temperatures somewhat decrease consumption';
            } else {
                correlationStrength = 'Weak';
                correlationDescription = 'Weak correlation - temperature has little effect on consumption';
            }
        }

        return {
            coefficient: result.correlation_coefficient,
            strength: correlationStrength,
            description: correlationDescription,
            sampleSize: result.sample_size,
            avgConsumption: result.avg_consumption,
            avgTemperature: result.avg_temperature
        };
    }
}

module.exports = new WeatherAnalysisService();
