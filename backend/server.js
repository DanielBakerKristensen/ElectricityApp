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
const { testConnection } = require('./config/database');

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
  apis: [
    './routes/api/v1/*.js',
    './routes/api/v1/*.yaml',
    './routes/api/v1/*.yml'
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Electricity App API',
  customfavIcon: '/favicon.ico'
}));

// API Routes - Only keeping test endpoint for now
app.use('/api', require('./routes/electricity-routes'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
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
const server = app.listen(PORT, async () => {
  try {
    await testConnection();
    logger.info(`Server running on port ${PORT}`);
    logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = server;
