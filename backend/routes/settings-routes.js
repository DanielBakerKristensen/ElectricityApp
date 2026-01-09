const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { Property, MeteringPoint } = require('../models');
const logger = require('../utils/logger');
const { userAuth } = require('../utils/auth-middleware');
const { sequelize } = require('../config/database');
const User = require('../models/User');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
};

// Apply user authentication to ALL settings routes
router.use(userAuth);

// --- Properties ---

// GET /api/settings/properties
router.get('/properties', async (req, res) => {
    try {
        // Find properties associated with the logged-in user
        const properties = await Property.findAll({
            include: [
                { model: MeteringPoint, as: 'meteringPoints' },
                {
                    model: User,
                    as: 'users',
                    where: { id: req.user.id },
                    attributes: [] // Don't include user data in result
                }
            ]
        });

        // Mask tokens
        const results = properties.map(p => {
            const json = p.toJSON();
            if (json.refresh_token) {
                json.refresh_token = `${json.refresh_token.substring(0, 10)}...`;
            }
            return json;
        });

        res.json(results);
    } catch (error) {
        logger.error('Error fetching properties:', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});

// POST /api/settings/properties
router.post('/properties', [
    body('name').notEmpty().withMessage('Name is required'),
    body('refresh_token').optional().isString(),
    body('latitude').optional().isDecimal().custom((value) => {
        const lat = parseFloat(value);
        if (lat < -90 || lat > 90) {
            throw new Error('Latitude must be between -90 and 90');
        }
        return true;
    }),
    body('longitude').optional().isDecimal().custom((value) => {
        const lng = parseFloat(value);
        if (lng < -180 || lng > 180) {
            throw new Error('Longitude must be between -180 and 180');
        }
        return true;
    }),
    validate
], async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const property = await Property.create(req.body, { transaction: t });

        // Associate with logged-in user
        const user = await User.findByPk(req.user.id);
        if (!user) {
            await t.rollback();
            return res.status(401).json({ error: 'User not found' });
        }
        await user.addProperty(property, { transaction: t });

        // Check if this is the user's first property to update onboarding status
        const userPropertiesCount = await user.countProperties({ transaction: t });
        if (userPropertiesCount === 1) { // This is the first one (just added)
            // Correction: countProperties might include the one we just added depending on timing/transaction isolation,
            // but effectively if we just added it, we can check if onboarding was false.
            if (!user.onboarding_completed) {
                await user.update({ onboarding_completed: true }, { transaction: t });
            }
        }

        await t.commit();
        res.status(201).json(property);
    } catch (error) {
        await t.rollback();
        logger.error('Error creating property:', error);
        res.status(500).json({ error: 'Failed to create property' });
    }
});

// PATCH /api/settings/properties/:id
router.patch('/properties/:id', [
    param('id').isInt(),
    body('name').optional().notEmpty(),
    body('refresh_token').optional().isString(),
    body('latitude').optional().isDecimal().custom((value) => {
        const lat = parseFloat(value);
        if (lat < -90 || lat > 90) {
            throw new Error('Latitude must be between -90 and 90');
        }
        return true;
    }),
    body('longitude').optional().isDecimal().custom((value) => {
        const lng = parseFloat(value);
        if (lng < -180 || lng > 180) {
            throw new Error('Longitude must be between -180 and 180');
        }
        return true;
    }),
    body('weather_sync_enabled').optional().isBoolean(),
    validate
], async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const user = await User.findByPk(req.user.id);
        const hasProperty = await user.hasProperty(id);

        if (!hasProperty) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const [updated] = await Property.update(req.body, { where: { id } });
        if (updated) {
            const property = await Property.findByPk(id);
            res.json(property);
        } else {
            res.status(404).json({ error: 'Property not found' });
        }
    } catch (error) {
        logger.error('Error updating property:', error);
        res.status(500).json({ error: 'Failed to update property' });
    }
});

// DELETE /api/settings/properties/:id
router.delete('/properties/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        // Check ownership
        const user = await User.findByPk(req.user.id);
        const hasProperty = await user.hasProperty(id);

        if (!hasProperty) {
            return res.status(404).json({ error: 'Property not found' });
        }

        // Manual Cascade: Delete metering points first
        await MeteringPoint.destroy({ where: { property_id: id } });

        const deleted = await Property.destroy({ where: { id } });
        if (deleted) res.status(204).send();
        else res.status(404).json({ error: 'Property not found' });
    } catch (error) {
        logger.error('Error deleting property:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// --- Metering Points (Scoped to Property) ---

// GET /api/settings/properties/:propertyId/metering-points
router.get('/properties/:propertyId/metering-points', async (req, res) => {
    try {
        const propertyId = parseInt(req.params.propertyId, 10);

        // Check ownership
        const user = await User.findByPk(req.user.id);
        const hasProperty = await user.hasProperty(propertyId);

        if (!hasProperty) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const mps = await MeteringPoint.findAll({
            where: { property_id: propertyId }
        });
        res.json(mps);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// POST /api/settings/properties/:propertyId/metering-points
router.post('/properties/:propertyId/metering-points', [
    param('propertyId').isInt(),
    body('meteringPointId').isString().isLength({ min: 18, max: 18 }).isNumeric().withMessage('Metering Point ID must be an 18-digit number'),
    body('name').optional().isString(),
    validate
], async (req, res) => {
    try {
        const propertyId = parseInt(req.params.propertyId, 10);
        const { name, meteringPointId } = req.body;

        // Check ownership
        const user = await User.findByPk(req.user.id);
        const hasProperty = await user.hasProperty(propertyId);

        if (!hasProperty) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const newMp = await MeteringPoint.create({
            property_id: propertyId,
            name: name || 'My Meter',
            meteringPointId: meteringPointId.trim()
        });
        res.status(201).json(newMp);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// DELETE /api/settings/metering-points/:id
router.delete('/metering-points/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        // Verify ownership (logic is a bit more complex here, need to check property of mp)
        const mp = await MeteringPoint.findByPk(id);
        if (!mp) return res.status(404).json({ error: 'Not found' });

        const user = await User.findByPk(req.user.id);
        const hasProperty = await user.hasProperty(mp.property_id);

        if (!hasProperty) {
            return res.status(404).json({ error: 'Not found' });
        }

        await mp.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// --- Legacy Compatibility (Optional, can be removed once frontend is updated) ---
// Masked tokens was previously at GET /api/settings/tokens
// Legacy compatibility route - Removing or updating to use user scope?
// Let's safe update it to only show user's tokens if needed, or arguably we can keep it as is if it's dead code.
// But better to secure it.
router.get('/tokens', async (req, res) => {
    try {
        const properties = await Property.findAll({
            include: [{
                model: User,
                as: 'users',
                where: { id: req.user.id }
            }]
        });
        const legacy = properties.filter(p => p.refresh_token).map(p => ({
            id: p.id,
            name: p.name,
            token: `${p.refresh_token.substring(0, 10)}...`,
            createdAt: p.createdAt
        }));
        res.json(legacy);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;
