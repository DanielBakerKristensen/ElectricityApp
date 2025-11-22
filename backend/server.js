const path = require('path');
const fs = require('fs');

// Auto-detect environment and load appropriate .env file
// Check for Docker environment indicators
const isDocker = fs.existsSync('/.dockerenv') || 
                 process.env.DOCKER_ENV === 'true' ||
                 process.env.HOSTNAME?.includes('docker') ||
                 fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');

const envFile = isDocker ? '.env.docker' : '.env.local';
// For Docker, check in current directory first, then parent
const envPath = isDocker ? 
  (fs.existsSync(path.join(__dirname, envFile)) ? path.join(__dirname, envFile) : path.join(__dirname, '..', envFile)) :
  path.join(__dirname, '..', envFile);

// Fallback to .env if specific file doesn't exist
const finalEnvPath = fs.existsSync(envPath) ? envPath : path.join(__dirname, '../.env');

require('dotenv').config({ path: finalEnvPath });
console.log(`🔧 Environment: ${isDocker ? 'Docker' : 'Local'}`);
console.log(`🔧 Loaded environment from: ${path.basename(finalEnvPath)}`);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const logger = require('./utils/logger');
const { sequelize, testConnection } = require('./config/database');
const SyncService = require('./services/sync-service');
const SyncScheduler = require('./services/sync-scheduler');
const eloverblikService = require('./services/eloverblik-service');

const app = express();

// Trust first proxy (for Heroku, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Electricity App API',
      version: '1.0.0',
      description: 'API for Electricity Consumption App using eloverblik.dk',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./routes/*.js', './server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Debug: Log the swagger spec to see what's being generated
console.log('Swagger spec paths:', JSON.stringify(swaggerSpec.paths, null, 2));
console.log('Scanning for API docs in:', swaggerOptions.apis);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Electricity App API',
  customfavIcon: '/favicon.ico'
}));

// API Routes
app.use('/api', require('./routes/electricity-routes'));
app.use('/api/sync', require('./routes/sync-routes'));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API, including database connectivity and sync status
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 environment:
 *                   type: string
 *                   example: production
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 sync:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                     lastRun:
 *                       type: string
 *                       format: date-time
 *                     lastStatus:
 *                       type: string
 *                     recordsSynced:
 *                       type: number
 */
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Query most recent sync status from data_sync_log
    const [lastSyncResults] = await sequelize.query(
      `SELECT 
        status,
        records_synced,
        created_at,
        error_message
      FROM data_sync_log
      ORDER BY created_at DESC
      LIMIT 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const syncInfo = {
      enabled: process.env.SYNC_ENABLED !== 'false',
      lastRun: lastSyncResults?.created_at || null,
      lastStatus: lastSyncResults?.status || null,
      recordsSynced: lastSyncResults?.records_synced || null
    };

    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      sync: syncInfo
    });
  } catch (error) {
    // If database query fails, still return health status but without sync info
    logger.error('Error querying sync status in health check:', error);
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      sync: {
        enabled: process.env.SYNC_ENABLED !== 'false',
        lastRun: null,
        lastStatus: null,
        recordsSynced: null,
        error: 'Unable to query sync status'
      }
    });
  }
});

// Root endpoint redirects to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    params: req.params,
    query: req.query,
    body: req.body
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Start server
const PORT = process.env.PORT || 5000;
let syncScheduler = null;

const server = app.listen(PORT, async () => {
  try {
    await testConnection();
    logger.info(`Server running on port ${PORT}`);
    logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    
    // Initialize sync scheduler after database connection is established
    if (process.env.SYNC_ENABLED !== 'false') {
      try {
        const syncService = new SyncService(eloverblikService, sequelize, logger);
        syncScheduler = new SyncScheduler(syncService, logger);
        syncScheduler.start();
        
        // Store syncScheduler in app.locals for access by routes
        app.locals.syncScheduler = syncScheduler;
        
        logger.info('Sync scheduler initialized and started');
      } catch (schedulerError) {
        logger.error('Failed to initialize sync scheduler:', schedulerError);
        // Don't exit - allow server to continue running even if scheduler fails
      }
    } else {
      logger.info('Sync scheduler is disabled (SYNC_ENABLED=false)');
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  // Stop the sync scheduler first
  if (syncScheduler) {
    try {
      syncScheduler.stop();
      logger.info('Sync scheduler stopped');
    } catch (error) {
      logger.error('Error stopping sync scheduler:', error);
    }
  }
  
  // Close the server
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close database connections
    try {
      await sequelize.close();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections:', error);
    }
    
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle SIGTERM signal (Docker stop, Kubernetes termination)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT signal (Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  gracefulShutdown('unhandledRejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

module.exports = server;
