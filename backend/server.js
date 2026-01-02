const path = require('path');
const fs = require('fs');

console.log('--- STARTUP BREADCRUMB: TOP OF FILE ---');

// Auto-detect environment and load appropriate .env file
const isDocker = fs.existsSync('/.dockerenv') ||
  process.env.DOCKER_ENV === 'true' ||
  process.env.HOSTNAME?.includes('docker') ||
  fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');

const envFile = isDocker ? '.env.docker' : '.env.local';
const envPath = isDocker ?
  (fs.existsSync(path.join(__dirname, envFile)) ? path.join(__dirname, envFile) : path.join(__dirname, '..', envFile)) :
  path.join(__dirname, '..', envFile);

const finalEnvPath = fs.existsSync(envPath) ? envPath : path.join(__dirname, '../.env');
require('dotenv').config({ path: finalEnvPath });

console.log('--- STARTUP BREADCRUMB: ENV LOADED ---');
console.log(`🔧 Environment: ${isDocker ? 'Docker' : 'Local'}`);
console.log(`🔧 Loaded environment from: ${path.basename(finalEnvPath)}`);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const logger = require('./utils/logger');
const { sequelize, testConnection } = require('./config/database');
const SyncService = require('./services/sync-service');
const WeatherSyncService = require('./services/weather-sync-service');
const SyncScheduler = require('./services/sync-scheduler');
const eloverblikService = require('./services/eloverblik-service');

const app = express();
app.set('trust proxy', 1);

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://api.eloverblik.dk"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.options('*', cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

console.log('--- STARTUP BREADCRUMB: PRE-SWAGGER ---');
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
console.log('--- STARTUP BREADCRUMB: POST-SWAGGER ---');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Electricity App API',
  customfavIcon: '/favicon.ico'
}));

console.log('--- STARTUP BREADCRUMB: PRE-ROUTES ---');
const { router: syncRoutes, adminAuth } = require('./routes/sync-routes');
app.use('/api/settings', require('./routes/settings-routes'));
app.use('/api/auth', require('./routes/auth-routes'));
app.use('/api/sync', syncRoutes);
app.use('/api/weather', require('./routes/weather-routes'));
app.use('/api', require('./routes/electricity-routes'));
console.log('--- STARTUP BREADCRUMB: POST-ROUTES ---');

require('./models/RefreshToken');
require('./models/MeteringPoint');
require('./models/WeatherData');

async function startServer() {
  console.log('--- STARTUP BREADCRUMB: startServer() CALLED ---');
  try {
    await testConnection();
    console.log('--- STARTUP BREADCRUMB: DB AUTHENTICATED ---');

    if (process.env.NODE_ENV !== 'production') {
      logger.info('Syncing database models...');
      await sequelize.sync({ alter: true });
      logger.info('Database models synced');
    }

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, async () => {
      logger.info(`Server running on port ${PORT}`);
      console.log('--- STARTUP BREADCRUMB: SERVER LISTENING ---');

      const User = require('./models/User');
      const bcrypt = require('bcryptjs');
      const userCount = await User.count();
      if (userCount === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
          email: 'admin@example.com',
          password_hash: hashedPassword
        });
        logger.info('Default admin user created');
      }

      if (process.env.SYNC_ENABLED !== 'false') {
        const syncService = new SyncService(eloverblikService, sequelize, logger);
        const weatherSyncService = new WeatherSyncService(sequelize, logger);
        const syncScheduler = new SyncScheduler(syncService, weatherSyncService, logger);
        setTimeout(() => syncScheduler.start(), 10000);
        app.locals.syncScheduler = syncScheduler;
      }
    });

    const gracefulShutdown = (signal) => {
      server.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('--- STARTUP BREADCRUMB: ERROR IN startServer ---', error);
    process.exit(1);
  }
}

console.log('--- STARTUP BREADCRUMB: KICKING OFF startServer() ---');
startServer();
