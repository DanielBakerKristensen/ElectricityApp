const express = require('express');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');
const { MeteringPoint, User } = require('../models');
const { userAuth } = require('../utils/auth-middleware');

const router = express.Router();

// Apply userAuth to all annotation routes
router.use(userAuth);

/**
 * Helper function to resolve database metering point ID to actual metering point string
 * Also validates user ownership of the metering point
 * @param {number|string} dbMpId - Database primary key of metering point
 * @param {Object} user - User object from auth middleware
 * @returns {Promise<{success: boolean, meteringPointId?: string, error?: string}>}
 */
async function resolveMeteringPointId(dbMpId, user) {
    if (!dbMpId) {
        return { success: false, error: 'meteringPointId parameter is required' };
    }

    const mp = await MeteringPoint.findByPk(dbMpId);
    if (!mp) {
        return { success: false, error: 'Metering point not found' };
    }

    // Validate user ownership
    const userRecord = await User.findByPk(user.id);
    const hasProperty = await userRecord.hasProperty(mp.property_id);
    if (!hasProperty) {
        return { success: false, error: 'Metering point not found' };
    }

    return { success: true, meteringPointId: mp.meteringPointId.trim() };
}

/**
 * @swagger
 * /api/annotations:
 *   get:
 *     summary: Get annotations for a metering point
 *     description: Retrieve all annotations for a specific metering point
 *     tags:
 *       - Annotations
 *     parameters:
 *       - in: query
 *         name: meteringPointId
 *         required: true
 *         schema:
 *           type: string
 *         description: Metering point ID
 *     responses:
 *       200:
 *         description: List of annotations
 */
router.get('/', async (req, res) => {
    try {
        const { meteringPointId: dbMpId } = req.query;

        // Resolve database ID to actual metering point string with ownership validation
        const resolution = await resolveMeteringPointId(dbMpId, req.user);
        if (!resolution.success) {
            return res.status(400).json({
                success: false,
                error: resolution.error
            });
        }
        const meteringPointId = resolution.meteringPointId;

        logger.info('Fetching annotations', { meteringPointId });

        const query = `
            SELECT 
                id,
                metering_point_id,
                start_timestamp as date,
                annotation_type as category,
                title,
                description,
                tags,
                created_at,
                updated_at
            FROM consumption_annotations
            WHERE metering_point_id = $1
            ORDER BY start_timestamp DESC
        `;

        const annotations = await sequelize.query(query, {
            bind: [meteringPointId],
            type: sequelize.QueryTypes.SELECT
        });

        res.json({
            success: true,
            annotations: annotations.map(a => ({
                id: a.id,
                meteringPointId: a.metering_point_id,
                date: a.date ? a.date.toISOString().split('T')[0] : null,
                category: a.category || 'general',
                title: a.title,
                description: a.description,
                tags: a.tags || [],
                createdAt: a.created_at,
                updatedAt: a.updated_at
            }))
        });

    } catch (error) {
        logger.error('Error fetching annotations', {
            error: error.message,
            query: req.query
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch annotations',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/annotations:
 *   post:
 *     summary: Create a new annotation
 *     description: Create a new annotation for a metering point
 *     tags:
 *       - Annotations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - meteringPointId
 *               - title
 *               - date
 *             properties:
 *               meteringPointId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Annotation created successfully
 */
router.post('/', async (req, res) => {
    try {
        const { meteringPointId: dbMpId, title, description, category, date, tags } = req.body;

        if (!dbMpId || !title || !date) {
            return res.status(400).json({
                success: false,
                error: 'meteringPointId, title, and date are required'
            });
        }

        // Resolve database ID to actual metering point string with ownership validation
        const resolution = await resolveMeteringPointId(dbMpId, req.user);
        if (!resolution.success) {
            return res.status(400).json({
                success: false,
                error: resolution.error
            });
        }
        const meteringPointId = resolution.meteringPointId;

        logger.info('Creating annotation', {
            meteringPointId,
            title,
            date
        });

        const query = `
            INSERT INTO consumption_annotations (
                metering_point_id,
                start_timestamp,
                annotation_type,
                title,
                description,
                tags
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, metering_point_id, start_timestamp, annotation_type, title, description, tags, created_at
        `;

        const result = await sequelize.query(query, {
            bind: [
                meteringPointId,
                new Date(date),
                category || 'general',
                title,
                description || null,
                tags && tags.length > 0 ? tags : null
            ],
            type: sequelize.QueryTypes.INSERT
        });

        const annotation = result[0][0];

        res.status(201).json({
            success: true,
            annotation: {
                id: annotation.id,
                meteringPointId: annotation.metering_point_id,
                date: annotation.start_timestamp.toISOString().split('T')[0],
                category: annotation.annotation_type,
                title: annotation.title,
                description: annotation.description,
                tags: annotation.tags || [],
                createdAt: annotation.created_at
            }
        });

    } catch (error) {
        logger.error('Error creating annotation', {
            error: error.message,
            body: req.body
        });
        res.status(500).json({
            success: false,
            error: 'Failed to create annotation',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/annotations/{id}:
 *   put:
 *     summary: Update an annotation
 *     description: Update an existing annotation
 *     tags:
 *       - Annotations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Annotation updated successfully
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, date, tags } = req.body;

        // First, verify the annotation exists and user has ownership
        const existingQuery = `
            SELECT metering_point_id FROM consumption_annotations WHERE id = $1
        `;
        const existing = await sequelize.query(existingQuery, {
            bind: [id],
            type: sequelize.QueryTypes.SELECT
        });

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annotation not found'
            });
        }

        // Verify user owns this metering point by looking up the metering point config
        const mpConfig = await MeteringPoint.findOne({
            where: { meteringPointId: existing[0].metering_point_id }
        });

        if (mpConfig) {
            const userRecord = await User.findByPk(req.user.id);
            const hasProperty = await userRecord.hasProperty(mpConfig.property_id);
            if (!hasProperty) {
                return res.status(404).json({
                    success: false,
                    error: 'Annotation not found'
                });
            }
        }

        logger.info('Updating annotation', { id, title });

        const query = `
            UPDATE consumption_annotations
            SET 
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                annotation_type = COALESCE($3, annotation_type),
                start_timestamp = COALESCE($4, start_timestamp),
                tags = COALESCE($5, tags),
                updated_at = NOW()
            WHERE id = $6
            RETURNING id, metering_point_id, start_timestamp, annotation_type, title, description, tags, updated_at
        `;

        const result = await sequelize.query(query, {
            bind: [
                title || null,
                description || null,
                category || null,
                date ? new Date(date) : null,
                tags && tags.length > 0 ? tags : null,
                id
            ],
            type: sequelize.QueryTypes.UPDATE
        });

        if (result[1] === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annotation not found'
            });
        }

        const annotation = result[0][0];

        res.json({
            success: true,
            annotation: {
                id: annotation.id,
                meteringPointId: annotation.metering_point_id,
                date: annotation.start_timestamp.toISOString().split('T')[0],
                category: annotation.annotation_type,
                title: annotation.title,
                description: annotation.description,
                tags: annotation.tags || [],
                updatedAt: annotation.updated_at
            }
        });

    } catch (error) {
        logger.error('Error updating annotation', {
            error: error.message,
            params: req.params,
            body: req.body
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update annotation',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @swagger
 * /api/annotations/{id}:
 *   delete:
 *     summary: Delete an annotation
 *     description: Delete an existing annotation
 *     tags:
 *       - Annotations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Annotation deleted successfully
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // First, verify the annotation exists and user has ownership
        const existingQuery = `
            SELECT metering_point_id FROM consumption_annotations WHERE id = $1
        `;
        const existing = await sequelize.query(existingQuery, {
            bind: [id],
            type: sequelize.QueryTypes.SELECT
        });

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annotation not found'
            });
        }

        // Verify user owns this metering point by looking up the metering point config
        const mpConfig = await MeteringPoint.findOne({
            where: { meteringPointId: existing[0].metering_point_id }
        });

        if (mpConfig) {
            const userRecord = await User.findByPk(req.user.id);
            const hasProperty = await userRecord.hasProperty(mpConfig.property_id);
            if (!hasProperty) {
                return res.status(404).json({
                    success: false,
                    error: 'Annotation not found'
                });
            }
        }

        logger.info('Deleting annotation', { id });

        const query = `
            DELETE FROM consumption_annotations
            WHERE id = $1
            RETURNING id
        `;

        const result = await sequelize.query(query, {
            bind: [id],
            type: sequelize.QueryTypes.DELETE
        });

        if (result[1] === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annotation not found'
            });
        }

        res.json({
            success: true,
            message: 'Annotation deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting annotation', {
            error: error.message,
            params: req.params
        });
        res.status(500).json({
            success: false,
            error: 'Failed to delete annotation',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;
