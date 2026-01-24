const logger = require('../utils/logger');
const { Property, MeteringPoint } = require('../models');

/**
 * SyncService - Orchestrates automated synchronization of electricity consumption data
 * from Eloverblik API to the local PostgreSQL database
 */
class SyncService {
    /**
     * @param {Object} eloverblikService - Service for interacting with Eloverblik API
     * @param {Object} sequelize - Sequelize database instance
     * @param {Object} logger - Winston logger instance
     */
    constructor(eloverblikService, sequelize, loggerInstance) {
        this.eloverblikService = eloverblikService;
        this.sequelize = sequelize;
        this.logger = loggerInstance || logger;
    }

    /**
     * Calculate date range for syncing based on daysBack parameter
     */
    calculateDateRange(daysBack = 1) {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - 2); // Default to 2 days ago for data availability

        const dateFrom = new Date(targetDate);
        dateFrom.setDate(targetDate.getDate() - (daysBack - 1)); // Adjust start date based on daysBack

        const dateTo = new Date(targetDate);

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        return {
            dateFrom: formatDate(dateFrom),
            dateTo: formatDate(dateTo)
        };
    }

    /**
     * Get the last synced timestamp for a metering point
     */
    async getLastSyncedDate(meteringPointId) {
        const result = await this.sequelize.query(
            `SELECT MAX(timestamp) as last_timestamp 
             FROM consumption_data 
             WHERE metering_point_id = $1 AND aggregation_level = 'Hour'`,
            {
                bind: [meteringPointId],
                type: this.sequelize.QueryTypes.SELECT
            }
        );

        if (result && result[0] && result[0].last_timestamp) {
            return new Date(result[0].last_timestamp);
        }
        return null;
    }

    /**
     * Main orchestration method for syncing consumption data for a property
     * @param {Object} options - Sync options
     * @param {number} options.propertyId - ID of the property to sync
     * @param {string} options.dateFrom - Start date (YYYY-MM-DD)
     * @param {string} options.dateTo - End date (YYYY-MM-DD)
     * @returns {Promise<Object>} Summary of sync results
     */
    async syncPropertyConsumption(options = {}) {
        let { propertyId, dateFrom, dateTo } = options;

        try {
            // 1. Fetch Property and Metering Points
            const property = propertyId
                ? await Property.findByPk(propertyId, { include: ['meteringPoints'] })
                : await Property.findOne({ include: ['meteringPoints'] });

            if (!property) {
                return { success: false, error: 'Property not found' };
            }

            if (!property.refresh_token) {
                return { success: false, error: 'No refresh token configured for property' };
            }

            const meteringPoints = property.meteringPoints || [];
            if (meteringPoints.length === 0) {
                this.logger.warn('No metering points configured for property', { propertyId: property.id });
                return { success: true, message: 'No metering points to sync', recordsSynced: 0 };
            }

            // 2. Resolve Date Range
            if (!dateFrom || !dateTo) {
                const daysBack = options.daysBack || parseInt(process.env.SYNC_DAYS_BACK || '1');
                const range = this.calculateDateRange(daysBack);
                dateFrom = range.dateFrom;
                dateTo = range.dateTo;
            }

            this.logger.info(`Starting sync for property: ${property.name}`, {
                propertyId: property.id,
                meteringPointCount: meteringPoints.length,
                dateFrom,
                dateTo
            });

            // 3. Sync each metering point
            const results = [];
            for (const mp of meteringPoints) {
                // Determine effective date range for this metering point
                let effectiveDateFrom = dateFrom;
                let effectiveDateTo = dateTo;

                if (!effectiveDateFrom || !effectiveDateTo) {
                    const lastSynced = await this.getLastSyncedDate(mp.meteringPointId);

                    const today = new Date();
                    const availableUntil = new Date(today);
                    availableUntil.setDate(today.getDate() - 2); // Eloverblik data availability buffer

                    if (lastSynced) {
                        const nextSyncDate = new Date(lastSynced);
                        nextSyncDate.setDate(nextSyncDate.getDate() + 1);

                        // If we are already up to date (next sync date is after available date), skip
                        if (nextSyncDate > availableUntil) {
                            this.logger.info(`Metering point ${mp.meteringPointId} is up to date. Last synced: ${lastSynced.toISOString().split('T')[0]}`);
                            results.push({
                                meteringPointId: mp.meteringPointId,
                                success: true,
                                message: 'Already up to date',
                                recordsSynced: 0
                            });
                            continue;
                        }

                        // Sync from the day after last sync up to "available until"
                        effectiveDateFrom = nextSyncDate.toISOString().split('T')[0];
                        effectiveDateTo = availableUntil.toISOString().split('T')[0];
                    } else {
                        // No data yet, fall back to default window
                        const daysBack = options.daysBack || parseInt(process.env.SYNC_DAYS_BACK || '1');
                        const range = this.calculateDateRange(daysBack);
                        effectiveDateFrom = range.dateFrom;
                        effectiveDateTo = range.dateTo;
                    }
                }

                this.logger.info(`Syncing metering point ${mp.meteringPointId}`, {
                    dateFrom: effectiveDateFrom,
                    dateTo: effectiveDateTo
                });

                const result = await this.syncMeteringPoint(property.refresh_token, mp.meteringPointId, effectiveDateFrom, effectiveDateTo);
                results.push({
                    meteringPointId: mp.meteringPointId,
                    ...result
                });
            }

            const totalSynced = results.reduce((sum, r) => sum + (r.recordsSynced || 0), 0);
            const errors = results.filter(r => !r.success);

            return {
                success: errors.length === 0,
                propertyId: property.id,
                projectName: property.name,
                totalRecordsSynced: totalSynced,
                details: results,
                errorCount: errors.length
            };

        } catch (error) {
            this.logger.error('Unexpected error during property sync', { error: error.message, stack: error.stack });
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync a single metering point
     */
    async syncMeteringPoint(refreshToken, meteringPointId, dateFrom, dateTo) {
        let logId = null;
        try {
            logId = await this.createSyncLog({
                meteringPointId,
                syncType: 'timeseries',
                dateFrom,
                dateTo,
                aggregationLevel: 'Hour',
                status: 'in_progress'
            });

            const apiResponse = await this.eloverblikService.getConsumptionData(
                refreshToken,
                meteringPointId,
                dateFrom,
                dateTo
            );

            const records = this.parseConsumptionData(apiResponse, meteringPointId);
            const recordsStored = await this.storeConsumptionData(records);

            await this.updateSyncLog(logId, {
                status: 'success',
                recordsSynced: recordsStored
            });

            return { success: true, recordsSynced: recordsStored, logId };

        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            this.logger.error(`Failed to sync metering point: ${meteringPointId}`, { error: errorMsg });

            if (logId) {
                await this.updateSyncLog(logId, {
                    status: 'error',
                    errorMessage: errorMsg
                });
            }

            return { success: false, error: errorMsg, logId };
        }
    }

    // Helper methods (parse, store, log) remain largely same but moved to class members properly
    parseConsumptionData(apiResponse, meteringPointId) {
        const records = [];
        const marketDocument = apiResponse.result?.[0];
        if (!marketDocument) return records;

        const timeSeries = marketDocument.MyEnergyData_MarketDocument?.TimeSeries || [];
        timeSeries.forEach(series => {
            const measurementUnit = series.measurement_Unit?.name || 'kWh';
            (series.Period || []).forEach(period => {
                const periodStart = new Date(period.timeInterval?.start);
                const resolution = period.resolution;
                (period.Point || []).forEach(point => {
                    const position = parseInt(point.position) - 1;
                    const timestamp = new Date(periodStart);
                    if (resolution === 'PT1H') timestamp.setHours(timestamp.getHours() + position);

                    records.push({
                        metering_point_id: meteringPointId,
                        timestamp,
                        aggregation_level: 'Hour',
                        quantity: parseFloat(point['out_Quantity.quantity'] || 0),
                        quality: point['out_Quantity.quality'] || 'OK',
                        measurement_unit: measurementUnit
                    });
                });
            });
        });
        return records;
    }

    async storeConsumptionData(records) {
        if (!records.length) return 0;

        // Lookup metering_point_pk for each record if not present (optimization: do this in bulk before)
        // For now, assuming records come from syncMeteringPoint where we can pass the PK.
        // Actually, let's modify the flow to pass the PK down.
        // But since we can't easily change the method signature without changing the whole chain,
        // let's do a subquery or join? No, let's rely on the fact that we can get the PK.

        // WAIT: The records array does not have the PK in it yet.
        // We need to fetch it.
        if (!records[0].metering_point_pk) {
            const mpId = records[0].metering_point_id;
            const mp = await MeteringPoint.findOne({ where: { metering_point_id: mpId } });
            if (mp) {
                records.forEach(r => r.metering_point_pk = mp.id);
            }
        }

        const query = `
            INSERT INTO consumption_data (metering_point_id, metering_point_pk, timestamp, aggregation_level, quantity, quality, measurement_unit)
            VALUES ${records.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
            ON CONFLICT (metering_point_id, timestamp, aggregation_level)
            DO UPDATE SET
                quantity = EXCLUDED.quantity,
                quality = EXCLUDED.quality,
                measurement_unit = EXCLUDED.measurement_unit,
                metering_point_pk = EXCLUDED.metering_point_pk
        `;
        const values = records.flatMap(r => [r.metering_point_id, r.metering_point_pk, r.timestamp, r.aggregation_level, r.quantity, r.quality, r.measurement_unit]);
        await this.sequelize.query(query, { bind: values, type: this.sequelize.QueryTypes.INSERT });
        return records.length;
    }

    async createSyncLog(params) {
        // Fetch the internal PK for the metering point
        let meteringPointPk = null;
        if (params.meteringPointId) {
            const mp = await MeteringPoint.findOne({ where: { metering_point_id: params.meteringPointId } });
            if (mp) meteringPointPk = mp.id;
        }

        const query = `
            INSERT INTO data_sync_log (metering_point_id, metering_point_pk, sync_type, date_from, date_to, aggregation_level, status, records_synced)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `;
        const result = await this.sequelize.query(query, {
            bind: [params.meteringPointId, meteringPointPk, params.syncType, params.dateFrom, params.dateTo, params.aggregationLevel, params.status, 0],
            type: this.sequelize.QueryTypes.INSERT
        });
        return result[0][0].id;
    }

    async updateSyncLog(logId, updates) {
        await this.sequelize.query(`
            UPDATE data_sync_log SET status = $1, records_synced = COALESCE($2, records_synced), error_message = $3 WHERE id = $4
        `, {
            bind: [updates.status, updates.recordsSynced || null, updates.errorMessage || null, logId],
            type: this.sequelize.QueryTypes.UPDATE
        });
    }
}

module.exports = SyncService;
