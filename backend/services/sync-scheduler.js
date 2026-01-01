const cron = require('node-cron');
const logger = require('../utils/logger');
const { Property } = require('../models');

/**
 * SyncScheduler - Manages independent cron jobs for different sync types
 */
class SyncScheduler {
    constructor(syncService, weatherSyncService, loggerInstance) {
        this.syncService = syncService;
        this.weatherSyncService = weatherSyncService;
        this.logger = loggerInstance || logger;

        this.cronJobs = { energy: null, weather: null };

        this.enabled = process.env.SYNC_ENABLED !== 'false';
        this.energySchedule = process.env.SYNC_SCHEDULE || '0 14 * * *';
        this.daysBack = parseInt(process.env.SYNC_DAYS_BACK || '1');

        this.weatherEnabled = process.env.WEATHER_SYNC_ENABLED !== 'false';
        this.weatherSchedule = process.env.WEATHER_SYNC_SCHEDULE || '5 14 * * *';
        this.weatherDaysBack = parseInt(process.env.WEATHER_SYNC_DAYS_BACK || '1');

        this.validateCronExpressions();
    }

    validateCronExpressions() {
        if (!cron.validate(this.energySchedule)) {
            this.logger.error('Invalid energy sync cron expression', { schedule: this.energySchedule });
            this.enabled = false;
        }
        if (this.weatherEnabled && !cron.validate(this.weatherSchedule)) {
            this.logger.error('Invalid weather sync cron expression', { schedule: this.weatherSchedule });
            this.weatherEnabled = false;
        }
    }

    start() {
        if (!this.enabled) return;
        this.startEnergySync();
        if (this.weatherEnabled && this.weatherSyncService) this.startWeatherSync();
    }

    startEnergySync() {
        if (this.cronJobs.energy) return;
        this.cronJobs.energy = cron.schedule(this.energySchedule, () => this.executeEnergySync(), {
            scheduled: true, timezone: 'Europe/Copenhagen'
        });
    }

    startWeatherSync() {
        if (this.cronJobs.weather) return;
        this.cronJobs.weather = cron.schedule(this.weatherSchedule, () => this.executeWeatherSync(), {
            scheduled: true, timezone: 'Europe/Copenhagen'
        });
    }

    async executeEnergySync() {
        this.logger.info('Scheduled energy sync started');
        try {
            const properties = await Property.findAll();
            for (const property of properties) {
                await this.syncService.syncPropertyConsumption({
                    propertyId: property.id,
                    daysBack: this.daysBack
                });
            }
        } catch (error) {
            this.logger.error('Error during scheduled energy sync', { error: error.message });
        }
    }

    async executeWeatherSync() {
        this.logger.info('Scheduled weather sync started');
        try {
            const properties = await Property.findAll({ where: { weather_sync_enabled: true } });
            for (const property of properties) {
                await this.weatherSyncService.syncWeatherData({
                    propertyId: property.id,
                    daysBack: this.weatherDaysBack
                });
            }
        } catch (error) {
            this.logger.error('Error during scheduled weather sync', { error: error.message });
        }
    }

    async triggerManualSync(options = {}) {
        const syncType = options.type || 'both';
        const results = { energy: null, weather: null, success: true, totalRecords: 0 };

        try {
            if (syncType === 'energy' || syncType === 'both') {
                results.energy = await this.syncService.syncPropertyConsumption({
                    propertyId: options.propertyId,
                    daysBack: options.daysBack || this.daysBack,
                    dateFrom: options.dateFrom,
                    dateTo: options.dateTo
                });
                if (results.energy.success) results.totalRecords += (results.energy.totalRecordsSynced || 0);
            }

            if (syncType === 'weather' || syncType === 'both') {
                results.weather = await this.weatherSyncService.syncWeatherData({
                    propertyId: options.propertyId,
                    daysBack: options.weatherDaysBack || this.weatherDaysBack,
                    dateFrom: options.dateFrom,
                    dateTo: options.dateTo
                });
                if (results.weather.success) results.totalRecords += (results.weather.recordsSynced || 0);
            }

            results.success = (results.energy ? results.energy.success : true) &&
                (results.weather ? results.weather.success : true);
            return results;
        } catch (error) {
            this.logger.error('Manual sync failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    stop() {
        if (this.cronJobs.energy) this.cronJobs.energy.stop();
        if (this.cronJobs.weather) this.cronJobs.weather.stop();
    }
}

module.exports = SyncScheduler;
