const express = require('express');
const router = express.Router();

// API Routes (versioned)
const apiV1Router = require('./api/v1');
router.use('/api/v1', apiV1Router);

// Health check endpoint (unversioned)
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    versions: ['v1']
  });
});

// 404 handler for API routes
router.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableVersions: ['/api/v1']
  });
});

// Root redirect to API documentation
router.get('/', (req, res) => {
  res.redirect('/api-docs');
});

module.exports = router;
