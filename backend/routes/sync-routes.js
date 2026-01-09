const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { adminAuth, userAuth } = require('../utils/auth-middleware');

/**
 * @swagger
 * /api/sync/trigger:
 *   post:
 *     summary: Manually trigger a data synchronization
 *     description: Triggers an immediate sync of electricity consumption data from Eloverblik API. Requires admin authentication.
 *     tags:
 *       - Sync
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 recordsSynced:
 *                   type: number
 *                   example: 24
 *                 logId:
 *                   type: number
 *                   example: 42
 *                 message:
 *                   type: string
 *                   example: Sync completed successfully
 *       401:
 *         description: Unauthorized - Missing or invalid authorization header
 *       403:
 *         description: Forbidden - Invalid admin token
 *       500:
 *         description: Sync failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Failed to fetch data from Eloverblik API
 *                 recordsSynced:
 *                   type: number
 *                   example: 0
 *       503:
 *         description: Sync scheduler not available
 */
router.post('/trigger', adminAuth, async (req, res) => {
    try {
        // Get the sync scheduler instance from app locals
        const syncScheduler = req.app.locals.syncScheduler;

        if (!syncScheduler) {
            return res.status(503).json({
                success: false,
                error: 'Sync scheduler is not available',
                message: 'Sync scheduler may be disabled or not initialized'
            });
        }

        // Trigger manual sync
        const { daysBack, dateFrom, dateTo, propertyId } = req.body;
        const result = await syncScheduler.triggerManualSync({
            daysBack,
            dateFrom,
            dateTo,
            propertyId
        });

        if (result.success) {
            return res.status(200).json({
                success: true,
                recordsSynced: result.recordsSynced,
                logId: result.logId,
                message: 'Sync completed successfully'
            });
        } else {
            return res.status(500).json({
                success: false,
                error: result.error,
                recordsSynced: result.recordsSynced || 0,
                message: 'Sync failed'
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            recordsSynced: 0,
            message: 'Unexpected error during sync execution'
        });
    }
});

module.exports = {
    router,
    adminAuth,
    userAuth
};
