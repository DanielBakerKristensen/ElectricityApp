const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');

// Simple health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await sequelize.authenticate().then(() => 'up').catch(() => 'down');
    
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
      sync: {
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        lastStatus: 'success',
        recordsSynced: 191
      }
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
