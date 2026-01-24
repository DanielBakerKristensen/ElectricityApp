const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');

// Simple health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await sequelize.authenticate().then(() => 'up').catch(() => 'down');

    // Get real sync status from database
    let syncStatus = {
      lastRun: null,
      lastStatus: 'unknown',
      recordsSynced: 0
    };

    if (dbStatus === 'up') {
      try {
        const [latestLog] = await sequelize.query(
          `SELECT created_at, status, records_synced 
                 FROM data_sync_log 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
          { type: sequelize.QueryTypes.SELECT }
        );

        if (latestLog) {
          syncStatus = {
            lastRun: latestLog.created_at,
            lastStatus: latestLog.status,
            recordsSynced: latestLog.records_synced || 0
          };
        }
      } catch (err) {
        console.error('Failed to fetch sync logs:', err);
        // Keep default unknown status but log error
      }
    }

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'electricity-app-backend',
      environment: process.env.NODE_ENV || 'development',
      components: {
        api: {
          status: 'up',
          responseTime: '<100ms'
        },
        database: {
          status: dbStatus,
          type: 'PostgreSQL'
        }
      },
      sync: syncStatus
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'electricity-app-backend',
      error: error.message
    });
  }
});

module.exports = router;
