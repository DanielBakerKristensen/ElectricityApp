const express = require('express');
const router = express.Router();

// Import v1 route modules
const electricityRoutes = require('./electricity');
const testRoutes = require('./test');

// Mount routes
router.use('/electricity', electricityRoutes);
router.use('/test', testRoutes);

module.exports = router;
