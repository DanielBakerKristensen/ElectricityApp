const logger = require('../utils/logger');

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
        this.meteringPointId = process.env.ELOVERBLIK_METERING_POINTS;
    }

    /**
     * Calculate date range for syncing based on daysBack parameter
     * @param {number} daysBack - Number of days to go back from today
     * @returns {Object} Object containing dateFrom and dateTo in YYYY-MM-DD format
     * 
     * Note: Eloverblik API requires dateTo to be AFTER dateFrom (cannot be equal)
     * So if requesting 1 day of data, dateTo should be the day after dateFrom
     */
    calculateDateRange(daysBack = 1) {
        const today = new Date();
        
        // Sync the day before yesterday (2 days ago)
        // Eloverblik data is typically available 1-2 days after consumption
        // By syncing 2 days ago, we ensure the data is definitely available
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - 2); // Day before yesterday
        
        // For the API, dateFrom is the target date and dateTo is the next day
        // This gives us exactly one day of data
        const dateFrom = new Date(targetDate);
        const dateTo = new Date(targetDate);
        dateTo.setDate(targetDate.getDate() + 1); // Next day (API uses exclusive end date)
        
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
     * Main orchestration method for syncing consumption data
     * @param {Object} options - Sync options
     * @param {number} options.daysBack - Number of days to sync (default: 1)
     * @returns {Promise<Object>} Sync result with success status, records synced, and log ID
     */
    async syncConsumptionData(options = {}) {
        const daysBack = options.daysBack || parseInt(process.env.SYNC_DAYS_BACK || '1');
        const { dateFrom, dateTo } = this.calculateDateRange(daysBack);
        let logId = null;
        
        this.logger.info('Sync started', {
            meteringPointId: this.meteringPointId,
            dateFrom,
            dateTo,
            aggregationLevel: 'Hour'
        });

        try {
            // Create initial sync log entry
            try {
                logId = await this.createSyncLog({
                    meteringPointId: this.meteringPointId,
                    syncType: 'timeseries',
                    dateFrom,
                    dateTo,
                    aggregationLevel: 'Hour',
                    status: 'in_progress'
                });
            } catch (dbError) {
                // Log to file if database is unavailable
                this.logger.error('Critical: Cannot access database for sync log', {
                    error: dbError.message,
                    meteringPointId: this.meteringPointId,
                    dateFrom,
                    dateTo
                });
                throw new Error('Database connection failed');
            }

            // Fetch data from Eloverblik API with timeout handling
            let apiResponse;
            try {
                apiResponse = await this.eloverblikService.getConsumptionData(
                    this.meteringPointId,
                    dateFrom,
                    dateTo
                );
            } catch (apiError) {
                // Handle authentication errors (401/403)
                if (apiError.response?.status === 401 || apiError.response?.status === 403) {
                    const errorMsg = 'Authentication failed - invalid or expired token';
                    this.logger.error(errorMsg, {
                        status: apiError.response.status,
                        meteringPointId: this.meteringPointId,
                        dateFrom,
                        dateTo
                    });
                    
                    await this.updateSyncLog(logId, {
                        status: 'error',
                        errorMessage: errorMsg
                    });
                    
                    return {
                        success: false,
                        error: errorMsg,
                        logId
                    };
                }

                // Handle network timeouts and connection errors
                if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT' || apiError.code === 'ECONNREFUSED') {
                    const errorMsg = `Network error: ${apiError.code} - ${apiError.message}`;
                    this.logger.error(errorMsg, {
                        meteringPointId: this.meteringPointId,
                        dateFrom,
                        dateTo,
                        error: apiError.message
                    });
                    
                    await this.updateSyncLog(logId, {
                        status: 'error',
                        errorMessage: errorMsg
                    });
                    
                    return {
                        success: false,
                        error: errorMsg,
                        logId
                    };
                }

                // Handle rate limiting (429)
                if (apiError.response?.status === 429) {
                    const errorMsg = 'API rate limit exceeded';
                    this.logger.warn(errorMsg, {
                        meteringPointId: this.meteringPointId,
                        dateFrom,
                        dateTo
                    });
                    
                    await this.updateSyncLog(logId, {
                        status: 'error',
                        errorMessage: errorMsg
                    });
                    
                    return {
                        success: false,
                        error: errorMsg,
                        logId
                    };
                }

                // Generic API error
                const errorMsg = `API error: ${apiError.message}`;
                this.logger.error(errorMsg, {
                    meteringPointId: this.meteringPointId,
                    dateFrom,
                    dateTo,
                    error: apiError.response?.data || apiError.message
                });
                
                await this.updateSyncLog(logId, {
                    status: 'error',
                    errorMessage: errorMsg
                });
                
                return {
                    success: false,
                    error: errorMsg,
                    logId
                };
            }

            // Parse API response into database records
            let records;
            try {
                records = this.parseConsumptionData(apiResponse, this.meteringPointId);
                
                this.logger.info('Parsed consumption data', {
                    recordCount: records.length,
                    dateFrom,
                    dateTo
                });
            } catch (parseError) {
                const errorMsg = `Invalid API response format: ${parseError.message}`;
                this.logger.error(errorMsg, {
                    meteringPointId: this.meteringPointId,
                    dateFrom,
                    dateTo,
                    error: parseError.message
                });
                
                await this.updateSyncLog(logId, {
                    status: 'error',
                    errorMessage: errorMsg
                });
                
                return {
                    success: false,
                    error: errorMsg,
                    logId
                };
            }

            // Store records in database
            let recordsStored;
            try {
                recordsStored = await this.storeConsumptionData(records);
            } catch (dbError) {
                // Handle database connection failures and constraint violations
                const errorMsg = `Database error: ${dbError.message}`;
                this.logger.error(errorMsg, {
                    meteringPointId: this.meteringPointId,
                    dateFrom,
                    dateTo,
                    recordCount: records.length,
                    error: dbError.message
                });
                
                await this.updateSyncLog(logId, {
                    status: 'error',
                    errorMessage: errorMsg
                });
                
                return {
                    success: false,
                    error: errorMsg,
                    logId
                };
            }

            // Update sync log with success
            await this.updateSyncLog(logId, {
                status: 'success',
                recordsSynced: recordsStored
            });

            this.logger.info('Sync completed successfully', {
                recordsSynced: recordsStored,
                dateFrom,
                dateTo,
                logId
            });

            return {
                success: true,
                recordsSynced: recordsStored,
                logId
            };

        } catch (error) {
            // Catch-all for any unexpected errors
            this.logger.error('Unexpected error during sync', {
                error: error.message,
                stack: error.stack,
                meteringPointId: this.meteringPointId,
                dateFrom,
                dateTo
            });

            if (logId) {
                await this.updateSyncLog(logId, {
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
     * Parse Eloverblik API response into database record format
     * Handles nested structure: MyEnergyData_MarketDocument.TimeSeries.Period.Point
     * @param {Object} apiResponse - Raw API response from Eloverblik
     * @param {string} meteringPointId - Metering point identifier
     * @returns {Array} Array of consumption records ready for database insertion
     */
    parseConsumptionData(apiResponse, meteringPointId) {
        const records = [];

        try {
            // Navigate the nested API structure
            const marketDocument = apiResponse.result?.[0];
            if (!marketDocument) {
                this.logger.warn('No market document found in API response');
                return records;
            }

            const timeSeries = marketDocument.MyEnergyData_MarketDocument?.TimeSeries;
            if (!timeSeries || timeSeries.length === 0) {
                this.logger.warn('No time series data found in API response');
                return records;
            }

            // Process each time series
            timeSeries.forEach(series => {
                const measurementUnit = series.measurement_Unit?.name || 'kWh';
                const periods = series.Period || [];

                periods.forEach(period => {
                    const periodStart = new Date(period.timeInterval?.start);
                    const resolution = period.resolution; // e.g., "PT1H" for 1 hour
                    const points = period.Point || [];

                    points.forEach(point => {
                        // Calculate timestamp based on position
                        const position = parseInt(point.position) - 1; // Position is 1-indexed
                        const timestamp = new Date(periodStart);
                        
                        // Add hours based on position (assuming hourly resolution)
                        if (resolution === 'PT1H') {
                            timestamp.setHours(timestamp.getHours() + position);
                        }

                        records.push({
                            metering_point_id: meteringPointId,
                            timestamp: timestamp,
                            aggregation_level: 'Hour',
                            quantity: parseFloat(point.out_Quantity?.quantity || 0),
                            quality: point.out_Quantity?.quality || 'OK',
                            measurement_unit: measurementUnit
                        });
                    });
                });
            });

            this.logger.debug('Successfully parsed consumption data', {
                recordCount: records.length,
                meteringPointId
            });

        } catch (error) {
            this.logger.error('Error parsing consumption data', {
                error: error.message,
                meteringPointId
            });
            throw new Error(`Failed to parse consumption data: ${error.message}`);
        }

        return records;
    }

    /**
     * Store consumption data records in database with upsert logic
     * Uses ON CONFLICT to handle duplicate records (update existing)
     * @param {Array} records - Array of consumption records to store
     * @returns {Promise<number>} Count of records inserted/updated
     */
    async storeConsumptionData(records) {
        if (!records || records.length === 0) {
            this.logger.warn('No records to store');
            return 0;
        }

        try {
            // Use raw SQL query for efficient bulk upsert with ON CONFLICT
            const query = `
                INSERT INTO consumption_data (
                    metering_point_id, 
                    timestamp, 
                    aggregation_level, 
                    quantity, 
                    quality, 
                    measurement_unit
                ) VALUES ${records.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(', ')}
                ON CONFLICT (metering_point_id, timestamp, aggregation_level)
                DO UPDATE SET
                    quantity = EXCLUDED.quantity,
                    quality = EXCLUDED.quality,
                    measurement_unit = EXCLUDED.measurement_unit
            `;

            // Flatten records into parameter array
            const values = records.flatMap(record => [
                record.metering_point_id,
                record.timestamp,
                record.aggregation_level,
                record.quantity,
                record.quality,
                record.measurement_unit
            ]);

            await this.sequelize.query(query, {
                bind: values,
                type: this.sequelize.QueryTypes.INSERT
            });

            this.logger.info('Successfully stored consumption data', {
                recordCount: records.length
            });

            return records.length;

        } catch (error) {
            this.logger.error('Error storing consumption data', {
                error: error.message,
                recordCount: records.length
            });
            throw new Error(`Failed to store consumption data: ${error.message}`);
        }
    }

    /**
     * Create initial sync log entry with status "in_progress"
     * @param {Object} params - Sync log parameters
     * @param {string} params.meteringPointId - Metering point identifier
     * @param {string} params.syncType - Type of sync (e.g., 'timeseries')
     * @param {string} params.dateFrom - Start date (YYYY-MM-DD)
     * @param {string} params.dateTo - End date (YYYY-MM-DD)
     * @param {string} params.aggregationLevel - Aggregation level (e.g., 'Hour')
     * @param {string} params.status - Initial status (e.g., 'in_progress')
     * @returns {Promise<number>} ID of the created sync log entry
     */
    async createSyncLog(params) {
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
                params.meteringPointId,
                params.syncType,
                params.dateFrom,
                params.dateTo,
                params.aggregationLevel,
                params.status,
                0 // Initial records_synced count
            ];

            const result = await this.sequelize.query(query, {
                bind: values,
                type: this.sequelize.QueryTypes.INSERT
            });

            const logId = result[0][0].id;

            this.logger.debug('Created sync log entry', {
                logId,
                meteringPointId: params.meteringPointId,
                dateFrom: params.dateFrom,
                dateTo: params.dateTo
            });

            return logId;

        } catch (error) {
            this.logger.error('Error creating sync log', {
                error: error.message,
                params
            });
            throw new Error(`Failed to create sync log: ${error.message}`);
        }
    }

    /**
     * Update sync log entry with final status and results
     * @param {number} logId - ID of the sync log entry to update
     * @param {Object} updates - Updates to apply
     * @param {string} updates.status - Final status ('success' or 'error')
     * @param {number} updates.recordsSynced - Number of records synced (optional)
     * @param {string} updates.errorMessage - Error message if status is 'error' (optional)
     * @returns {Promise<void>}
     */
    async updateSyncLog(logId, updates) {
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

            this.logger.debug('Updated sync log entry', {
                logId,
                status: updates.status,
                recordsSynced: updates.recordsSynced
            });

        } catch (error) {
            this.logger.error('Error updating sync log', {
                error: error.message,
                logId,
                updates
            });
            // Don't throw here - we don't want to fail the sync just because log update failed
        }
    }
}

module.exports = SyncService;
