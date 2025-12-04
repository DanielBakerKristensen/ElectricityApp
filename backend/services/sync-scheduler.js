const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * SyncScheduler - Manages the cron job that triggers daily synchronization
 * of electricity consumption data from Eloverblik API
 */
class SyncScheduler {
    /**
     * @param {Object} syncService - SyncService instance for performing data synchronization
     * @param {Object} loggerInstance - Winston logger instance (optional)
     */
    constructor(syncService, loggerInstance) {
        this.syncService = syncService;
        this.logger = loggerInstance || logger;
        this.cronJob = null;

        // Read configuration from environment variables
        this.enabled = process.env.SYNC_ENABLED !== 'false';
        this.schedule = process.env.SYNC_SCHEDULE || '0 14 * * *'; // Default: daily at 2 PM
        this.daysBack = parseInt(process.env.SYNC_DAYS_BACK || '1');

        // Validate cron expression format
        if (!cron.validate(this.schedule)) {
            this.logger.error('Invalid cron expression format', {
                schedule: this.schedule,
                error: 'Cron expression validation failed'
            });
            this.enabled = false; // Disable scheduler if cron expression is invalid
        }

        this.logger.info('SyncScheduler initialized', {
            enabled: this.enabled,
            schedule: this.schedule,
            daysBack: this.daysBack
        });
    }

    /**
     * Initialize and start the cron job scheduler
     * Registers the scheduled job to run at the configured time
     */
    start() {
        if (!this.enabled) {
            this.logger.info('Sync scheduler is disabled (SYNC_ENABLED=false or invalid cron expression)');
            return;
        }

        if (this.cronJob) {
            this.logger.warn('Sync scheduler is already running');
            return;
        }

        try {
            // Create and start the cron job
            this.cronJob = cron.schedule(this.schedule, async () => {
                await this.executeScheduledSync();
            }, {
                scheduled: true,
                timezone: 'Europe/Copenhagen' // Danish timezone
            });

            this.logger.info('Sync scheduler started successfully', {
                schedule: this.schedule,
                daysBack: this.daysBack,
                timezone: 'Europe/Copenhagen'
            });

        } catch (error) {
            this.logger.error('Failed to start sync scheduler', {
                error: error.message,
                schedule: this.schedule
            });
            throw error;
        }
    }

    /**
     * Stop the scheduler gracefully
     * Stops the cron job and cleans up resources
     */
    stop() {
        if (!this.cronJob) {
            this.logger.info('Sync scheduler is not running');
            return;
        }

        try {
            this.cronJob.stop();
            this.cronJob = null;

            this.logger.info('Sync scheduler stopped successfully');
        } catch (error) {
            this.logger.error('Error stopping sync scheduler', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Manually trigger a sync execution (for testing/admin purposes)
     * @returns {Promise<Object>} Sync result with success status, records synced, and log ID
     */
    async triggerManualSync(options = {}) {
        const daysBack = options.daysBack || this.daysBack;

        this.logger.info('Manual sync triggered', {
            daysBack,
            dateFrom: options.dateFrom,
            dateTo: options.dateTo
        });

        try {
            const result = await this.syncService.syncConsumptionData({
                daysBack,
                dateFrom: options.dateFrom,
                dateTo: options.dateTo
            });

            this.logger.info('Manual sync completed', {
                success: result.success,
                recordsSynced: result.recordsSynced,
                logId: result.logId
            });

            return result;

        } catch (error) {
            this.logger.error('Manual sync failed', {
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message,
                recordsSynced: 0
            };
        }
    }

    /**
     * Execute the scheduled sync job
     * Called by the cron scheduler at the configured time
     * Handles errors without crashing the scheduler
     * @private
     */
    async executeScheduledSync() {
        this.logger.info('Scheduled sync execution started', {
            schedule: this.schedule,
            daysBack: this.daysBack,
            timestamp: new Date().toISOString()
        });

        try {
            const result = await this.syncService.syncConsumptionData({
                daysBack: this.daysBack
            });

            if (result.success) {
                this.logger.info('Scheduled sync completed successfully', {
                    recordsSynced: result.recordsSynced,
                    logId: result.logId
                });
            } else {
                this.logger.error('Scheduled sync failed', {
                    error: result.error,
                    logId: result.logId
                });
            }

        } catch (error) {
            // Catch any unexpected errors to prevent scheduler from crashing
            this.logger.error('Unexpected error during scheduled sync execution', {
                error: error.message,
                stack: error.stack,
                daysBack: this.daysBack
            });
        }
    }
}

module.exports = SyncScheduler;
