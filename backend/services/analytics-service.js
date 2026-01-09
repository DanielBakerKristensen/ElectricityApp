const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

/**
 * AnalyticsService - Provides advanced analytics and comparative analysis
 * Handles year-over-year comparisons, month-over-month comparisons, and rolling averages
 */
class AnalyticsService {
    constructor(sequelizeInstance, loggerInstance) {
        this.sequelize = sequelizeInstance || sequelize;
        this.logger = loggerInstance || logger;
    }

    /**
     * Get year-over-year comparison data
     * Compares consumption for the same date range in different years
     * @param {Object} options - Comparison options
     * @param {string} options.dateFrom - Start date (YYYY-MM-DD)
     * @param {string} options.dateTo - End date (YYYY-MM-DD)
     * @param {string} options.meteringPointId - Metering point ID
     * @returns {Promise<Array>} Array of comparison data with current and previous year values
     */
    async getYearOverYearComparison(options) {
        const { dateFrom, dateTo, meteringPointId } = options;

        try {
            this.logger.info('Calculating year-over-year comparison', {
                dateFrom,
                dateTo,
                meteringPointId
            });

            // Parse dates
            const currentStart = new Date(dateFrom);
            const currentEnd = new Date(dateTo);

            // Calculate previous year dates
            const previousStart = new Date(currentStart);
            previousStart.setFullYear(previousStart.getFullYear() - 1);

            const previousEnd = new Date(currentEnd);
            previousEnd.setFullYear(previousEnd.getFullYear() - 1);

            const formatDate = (date) => date.toISOString().split('T')[0];

            // Query current year data
            const currentYearQuery = `
                SELECT 
                    DATE(timestamp) as date,
                    SUM(CAST(value AS DECIMAL)) as consumption,
                    COUNT(*) as record_count
                FROM consumption_data
                WHERE metering_point_id = $1
                    AND DATE(timestamp) BETWEEN $2 AND $3
                GROUP BY DATE(timestamp)
                ORDER BY DATE(timestamp)
            `;

            const currentYearData = await this.sequelize.query(currentYearQuery, {
                bind: [meteringPointId, dateFrom, dateTo],
                type: this.sequelize.QueryTypes.SELECT
            });

            // Query previous year data
            const previousYearQuery = `
                SELECT 
                    DATE(timestamp) as date,
                    SUM(CAST(value AS DECIMAL)) as consumption,
                    COUNT(*) as record_count
                FROM consumption_data
                WHERE metering_point_id = $1
                    AND DATE(timestamp) BETWEEN $2 AND $3
                GROUP BY DATE(timestamp)
                ORDER BY DATE(timestamp)
            `;

            const previousYearData = await this.sequelize.query(previousYearQuery, {
                bind: [meteringPointId, formatDate(previousStart), formatDate(previousEnd)],
                type: this.sequelize.QueryTypes.SELECT
            });

            // Combine results
            const result = this.combineComparisonData(currentYearData, previousYearData, 'year');

            this.logger.info('Year-over-year comparison calculated', {
                recordsCount: result.length,
                dateFrom,
                dateTo
            });

            return result;

        } catch (error) {
            this.logger.error('Error calculating year-over-year comparison', {
                error: error.message,
                options
            });
            throw new Error(`Failed to calculate year-over-year comparison: ${error.message}`);
        }
    }

    /**
     * Get month-over-month comparison data
     * Compares consumption for the same date range in different months
     * @param {Object} options - Comparison options
     * @param {string} options.dateFrom - Start date (YYYY-MM-DD)
     * @param {string} options.dateTo - End date (YYYY-MM-DD)
     * @param {string} options.meteringPointId - Metering point ID
     * @returns {Promise<Array>} Array of comparison data with current and previous month values
     */
    async getMonthOverMonthComparison(options) {
        const { dateFrom, dateTo, meteringPointId } = options;

        try {
            this.logger.info('Calculating month-over-month comparison', {
                dateFrom,
                dateTo,
                meteringPointId
            });

            // Parse dates
            const currentStart = new Date(dateFrom);
            const currentEnd = new Date(dateTo);

            // Calculate previous month dates
            const previousStart = new Date(currentStart);
            previousStart.setMonth(previousStart.getMonth() - 1);

            const previousEnd = new Date(currentEnd);
            previousEnd.setMonth(previousEnd.getMonth() - 1);

            const formatDate = (date) => date.toISOString().split('T')[0];

            // Query current month data
            const currentMonthQuery = `
                SELECT 
                    DATE(timestamp) as date,
                    SUM(CAST(value AS DECIMAL)) as consumption,
                    COUNT(*) as record_count
                FROM consumption_data
                WHERE metering_point_id = $1
                    AND DATE(timestamp) BETWEEN $2 AND $3
                GROUP BY DATE(timestamp)
                ORDER BY DATE(timestamp)
            `;

            const currentMonthData = await this.sequelize.query(currentMonthQuery, {
                bind: [meteringPointId, dateFrom, dateTo],
                type: this.sequelize.QueryTypes.SELECT
            });

            // Query previous month data
            const previousMonthQuery = `
                SELECT 
                    DATE(timestamp) as date,
                    SUM(CAST(value AS DECIMAL)) as consumption,
                    COUNT(*) as record_count
                FROM consumption_data
                WHERE metering_point_id = $1
                    AND DATE(timestamp) BETWEEN $2 AND $3
                GROUP BY DATE(timestamp)
                ORDER BY DATE(timestamp)
            `;

            const previousMonthData = await this.sequelize.query(previousMonthQuery, {
                bind: [meteringPointId, formatDate(previousStart), formatDate(previousEnd)],
                type: this.sequelize.QueryTypes.SELECT
            });

            // Combine results
            const result = this.combineComparisonData(currentMonthData, previousMonthData, 'month');

            this.logger.info('Month-over-month comparison calculated', {
                recordsCount: result.length,
                dateFrom,
                dateTo
            });

            return result;

        } catch (error) {
            this.logger.error('Error calculating month-over-month comparison', {
                error: error.message,
                options
            });
            throw new Error(`Failed to calculate month-over-month comparison: ${error.message}`);
        }
    }

    /**
     * Calculate rolling averages for consumption data
     * @param {Object} options - Rolling average options
     * @param {string} options.dateFrom - Start date (YYYY-MM-DD)
     * @param {string} options.dateTo - End date (YYYY-MM-DD)
     * @param {string} options.meteringPointId - Metering point ID
     * @param {number} options.windowDays - Window size in days (7, 30, or 365)
     * @returns {Promise<Array>} Array of daily data with rolling averages
     */
    async getRollingAverages(options) {
        const { dateFrom, dateTo, meteringPointId, windowDays = 7 } = options;

        try {
            this.logger.info('Calculating rolling averages', {
                dateFrom,
                dateTo,
                meteringPointId,
                windowDays
            });

            // Validate window size
            if (![7, 30, 365].includes(windowDays)) {
                throw new Error('Window size must be 7, 30, or 365 days');
            }

            const query = `
                SELECT 
                    DATE(timestamp) as date,
                    SUM(CAST(value AS DECIMAL)) as daily_consumption,
                    AVG(SUM(CAST(value AS DECIMAL))) OVER (
                        ORDER BY DATE(timestamp) 
                        ROWS BETWEEN ${windowDays - 1} PRECEDING AND CURRENT ROW
                    ) as rolling_avg_${windowDays}d,
                    COUNT(*) as record_count
                FROM consumption_data
                WHERE metering_point_id = $1
                    AND DATE(timestamp) BETWEEN $2 AND $3
                GROUP BY DATE(timestamp)
                ORDER BY DATE(timestamp)
            `;

            const result = await this.sequelize.query(query, {
                bind: [meteringPointId, dateFrom, dateTo],
                type: this.sequelize.QueryTypes.SELECT
            });

            this.logger.info('Rolling averages calculated', {
                recordsCount: result.length,
                windowDays,
                dateFrom,
                dateTo
            });

            return result;

        } catch (error) {
            this.logger.error('Error calculating rolling averages', {
                error: error.message,
                options
            });
            throw new Error(`Failed to calculate rolling averages: ${error.message}`);
        }
    }

    /**
     * Get all rolling averages (7-day, 30-day, 365-day) in one call
     * @param {Object} options - Options
     * @param {string} options.dateFrom - Start date (YYYY-MM-DD)
     * @param {string} options.dateTo - End date (YYYY-MM-DD)
     * @param {string} options.meteringPointId - Metering point ID
     * @returns {Promise<Array>} Array of daily data with all rolling averages
     */
    async getAllRollingAverages(options) {
        const { dateFrom, dateTo, meteringPointId } = options;

        try {
            this.logger.info('Calculating all rolling averages', {
                dateFrom,
                dateTo,
                meteringPointId
            });

            const query = `
                SELECT 
                    DATE(timestamp) as date,
                    SUM(CAST(value AS DECIMAL)) as daily_consumption,
                    AVG(SUM(CAST(value AS DECIMAL))) OVER (
                        ORDER BY DATE(timestamp) 
                        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                    ) as rolling_avg_7d,
                    AVG(SUM(CAST(value AS DECIMAL))) OVER (
                        ORDER BY DATE(timestamp) 
                        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                    ) as rolling_avg_30d,
                    AVG(SUM(CAST(value AS DECIMAL))) OVER (
                        ORDER BY DATE(timestamp) 
                        ROWS BETWEEN 364 PRECEDING AND CURRENT ROW
                    ) as rolling_avg_365d,
                    COUNT(*) as record_count
                FROM consumption_data
                WHERE metering_point_id = $1
                    AND DATE(timestamp) BETWEEN $2 AND $3
                GROUP BY DATE(timestamp)
                ORDER BY DATE(timestamp)
            `;

            const result = await this.sequelize.query(query, {
                bind: [meteringPointId, dateFrom, dateTo],
                type: this.sequelize.QueryTypes.SELECT
            });

            this.logger.info('All rolling averages calculated', {
                recordsCount: result.length,
                dateFrom,
                dateTo
            });

            return result;

        } catch (error) {
            this.logger.error('Error calculating all rolling averages', {
                error: error.message,
                options
            });
            throw new Error(`Failed to calculate all rolling averages: ${error.message}`);
        }
    }

    /**
     * Identify significant deviations from historical averages
     * @param {Object} options - Options
     * @param {string} options.dateFrom - Start date (YYYY-MM-DD)
     * @param {string} options.dateTo - End date (YYYY-MM-DD)
     * @param {string} options.meteringPointId - Metering point ID
     * @param {number} options.deviationThreshold - Deviation threshold percentage (default: 20)
     * @returns {Promise<Array>} Array of dates with significant deviations
     */
    async getSignificantDeviations(options) {
        const { dateFrom, dateTo, meteringPointId, deviationThreshold = 20 } = options;

        try {
            this.logger.info('Identifying significant deviations', {
                dateFrom,
                dateTo,
                meteringPointId,
                deviationThreshold
            });

            const query = `
                WITH daily_data AS (
                    SELECT 
                        DATE(timestamp) as date,
                        SUM(CAST(value AS DECIMAL)) as daily_consumption
                    FROM consumption_data
                    WHERE metering_point_id = $1
                        AND DATE(timestamp) BETWEEN $2 AND $3
                    GROUP BY DATE(timestamp)
                ),
                with_avg AS (
                    SELECT 
                        date,
                        daily_consumption,
                        AVG(daily_consumption) OVER (
                            ORDER BY date 
                            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                        ) as rolling_avg_30d
                    FROM daily_data
                )
                SELECT 
                    date,
                    daily_consumption,
                    rolling_avg_30d,
                    ROUND(
                        ABS(daily_consumption - rolling_avg_30d) / rolling_avg_30d * 100,
                        2
                    ) as deviation_percent,
                    CASE 
                        WHEN daily_consumption > rolling_avg_30d THEN 'above'
                        WHEN daily_consumption < rolling_avg_30d THEN 'below'
                        ELSE 'normal'
                    END as deviation_direction
                FROM with_avg
                WHERE rolling_avg_30d IS NOT NULL
                    AND ABS(daily_consumption - rolling_avg_30d) / rolling_avg_30d * 100 > $4
                ORDER BY date
            `;

            const result = await this.sequelize.query(query, {
                bind: [meteringPointId, dateFrom, dateTo, deviationThreshold],
                type: this.sequelize.QueryTypes.SELECT
            });

            this.logger.info('Significant deviations identified', {
                recordsCount: result.length,
                threshold: deviationThreshold,
                dateFrom,
                dateTo
            });

            return result;

        } catch (error) {
            this.logger.error('Error identifying significant deviations', {
                error: error.message,
                options
            });
            throw new Error(`Failed to identify significant deviations: ${error.message}`);
        }
    }

    /**
     * Helper method to combine comparison data
     * @private
     */
    combineComparisonData(currentData, previousData, comparisonType) {
        const result = [];
        const previousMap = new Map();

        // Create map of previous period data for quick lookup
        previousData.forEach(item => {
            const dayOfMonth = new Date(item.date).getDate();
            previousMap.set(dayOfMonth, item);
        });

        // Combine current and previous data
        currentData.forEach(item => {
            const dayOfMonth = new Date(item.date).getDate();
            const previousItem = previousMap.get(dayOfMonth);

            const currentConsumption = parseFloat(item.consumption || 0);
            const previousConsumption = previousItem ? parseFloat(previousItem.consumption || 0) : null;

            let percentageChange = null;
            let absoluteDifference = null;

            if (previousConsumption !== null && previousConsumption > 0) {
                absoluteDifference = currentConsumption - previousConsumption;
                percentageChange = (absoluteDifference / previousConsumption) * 100;
            }

            result.push({
                date: item.date,
                current_consumption: currentConsumption,
                previous_consumption: previousConsumption,
                absolute_difference: absoluteDifference,
                percentage_change: percentageChange ? Math.round(percentageChange * 100) / 100 : null,
                comparison_type: comparisonType,
                has_previous_data: previousConsumption !== null
            });
        });

        return result;
    }
}

module.exports = AnalyticsService;
