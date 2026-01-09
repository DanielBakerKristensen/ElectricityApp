const express = require('express');
const router = express.Router();
const { User, Property, MeteringPoint } = require('../models');
const { userAuth, requireAdmin } = require('../utils/auth-middleware');
const logger = require('../utils/logger');

// Apply auth and admin check to all routes
router.use(userAuth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'email', 'name', 'is_admin', 'onboarding_completed', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (error) {
        logger.error('Admin: Error fetching users', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * @swagger
 * /api/admin/properties:
 *   get:
 *     summary: List all properties with details
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of properties
 */
router.get('/properties', async (req, res) => {
    try {
        const properties = await Property.findAll({
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'email', 'name']
                },
                {
                    model: MeteringPoint,
                    as: 'meteringPoints'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Mask tokens in output
        const results = properties.map(p => {
            const json = p.toJSON();
            if (json.refresh_token) {
                json.refresh_token = `${json.refresh_token.substring(0, 10)}...`;
            }
            return json;
        });

        res.json(results);
    } catch (error) {
        logger.error('Admin: Error fetching properties', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});

/**
 * @swagger
 * /api/admin/metering-points:
 *   get:
 *     summary: List all metering points
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of metering points
 */
router.get('/metering-points', async (req, res) => {
    try {
        const mps = await MeteringPoint.findAll({
            include: [
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name'],
                    include: [{
                        model: User,
                        as: 'users',
                        attributes: ['id', 'email']
                    }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(mps);
    } catch (error) {
        logger.error('Admin: Error fetching metering points', error);
        res.status(500).json({ error: 'Failed to fetch metering points' });
    }
});

module.exports = router;
