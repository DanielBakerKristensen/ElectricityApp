const logger = require('../utils/logger');
const OpenMeteoService = require('./open-meteo-service');

/**
 * WeatherSyncService - Orchestrates automated synchronization of weather data
 * from Open-Meteo API to the local PostgreSQL database
 */
class WeatherSyncService {
    /**
     * @param {Object} sequelize - Sequelize database instance
     * @param {Object} logger - Winston logger instance
     */
    constructor(sequelize, loggerInstance) {
        this.sequelize = sequelize;
        this.logger = loggerInstance || logger;
        this.openMeteoService = new OpenMeteoService();

        // Default location (Denmark coordinates)
        this.defaultLocation = {
            latitude: parseFloat(process.env.WEATHER_LATITUDE || '55.0444'),
            longitude: parseFloat(process.env.WEATHER_LONGITUDE || '9.4117')
        };
    }

    /**
     * Calculate date range for weather syncing (same pattern as energy sync)
     * @param {number} daysBack - Number of days to go back from today
     * @returns {Object} Object containing dateFrom and dateTo in YYYY-MM-DD format
     */
    calculateDateRange(daysBack = 1) {
        const today = new Date();

        // Sync the day before yesterday (2 days ago)
        // This ensures weather data is available and matches energy sync pattern
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - 2); // Day before yesterday

        // For weather API, we want the full day of data
        const dateFrom = new Date(targetDate);
        const dateTo = new Date(targetDate);

        // Format as YYYY-MM-DD
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
     * Main orchestration method for syncing weather data
     * @param {Object} options - Sync options
     * @param {number} options.daysBack - Number of days to sync (default: 1)
     * @param {string} options.dateFrom - Override start date (YYYY-MM-DD)
     * @param {string} options.dateTo - Override end date (YYYY-MM-DD)
     * @param {Object} options.location - Override location {latitude, longitude}
     * @returns {Promise<Object>} Sync result with success status, records synced, and log ID
     */
    async syncWeatherData(options = {}) {
        let dateFrom, dateTo, location, propertyId;

        // Determine property context
        propertyId = options.propertyId || null;
        let property = null;

        try {
            const { Property } = require('../models');
            if (propertyId) {
                property = await Property.findByPk(propertyId);
            } else {
                // Default to the first property if none specified
                property = await Property.findOne();
            }
        } catch (err) {
            this.logger.warn('Could not fetch property from database, falling back to defaults', { error: err.message });
        }

        if (property) {
            if (!property.weather_sync_enabled && !options.force) {
                this.logger.info(`Weather sync disabled for property: ${property.name}`);
                return { success: true, message: 'Sync disabled' };
            }
            location = {
                latitude: parseFloat(property.latitude),
                longitude: parseFloat(property.longitude)
            };
            propertyId = property.id;
        } else {
            location = options.location || this.defaultLocation;
        }

        if (options.dateFrom && options.dateTo) {
            dateFrom = options.dateFrom;
            dateTo = options.dateTo;
        } else {
            const daysBack = options.daysBack || parseInt(process.env.WEATHER_SYNC_DAYS_BACK || '1');
            const range = this.calculateDateRange(daysBack);
            dateFrom = range.dateFrom;
            dateTo = range.dateTo;
        }

        const locationId = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
        let logId = null;

        this.logger.info('Weather sync started', {
            location,
            locationId,
            dateFrom,
            dateTo,
            propertyId
        });

        try {
            // Check for existing 'in_progress' sync for this location and date range to prevent overlap
            const existingSync = await this.sequelize.query(`
                SELECT id FROM data_sync_log 
                WHERE (metering_point_id = $1 OR metering_point_id = $2)
                AND sync_type = 'weather_historical'
                AND status = 'in_progress'
                AND created_at > NOW() - INTERVAL '1 hour'
                LIMIT 1
            `, {
                bind: [locationId, propertyId ? propertyId.toString() : locationId],
                type: this.sequelize.QueryTypes.SELECT
            });

            if (existingSync.length > 0 && !options.force) {
                const msg = 'Another weather sync is already in progress for this location/property';
                this.logger.warn(msg, { locationId, propertyId });
                return { success: false, error: msg };
            }

            // Create initial sync log entry
            try {
                logId = await this.createWeatherSyncLog({
                    locationId: propertyId ? propertyId.toString() : locationId,
                    syncType: 'weather_historical',
                    dateFrom,
                    dateTo,
                    status: 'in_progress'
                });
            } catch (dbError) {
                this.logger.error('Critical: Cannot access database for weather sync log', {
                    error: dbError.message,
                    location,
                    dateFrom,
                    dateTo
                });
                throw new Error('Database connection failed');
            }

            // Fetch weather data from Open-Meteo API
            let apiResponse;
            try {
                apiResponse = await this.openMeteoService.fetchHistoricalWeather({
                    startDate: dateFrom,
                    endDate: dateTo,
                    latitude: location.latitude,
                    longitude: location.longitude
                });
            } catch (apiError) {
                // ... (rest of the error handling remains similar but updated to use logId)
                const errorMsg = apiError.code ? `Network error: ${apiError.code} - ${apiError.message}` : `Weather API error: ${apiError.message}`;
                this.logger.error(errorMsg, { location, dateFrom, dateTo, error: apiError.message });
                await this.updateWeatherSyncLog(logId, { status: 'error', errorMessage: errorMsg });
                return { success: false, error: errorMsg, logId };
            }

            // Transform and store
            const records = this.openMeteoService.transformWeatherData(apiResponse);
            // Ensure location_id in records matches what we expect
            records.forEach(r => { r.location_id = locationId; });

            const recordsStored = await this.storeWeatherData(records);

            // Update sync log with success
            await this.updateWeatherSyncLog(logId, {
                status: 'success',
                recordsSynced: recordsStored
            });

            this.logger.info('Weather sync completed successfully', {
                recordsSynced: recordsStored,
                dateFrom,
                dateTo,
                locationId,
                logId
            });

            return {
                success: true,
                recordsSynced: recordsStored,
                logId
            };

        } catch (error) {
            this.logger.error('Unexpected error during weather sync', {
                error: error.message,
                stack: error.stack,
                location,
                dateFrom,
                dateTo
            });

            if (logId) {
                await this.updateWeatherSyncLog(logId, {
                    status: 'error',
                    errorMessage: `Unexpected error: ${error.message}`
                });
            }

            return {
                success: false,
                error: error.message,
                logId
            };
        }
    }

    /**
     * Store weather data records in database with upsert logic
     * Uses individual INSERT statements for reliability
     * @param {Array} records - Array of weather records to store
     * @returns {Promise<number>} Count of records inserted/updated
     */
    async storeWeatherData(records) {
        if (!records || records.length === 0) {
            this.logger.warn('No weather records to store');
            return 0;
        }

        try {
            this.logger.info(`Bulk storing ${records.length} weather records...`);

            // Build bulk insert query with ON CONFLICT
            // Note: We use raw SQL here to ensure consistent ON CONFLICT behavior across Postgres
            const placeholders = [];
            const values = [];
            let paramIndex = 1;

            records.forEach(record => {
                placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                values.push(
                    record.location_id,
                    record.timestamp.toISOString(),
                    record.temperature_celsius ?? null,
                    record.humidity_percent ?? null,
                    record.precipitation_mm ?? null,
                    record.weather_condition ?? null,
                    record.weather_code ?? null,
                    record.wind_speed_kmh ?? null,
                    record.pressure_hpa ?? null,
                    'open-meteo'
                );
            });

            const query = `
                INSERT INTO weather_data (
                    location_id,
                    timestamp,
                    temperature_celsius,
                    humidity_percent,
                    precipitation_mm,
                    weather_condition,
                    weather_code,
                    wind_speed_kmh,
                    pressure_hpa,
                    data_source
                ) VALUES ${placeholders.join(', ')}
                ON CONFLICT (location_id, timestamp)
                DO UPDATE SET
                    temperature_celsius = EXCLUDED.temperature_celsius,
                    humidity_percent = EXCLUDED.humidity_percent,
                    precipitation_mm = EXCLUDED.precipitation_mm,
                    weather_condition = EXCLUDED.weather_condition,
                    weather_code = EXCLUDED.weather_code,
                    wind_speed_kmh = EXCLUDED.wind_speed_kmh,
                    pressure_hpa = EXCLUDED.pressure_hpa,
                    data_source = EXCLUDED.data_source,
                    updated_at = NOW()
            `;

            await this.sequelize.query(query, {
                bind: values,
                type: this.sequelize.QueryTypes.INSERT
            });

            this.logger.info('Successfully stored weather data (bulk)', {
                recordCount: records.length
            });

            return records.length;

        } catch (error) {
            this.logger.error('Error in bulk storing weather data', {
                error: error.message,
                recordCount: records.length
            });
            throw new Error(`Failed to store weather data: ${error.message}`);
        }
    }

    /**
     * Create initial weather sync log entry
     * @param {Object} params - Sync log parameters
     * @returns {Promise<number>} ID of the created sync log entry
     */
    async createWeatherSyncLog(params) {
        try {
            const query = `
                INSERT INTO data_sync_log (
                    metering_point_id,
                    sync_type,
                    date_from,
                    date_to,
                    aggregation_level,
                    status,
                    records_synced
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `;

            const values = [
                params.locationId, // Reuse metering_point_id field for location_id
                params.syncType,
                params.dateFrom,
                params.dateTo,
                'Hour', // Weather data is hourly
                params.status,
                0 // Initial records_synced count
            ];

            const result = await this.sequelize.query(query, {
                bind: values,
                type: this.sequelize.QueryTypes.INSERT
            });

            const logId = result[0][0].id;

            this.logger.debug('Created weather sync log entry', {
                logId,
                locationId: params.locationId,
                dateFrom: params.dateFrom,
                dateTo: params.dateTo
            });

            return logId;

        } catch (error) {
            this.logger.error('Error creating weather sync log', {
                error: error.message,
                params
            });
            throw new Error(`Failed to create weather sync log: ${error.message}`);
        }
    }

    /**
     * Update weather sync log entry with final status and results
     * @param {number} logId - ID of the sync log entry to update
     * @param {Object} updates - Updates to apply
     * @returns {Promise<void>}
     */
    async updateWeatherSyncLog(logId, updates) {
        try {
            const query = `
                UPDATE data_sync_log
                SET status = $1,
                    records_synced = COALESCE($2, records_synced),
                    error_message = $3
                WHERE id = $4
            `;

            const values = [
                updates.status,
                updates.recordsSynced || null,
                updates.errorMessage || null,
                logId
            ];

            await this.sequelize.query(query, {
                bind: values,
                type: this.sequelize.QueryTypes.UPDATE
            });

            this.logger.debug('Updated weather sync log entry', {
                logId,
                status: updates.status,
                recordsSynced: updates.recordsSynced
            });

        } catch (error) {
            this.logger.error('Error updating weather sync log', {
                error: error.message,
                logId,
                updates
            });
            // Don't throw here - we don't want to fail the sync just because log update failed
        }
    }

    /**
     * Backfill historical weather data for a date range
     * @param {Object} options - Backfill options
     * @param {string} options.startDate - Start date (YYYY-MM-DD)
     * @param {string} options.endDate - End date (YYYY-MM-DD)
     * @param {Object} options.location - Location {latitude, longitude}
     * @returns {Promise<Object>} Backfill result
     */
    async backfillWeatherData(options) {
        const { startDate, endDate, location = this.defaultLocation } = options;

        this.logger.info('Starting weather data backfill', {
            startDate,
            endDate,
            location
        });

        // Get optimal batch date ranges (1 year per batch to avoid API limits)
        const dateRanges = this.openMeteoService.getBatchDateRanges(
            new Date(startDate),
            new Date(endDate),
            365 // 1 year per batch
        );

        let totalRecords = 0;
        const results = [];

        for (const range of dateRanges) {
            this.logger.info(`Processing weather backfill batch: ${range.startDate} to ${range.endDate}`);

            try {
                const result = await this.syncWeatherData({
                    dateFrom: range.startDate,
                    dateTo: range.endDate,
                    location
                });

                results.push(result);
                if (result.success) {
                    totalRecords += result.recordsSynced;
                }

                // Add delay between batches to be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                this.logger.error(`Error in weather backfill batch ${range.startDate} to ${range.endDate}:`, error);
                results.push({
                    success: false,
                    error: error.message,
                    dateFrom: range.startDate,
                    dateTo: range.endDate
                });
            }
        }

        this.logger.info('Weather data backfill completed', {
            totalBatches: dateRanges.length,
            totalRecords,
            successfulBatches: results.filter(r => r.success).length
        });

        return {
            success: results.some(r => r.success),
            totalRecords,
            batches: results.length,
            results
        };
    }
}

module.exports = WeatherSyncService;