const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');
const { User, Property, MeteringPoint, WeatherData, RefreshToken, UserProperty } = require('../models');
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

// Get a summary of data to be deleted for a user
router.get('/users/:id/delete-summary', userAuth, requireAdmin, async (req, res) => {
    const { id: userId } = req.params;
    const logger = req.logger;

    try {
        logger.info(`Admin: Fetching delete summary for user ${userId}`);

        // Step 1: Find the user
        const user = await User.findByPk(userId);
        if (!user) {
            logger.warn(`Admin: User ${userId} not found for delete summary.`);
            return res.status(404).json({ error: 'User not found' });
        }

        // Step 2: Find properties owned solely by this user
        const properties = await user.getProperties({
            include: [{ model: User, as: 'users', attributes: ['id'] }]
        });
        const propertiesToDelete = properties.filter(p => p.users.length === 1 && p.users[0].id === parseInt(userId, 10));
        
        logger.info(`Admin: Found ${propertiesToDelete.length} properties to delete for user ${userId}.`);

        // Step 3: Count dependent data with simple, fast queries (no deep includes)
        let propertiesToDeleteCount = propertiesToDelete.length;
        let meteringPointsToDeleteCount = 0;
        let weatherDataToDeleteCount = 0;
        let refreshTokensToDeleteCount = 0;

        for (const property of propertiesToDelete) {
            // Count metering points for this property
            const mpCount = await MeteringPoint.count({ where: { property_id: property.id } });
            meteringPointsToDeleteCount += mpCount;

            // Count weather data for this property
            const wdCount = await WeatherData.count({ where: { property_id: property.id } });
            weatherDataToDeleteCount += wdCount;

            // Count refresh tokens for this property
            const rtCount = await RefreshToken.count({ where: { property_id: property.id } });
            refreshTokensToDeleteCount += rtCount;
        }

        const summary = {
            properties: propertiesToDeleteCount,
            meteringPoints: meteringPointsToDeleteCount,
            weatherDataRecords: weatherDataToDeleteCount,
            refreshTokens: refreshTokensToDeleteCount
        };

        logger.info(`Admin: Delete summary for user ${userId}: ${JSON.stringify(summary)}`);

        res.json({
            user: { id: user.id, email: user.email },
            summary: summary
        });

    } catch (error) {
        logger.error(`Admin: Error fetching delete summary for user ${userId}`, {
            error: error.message,
            name: error.name,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to fetch delete summary' });
    }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user and all their data
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: User deleted successfully
 */
router.delete('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    console.log(`[DEBUG] Delete request received for user ID: ${userId}`);

    if (isNaN(userId)) {
        console.log(`[DEBUG] Invalid user ID: ${userId}`);
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === userId) {
        console.log(`[DEBUG] Admin trying to delete themselves: ${userId}`);
        return res.status(403).json({ error: 'Admin users cannot delete their own account' });
    }

    let transaction;
    try {
        console.log(`[DEBUG] Looking for user with ID: ${userId}`);
        const user = await User.findByPk(userId);
        if (!user) {
            console.log(`[DEBUG] User not found: ${userId}`);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log(`[DEBUG] Found user: ${user.email}`);

        // Step 1: Efficiently find and delete properties owned solely by this user
        const properties = await user.getProperties({
            include: [{ model: User, as: 'users', attributes: ['id'] }]
        });

        const propertiesToDelete = properties.filter(p => p.users.length === 1 && p.users[0].id === userId);
        console.log(`[DEBUG] Found ${propertiesToDelete.length} properties to delete`);

        for (const property of propertiesToDelete) {
            // Step 1: Delete all dependent data in the correct order
            
            // 1a: Delete all associated weather data
            await WeatherData.destroy({ where: { property_id: property.id } });
            
            // 1b: Delete all associated metering points
            await MeteringPoint.destroy({ where: { property_id: property.id } });
            
            // 1c: Delete all associated refresh tokens
            await RefreshToken.destroy({ where: { property_id: property.id } });
            
            // Step 2: Now that all dependents are gone, delete the property itself
            await property.destroy({});
        }

        // Step 2: Delete the user
        transaction = await sequelize.transaction();
        try {
            // Delete the user. Cascading deletes on UserProperty will clean up associations.
            await User.destroy({ where: { id: userId }, transaction });

            await transaction.commit();
        } catch (txError) {
            await transaction.rollback();
            throw txError; // Rethrow to be caught by the outer catch block
        }

        logger.info(`Admin user ${req.user.id} deleted user ${userId} and all associated data`);
        console.log(`[DEBUG] Successfully deleted user ${userId}`);
        res.status(204).send();

    } catch (error) {
        console.log(`[DEBUG] Error deleting user ${userId}:`, error.message);
        console.log(`[DEBUG] Error name:`, error.name);
        if (error.parent) {
            console.log(`[DEBUG] Parent error:`, error.parent.message);
        }
        
        // The inner transaction is already rolled back, so we just log and respond.
        // The check `if (transaction)` is not needed here as the outer block doesn't own it.
        logger.error(`Admin: Error deleting user ${userId}`, { 
            error: error.message, 
            name: error.name, 
            stack: error.stack 
        });
        
        let errorMessage = 'Failed to delete user and associated data.';
        if (error.parent && error.parent.detail) {
            errorMessage = `Database error: ${error.parent.detail}`;
        } else if (error.name === 'SequelizeForeignKeyConstraintError') {
            errorMessage = `A foreign key constraint is preventing deletion. Check model associations.`;
        }

        res.status(500).json({ error: errorMessage });
    }
});

module.exports = router;
