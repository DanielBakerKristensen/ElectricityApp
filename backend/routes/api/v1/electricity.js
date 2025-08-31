const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const eloverblikService = require('../../../services/eloverblik-service');
const logger = require('../../../utils/logger');

/**
 * @swagger
 * /api/v1/electricity/consumption:
 *   get:
 *     summary: Get electricity consumption data
 *     tags: [Electricity]
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         required: true
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *         required: true
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200: { description: Electricity consumption data }
 *       400: { description: Invalid parameters }
 *       500: { description: Server error }
 */
router.get(
  '/consumption',
  [
    check('dateFrom').isISO8601().toDate(),
    check('dateTo').isISO8601().toDate()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { dateFrom, dateTo } = req.query;
      const data = await eloverblikService.getConsumptionData(
        process.env.ELOVERBLIK_METERING_POINTS.split(',')[0],
        dateFrom,
        dateTo
      );
      
      res.json({
        success: true,
        from: dateFrom,
        to: dateTo,
        data,
      });
    } catch (error) {
      logger.error('Error fetching consumption data:', {
        error: error.message,
        stack: error.stack,
        query: req.query,
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch consumption data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

module.exports = router;
