const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and set HTTP-only cookie
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, is_admin: user.is_admin },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                onboarding_completed: user.onboarding_completed,
                is_admin: user.is_admin,
                defaultPropertyId: user.defaultPropertyId,
                defaultMeetingPointId: user.defaultMeetingPointId
            }
        });

    } catch (error) {
        logger.error('Login error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or email already exists
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            email,
            password_hash: hashedPassword,
            name: name || null,
            onboarding_completed: false
        });

        // Auto-login after registration by creating JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, is_admin: user.is_admin },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                onboarding_completed: user.onboarding_completed,
                is_admin: user.is_admin,
                defaultPropertyId: user.defaultPropertyId,
                defaultMeetingPointId: user.defaultMeetingPointId
            }
        });

    } catch (error) {
        logger.error('Registration error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized or invalid password
 */
router.put('/profile', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const { name, email, currentPassword, newPassword, defaultPropertyId, defaultMeetingPointId } = req.body;
        const updates = {};

        // Update name if provided
        if (name !== undefined) {
            updates.name = name;
        }

        // Update email if provided and different
        if (email && email !== user.email) {
            // Check if email is already taken
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ error: 'Email already in use' });
            }
            updates.email = email;
        }

        // Update password if both current and new passwords provided
        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
            updates.password_hash = await bcrypt.hash(newPassword, 10);
        }

        if (defaultPropertyId !== undefined) updates.defaultPropertyId = defaultPropertyId;
        if (defaultMeetingPointId !== undefined) updates.defaultMeetingPointId = defaultMeetingPointId;

        // Apply updates
        await user.update(updates);

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                onboarding_completed: user.onboarding_completed,
                is_admin: user.is_admin,
                defaultPropertyId: user.defaultPropertyId,
                defaultMeetingPointId: user.defaultMeetingPointId
            }
        });

    } catch (error) {
        logger.error('Profile update error', { error: error.message });
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/auth/onboarding-status:
 *   get:
 *     summary: Get user onboarding status
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Onboarding status retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/onboarding-status', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'email', 'name', 'onboarding_completed', 'is_admin']
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            onboarding_completed: user.onboarding_completed
        });

    } catch (error) {
        logger.error('Onboarding status check error', { error: error.message });
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify session and return user info
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Unauthorized
 */
router.get('/verify', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'email', 'name', 'onboarding_completed', 'is_admin', 'defaultPropertyId', 'defaultMeetingPointId']
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                onboarding_completed: user.onboarding_completed,
                is_admin: user.is_admin,
                defaultPropertyId: user.defaultPropertyId,
                defaultMeetingPointId: user.defaultMeetingPointId
            }
        });

    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Clear authentication cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
