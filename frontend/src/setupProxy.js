const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Use environment variable or default to localhost for local development
  const target = process.env.REACT_APP_PROXY_TARGET || 'http://localhost:5000';
  
  console.log(`🔧 Frontend proxy target: ${target}`);
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'debug',
    })
  );
};
