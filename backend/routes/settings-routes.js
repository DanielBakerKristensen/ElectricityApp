const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const RefreshToken = require('../models/RefreshToken');
const MeteringPoint = require('../models/MeteringPoint');
const logger = require('../utils/logger');

// Middleware to handle validation errors
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// --- Refresh Tokens ---

// GET /api/settings/tokens
router.get('/tokens', async (req, res) => {
    try {
        const tokens = await RefreshToken.findAll({
            order: [['createdAt', 'DESC']]
        });

        // Mask tokens for security
        const maskedTokens = tokens.map(t => ({
            id: t.id,
            name: t.name,
            token: t.token ? `${t.token.substring(0, 10)}...` : null,
            createdAt: t.createdAt
        }));

        res.json(maskedTokens);
    } catch (error) {
        logger.error('Error fetching refresh tokens:', error);
        res.status(500).json({ error: 'Failed to fetch refresh tokens' });
    }
});

// POST /api/settings/tokens
router.post('/tokens', [
    body('token').notEmpty().withMessage('Token is required'),
    body('name').optional().isString().trim(),
    validate
], async (req, res) => {
    try {
        const { name, token } = req.body;

        const newToken = await RefreshToken.create({
            name: name || 'My Token',
            token
        });

        res.status(201).json({
            id: newToken.id,
            name: newToken.name,
            createdAt: newToken.createdAt
        });
    } catch (error) {
        logger.error('Error creating refresh token:', error);
        res.status(500).json({ error: 'Failed to create refresh token' });
    }
});

// DELETE /api/settings/tokens/:id
router.delete('/tokens/:id', [
    param('id').isInt().withMessage('ID must be an integer'),
    validate
], async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await RefreshToken.destroy({
            where: { id }
        });

        if (deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ error: 'Token not found' });
        }
    } catch (error) {
        logger.error('Error deleting refresh token:', error);
        res.status(500).json({ error: 'Failed to delete refresh token' });
    }
});

// --- Metering Points ---

// GET /api/settings/metering-points
router.get('/metering-points', async (req, res) => {
    try {
        const mps = await MeteringPoint.findAll({
            order: [['createdAt', 'DESC']]
        });

        res.json(mps);
    } catch (error) {
        logger.error('Error fetching metering points:', error);
        res.status(500).json({ error: 'Failed to fetch metering points' });
    }
});

// POST /api/settings/metering-points
router.post('/metering-points', [
    body('meteringPointId')
        .notEmpty().withMessage('Metering Point ID is required')
        .isLength({ min: 18, max: 18 }).withMessage('Metering Point ID must be exactly 18 digits')
        .isNumeric().withMessage('Metering Point ID must contain only digits'),
    body('name').optional().isString().trim(),
    validate
], async (req, res) => {
    try {
        const { name, meteringPointId } = req.body;

        const newMp = await MeteringPoint.create({
            name: name || 'My Meter',
            meteringPointId: meteringPointId.trim()
        });

        res.status(201).json(newMp);
    } catch (error) {
        logger.error('Error creating metering point:', error);
        res.status(500).json({ error: 'Failed to create metering point' });
    }
});

// DELETE /api/settings/metering-points/:id
router.delete('/metering-points/:id', [
    param('id').isInt().withMessage('ID must be an integer'),
    validate
], async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await MeteringPoint.destroy({
            where: { id }
        });

        if (deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ error: 'Metering point not found' });
        }
    } catch (error) {
        logger.error('Error deleting metering point:', error);
        res.status(500).json({ error: 'Failed to delete metering point' });
    }
});

module.exports = router;
