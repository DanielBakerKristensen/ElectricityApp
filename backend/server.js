require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const logger = require('./utils/logger');
const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

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
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.set('trust proxy', 1); // Trust first proxy
app.use(helmet());

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:8080',
      /^http:\/\/localhost:\d+$/ // Allow any localhost port
    ];
    
    // Check if the origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Electricity App API',
  customfavIcon: '/favicon.ico'
}));

// API Routes - Only keeping test endpoint for now
app.use('/api', require('./routes/test'));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current status of the API
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: API is running
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
 *                   example: 2025-08-23T08:30:00.000Z
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ 
    success: false,
    error: 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    logger.info('Starting server initialization...');
    
    // 1. Test database connection
    logger.info('Testing database connection...');
    await testConnection();
    
    // 2. Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Rejection:', err);
      // Close server and exit process
      server.close(() => process.exit(1));
    });
    
    return server;
  } catch (error) {
    logger.error('Fatal error during server startup:', error);
    process.exit(1);
  }
};

// Start the application
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
