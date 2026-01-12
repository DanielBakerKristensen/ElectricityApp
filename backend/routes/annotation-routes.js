const express = require('express');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

const router = express.Router();

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
        const { meteringPointId } = req.query;

        if (!meteringPointId) {
            return res.status(400).json({
                success: false,
                error: 'meteringPointId parameter is required'
            });
        }

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
        const { meteringPointId, title, description, category, date, tags } = req.body;

        if (!meteringPointId || !title || !date) {
            return res.status(400).json({
                success: false,
                error: 'meteringPointId, title, and date are required'
            });
        }

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
