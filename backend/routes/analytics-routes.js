const express = require('express');
const logger = require('../utils/logger');
const AnalyticsService = require('../services/analytics-service');

const router = express.Router();

// Middleware to validate date parameters
const validateDateParams = (req, res, next) => {
    const { dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
        return res.status(400).json({
            success: false,
            error: 'dateFrom and dateTo parameters are required'
        });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid date format. Use YYYY-MM-DD'
        });
    }

    // Validate that dateFrom is before dateTo
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (from > to) {
        return res.status(400).json({
            success: false,
            error: 'dateFrom must be before dateTo'
        });
    }

    next();
};

/**
 * @swagger
 * /api/analytics/year-over-year:
 *   get:
 *     summary: Get year-over-year consumption comparison
 *     description: Compare consumption for the same date range in different years
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: meteringPointId
 *         required: false
 *         schema:
 *           type: string
 *         description: Metering point ID (uses default if not provided)
 *     responses:
 *       200:
 *         description: Year-over-year comparison data
 */
router.get('/year-over-year', validateDateParams, async (req, res) => {
    try {
        const { dateFrom, dateTo, meteringPointId } = req.query;
        const meteringPoint = meteringPointId || process.env.ELOVERBLIK_METERING_POINTS;

        if (!meteringPoint) {
            return res.status(400).json({
                success: false,
                error: 'No metering point ID provided and no default configured'
            });
        }

        logger.info('Fetching year-over-year comparison', {
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint
        });

        const analyticsService = new AnalyticsService();
        const data = await analyticsService.getYearOverYearComparison({
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint
        });

        // Calculate summary statistics
        const currentTotal = data.reduce((sum, d) => sum + (d.current_consumption || 0), 0);
        const previousTotal = data.filter(d => d.previous_consumption !== null)
            .reduce((sum, d) => sum + (d.previous_consumption || 0), 0);

        const averageChange = data.filter(d => d.percentage_change !== null)
            .reduce((sum, d) => sum + d.percentage_change, 0) / 
            data.filter(d => d.percentage_change !== null).length;

        res.json({
            success: true,
            data,
            summary: {
                current_total: Math.round(currentTotal * 100) / 100,
                previous_total: Math.round(previousTotal * 100) / 100,
                total_change: Math.round((currentTotal - previousTotal) * 100) / 100,
                average_percentage_change: Math.round(averageChange * 100) / 100,
                records_with_comparison: data.filter(d => d.has_previous_data).length,
                total_records: data.length
            },
            dateRange: { from: dateFrom, to: dateTo }
        });

    } catch (error) {
        logger.error('Error fetching year-over-year comparison', {
            error: error.message,
            query: req.query
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch year-over-year comparison',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/analytics/month-over-month:
 *   get:
 *     summary: Get month-over-month consumption comparison
 *     description: Compare consumption for the same date range in different months
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: meteringPointId
 *         required: false
 *         schema:
 *           type: string
 *         description: Metering point ID (uses default if not provided)
 *     responses:
 *       200:
 *         description: Month-over-month comparison data
 */
router.get('/month-over-month', validateDateParams, async (req, res) => {
    try {
        const { dateFrom, dateTo, meteringPointId } = req.query;
        const meteringPoint = meteringPointId || process.env.ELOVERBLIK_METERING_POINTS;

        if (!meteringPoint) {
            return res.status(400).json({
                success: false,
                error: 'No metering point ID provided and no default configured'
            });
        }

        logger.info('Fetching month-over-month comparison', {
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint
        });

        const analyticsService = new AnalyticsService();
        const data = await analyticsService.getMonthOverMonthComparison({
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint
        });

        // Calculate summary statistics
        const currentTotal = data.reduce((sum, d) => sum + (d.current_consumption || 0), 0);
        const previousTotal = data.filter(d => d.previous_consumption !== null)
            .reduce((sum, d) => sum + (d.previous_consumption || 0), 0);

        const averageChange = data.filter(d => d.percentage_change !== null).length > 0
            ? data.filter(d => d.percentage_change !== null)
                .reduce((sum, d) => sum + d.percentage_change, 0) / 
              data.filter(d => d.percentage_change !== null).length
            : 0;

        res.json({
            success: true,
            data,
            summary: {
                current_total: Math.round(currentTotal * 100) / 100,
                previous_total: Math.round(previousTotal * 100) / 100,
                total_change: Math.round((currentTotal - previousTotal) * 100) / 100,
                average_percentage_change: Math.round(averageChange * 100) / 100,
                records_with_comparison: data.filter(d => d.has_previous_data).length,
                total_records: data.length
            },
            dateRange: { from: dateFrom, to: dateTo }
        });

    } catch (error) {
        logger.error('Error fetching month-over-month comparison', {
            error: error.message,
            query: req.query
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch month-over-month comparison',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/analytics/rolling-averages:
 *   get:
 *     summary: Get rolling averages for consumption data
 *     description: Calculate rolling averages (7-day, 30-day, 365-day) for consumption data
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: meteringPointId
 *         required: false
 *         schema:
 *           type: string
 *         description: Metering point ID (uses default if not provided)
 *       - in: query
 *         name: window
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['7', '30', '365', 'all']
 *         description: Window size in days (default is 'all' for all three)
 *     responses:
 *       200:
 *         description: Rolling averages data
 */
router.get('/rolling-averages', validateDateParams, async (req, res) => {
    try {
        const { dateFrom, dateTo, meteringPointId, window = 'all' } = req.query;
        const meteringPoint = meteringPointId || process.env.ELOVERBLIK_METERING_POINTS;

        if (!meteringPoint) {
            return res.status(400).json({
                success: false,
                error: 'No metering point ID provided and no default configured'
            });
        }

        logger.info('Fetching rolling averages', {
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint,
            window
        });

        const analyticsService = new AnalyticsService();
        let data;

        if (window === 'all') {
            data = await analyticsService.getAllRollingAverages({
                dateFrom,
                dateTo,
                meteringPointId: meteringPoint
            });
        } else {
            const windowDays = parseInt(window);
            if (![7, 30, 365].includes(windowDays)) {
                return res.status(400).json({
                    success: false,
                    error: 'Window must be 7, 30, 365, or "all"'
                });
            }

            data = await analyticsService.getRollingAverages({
                dateFrom,
                dateTo,
                meteringPointId: meteringPoint,
                windowDays
            });
        }

        res.json({
            success: true,
            data,
            window,
            summary: {
                total_records: data.length,
                date_range: { from: dateFrom, to: dateTo }
            }
        });

    } catch (error) {
        logger.error('Error fetching rolling averages', {
            error: error.message,
            query: req.query
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rolling averages',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/analytics/deviations:
 *   get:
 *     summary: Get significant deviations from historical averages
 *     description: Identify dates where consumption deviates significantly from the 30-day rolling average
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: meteringPointId
 *         required: false
 *         schema:
 *           type: string
 *         description: Metering point ID (uses default if not provided)
 *       - in: query
 *         name: threshold
 *         required: false
 *         schema:
 *           type: number
 *           default: 20
 *         description: Deviation threshold percentage (default 20%)
 *     responses:
 *       200:
 *         description: Significant deviations data
 */
router.get('/deviations', validateDateParams, async (req, res) => {
    try {
        const { dateFrom, dateTo, meteringPointId, threshold = 20 } = req.query;
        const meteringPoint = meteringPointId || process.env.ELOVERBLIK_METERING_POINTS;

        if (!meteringPoint) {
            return res.status(400).json({
                success: false,
                error: 'No metering point ID provided and no default configured'
            });
        }

        const deviationThreshold = parseFloat(threshold);
        if (isNaN(deviationThreshold) || deviationThreshold <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Threshold must be a positive number'
            });
        }

        logger.info('Fetching significant deviations', {
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint,
            threshold: deviationThreshold
        });

        const analyticsService = new AnalyticsService();
        const data = await analyticsService.getSignificantDeviations({
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint,
            deviationThreshold
        });

        // Calculate summary statistics
        const aboveAverage = data.filter(d => d.deviation_direction === 'above').length;
        const belowAverage = data.filter(d => d.deviation_direction === 'below').length;
        const maxDeviation = data.length > 0 ? Math.max(...data.map(d => d.deviation_percent)) : 0;

        res.json({
            success: true,
            data,
            summary: {
                total_deviations: data.length,
                above_average: aboveAverage,
                below_average: belowAverage,
                max_deviation_percent: Math.round(maxDeviation * 100) / 100,
                threshold_percent: deviationThreshold
            },
            dateRange: { from: dateFrom, to: dateTo }
        });

    } catch (error) {
        logger.error('Error fetching significant deviations', {
            error: error.message,
            query: req.query
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch significant deviations',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;
