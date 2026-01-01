const express = require('express');
const logger = require('../utils/logger');
const WeatherSyncService = require('../services/weather-sync-service');
const WeatherAnalysisService = require('../services/weather-analysis-service');
const { sequelize } = require('../config/database');

const router = express.Router();

/**
 * @swagger
 * /api/weather/consumption-temperature:
 *   get:
 *     summary: Get daily consumption data with temperature correlation
 *     description: Returns daily electricity consumption aggregated with daily average temperature
 *     tags:
 *       - Weather
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
 *         description: Daily consumption and temperature data
 */
router.get('/consumption-temperature', async (req, res) => {
    try {
        const { dateFrom, dateTo, meteringPointId } = req.query;

        // Validate required parameters
        if (!dateFrom || !dateTo) {
            return res.status(400).json({
                success: false,
                error: 'dateFrom and dateTo parameters are required'
            });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        // Use default metering point if not provided
        const meteringPoint = meteringPointId || process.env.ELOVERBLIK_METERING_POINTS;

        if (!meteringPoint) {
            return res.status(400).json({
                success: false,
                error: 'No metering point ID provided and no default configured'
            });
        }

        logger.info('Fetching consumption-temperature data', { dateFrom, dateTo, meteringPointId: meteringPoint });

        const results = await WeatherAnalysisService.getConsumptionTemperatureData({
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint
        });

        // Calculate some basic statistics
        const completeRecords = results.filter(r => r.data_status === 'complete');
        const totalConsumption = results.reduce((sum, r) => sum + parseFloat(r.daily_consumption || 0), 0);
        const avgTemperature = completeRecords.length > 0
            ? completeRecords.reduce((sum, r) => sum + parseFloat(r.avg_temperature || 0), 0) / completeRecords.length
            : null;

        res.json({
            success: true,
            data: results,
            summary: {
                totalRecords: results.length,
                completeRecords: completeRecords.length,
                totalConsumption: Math.round(totalConsumption * 100) / 100,
                avgTemperature: avgTemperature ? Math.round(avgTemperature * 10) / 10 : null,
                dateRange: { from: dateFrom, to: dateTo }
            }
        });

    } catch (error) {
        logger.error('Error fetching consumption-temperature data', { error: error.message, stack: error.stack, query: req.query });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch consumption-temperature data',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/weather/correlation:
 *   get:
 *     summary: Get correlation analysis between consumption and temperature
 *     description: Returns correlation coefficient and analysis between daily consumption and temperature
 *     tags:
 *       - Weather
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
 *     responses:
 *       200:
 *         description: Correlation analysis results
 */
router.get('/correlation', async (req, res) => {
    try {
        const { dateFrom, dateTo, meteringPointId } = req.query;

        if (!dateFrom || !dateTo) {
            return res.status(400).json({
                success: false,
                error: 'dateFrom and dateTo parameters are required'
            });
        }

        const meteringPoint = meteringPointId || process.env.ELOVERBLIK_METERING_POINTS;

        const correlation = await WeatherAnalysisService.getCorrelationAnalysis({
            dateFrom,
            dateTo,
            meteringPointId: meteringPoint
        });

        res.json({
            success: true,
            correlation,
            dateRange: { from: dateFrom, to: dateTo }
        });

    } catch (error) {
        logger.error('Error calculating correlation', { error: error.message, stack: error.stack, query: req.query });
        res.status(500).json({
            success: false,
            error: 'Failed to calculate correlation',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/weather/sync:
 *   post:
 *     summary: Trigger manual weather data sync
 *     description: Manually trigger weather data synchronization for a specific date range
 *     tags:
 *       - Weather
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dateFrom:
 *                 type: string
 *                 format: date
 *               dateTo:
 *                 type: string
 *                 format: date
 *               propertyId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Sync operation completed
 */
router.post('/sync', async (req, res) => {
    try {
        const { dateFrom, dateTo, propertyId } = req.body;

        logger.info('Manual weather sync triggered via API', {
            dateFrom,
            dateTo,
            propertyId,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        const weatherSyncService = new WeatherSyncService(sequelize, logger);

        const result = await weatherSyncService.syncWeatherData({
            dateFrom,
            dateTo,
            propertyId
        });

        res.json({
            success: result.success,
            recordsSynced: result.recordsSynced,
            logId: result.logId,
            error: result.error || null,
            message: result.message || null
        });

    } catch (error) {
        logger.error('Error in manual weather sync', { error: error.message, stack: error.stack, body: req.body });
        res.status(500).json({
            success: false,
            error: 'Failed to trigger weather sync',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;