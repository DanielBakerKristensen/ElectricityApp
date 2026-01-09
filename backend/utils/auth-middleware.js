const jwt = require('jsonwebtoken');

/**
 * Basic authentication middleware for admin endpoints
 * Checks for a simple admin token in the Authorization header
 */
function adminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const adminToken = process.env.ADMIN_TOKEN;

    // If no admin token is configured, allow access (for development)
    if (!adminToken) {
        return next();
    }

    // Check for Bearer token format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid authorization header'
        });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (token !== adminToken) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid admin token'
        });
    }

    next();
}

/**
 * JWT authentication middleware for user sessions
 */
function userAuth(req, res, next) {
    // Try to get token from cookie first, then header
    let token = req.cookies.auth_token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
    }

    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
        });
    }

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret';
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired session'
        });
    }
}

/**
 * Middleware to require admin privileges
 * Must be placed AFTER userAuth
 */
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin privileges required'
        });
    }
    next();
}

module.exports = {
    adminAuth,
    userAuth,
    requireAdmin
};
