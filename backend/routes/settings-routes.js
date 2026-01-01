const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { Property, MeteringPoint } = require('../models');
const logger = require('../utils/logger');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
};

// --- Properties ---

// GET /api/settings/properties
router.get('/properties', async (req, res) => {
    try {
        const properties = await Property.findAll({
            include: [{ model: MeteringPoint, as: 'meteringPoints' }]
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
    body('latitude').optional().isDecimal(),
    body('longitude').optional().isDecimal(),
    validate
], async (req, res) => {
    try {
        const property = await Property.create(req.body);
        res.status(201).json(property);
    } catch (error) {
        logger.error('Error creating property:', error);
        res.status(500).json({ error: 'Failed to create property' });
    }
});

// PATCH /api/settings/properties/:id
router.patch('/properties/:id', [
    param('id').isInt(),
    body('name').optional().notEmpty(),
    body('refresh_token').optional().isString(),
    body('latitude').optional().isDecimal(),
    body('longitude').optional().isDecimal(),
    body('weather_sync_enabled').optional().isBoolean(),
    validate
], async (req, res) => {
    try {
        const { id } = req.params;
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
        const { id } = req.params;
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
        const { propertyId } = req.params;
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
    body('meteringPointId').isLength({ min: 18, max: 18 }).isNumeric(),
    body('name').optional().isString(),
    validate
], async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { name, meteringPointId } = req.body;

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
        const { id } = req.params;
        const deleted = await MeteringPoint.destroy({ where: { id } });
        if (deleted) res.status(204).send();
        else res.status(404).json({ error: 'Not found' });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// --- Legacy Compatibility (Optional, can be removed once frontend is updated) ---
// Masked tokens was previously at GET /api/settings/tokens
router.get('/tokens', async (req, res) => {
    const props = await Property.findAll();
    const legacy = props.filter(p => p.refresh_token).map(p => ({
        id: p.id,
        name: p.name,
        token: `${p.refresh_token.substring(0, 10)}...`,
        createdAt: p.createdAt
    }));
    res.json(legacy);
});

module.exports = router;
