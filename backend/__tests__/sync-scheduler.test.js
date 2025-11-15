const SyncScheduler = require('../services/sync-scheduler');
const cron = require('node-cron');

// Mock node-cron
jest.mock('node-cron');

describe('SyncScheduler', () => {
  let syncScheduler;
  let mockSyncService;
  let mockLogger;
  let mockCronJob;

  beforeEach(() => {
    // Mock sync service
    mockSyncService = {
      syncConsumptionData: jest.fn()
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Mock cron job
    mockCronJob = {
      stop: jest.fn()
    };

    // Mock cron.schedule to return mock job
    cron.schedule.mockReturnValue(mockCronJob);
    cron.validate.mockReturnValue(true);

    // Set default environment variables
    process.env.SYNC_ENABLED = 'true';
    process.env.SYNC_SCHEDULE = '0 14 * * *';
    process.env.SYNC_DAYS_BACK = '1';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.SYNC_ENABLED;
    delete process.env.SYNC_SCHEDULE;
    delete process.env.SYNC_DAYS_BACK;
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);

      expect(syncScheduler.enabled).toBe(true);
      expect(syncScheduler.schedule).toBe('0 14 * * *');
      expect(syncScheduler.daysBack).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith('SyncScheduler initialized', {
        enabled: true,
        schedule: '0 14 * * *',
        daysBack: 1
      });
    });

    test('should initialize with custom schedule from environment', () => {
      process.env.SYNC_SCHEDULE = '0 */6 * * *';
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);

      expect(syncScheduler.schedule).toBe('0 */6 * * *');
    });

    test('should initialize with custom daysBack from environment', () => {
      process.env.SYNC_DAYS_BACK = '7';
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);

      expect(syncScheduler.daysBack).toBe(7);
    });

    test('should disable scheduler when SYNC_ENABLED is false', () => {
      process.env.SYNC_ENABLED = 'false';
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);

      expect(syncScheduler.enabled).toBe(false);
    });

    test('should disable scheduler when cron expression is invalid', () => {
      cron.validate.mockReturnValue(false);
      process.env.SYNC_SCHEDULE = 'invalid cron';
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);

      expect(syncScheduler.enabled).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Invalid cron expression format', {
        schedule: 'invalid cron',
        error: 'Cron expression validation failed'
      });
    });
  });

  describe('start()', () => {
    test('should start scheduler successfully', () => {
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      syncScheduler.start();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 14 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: 'Europe/Copenhagen'
        }
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Sync scheduler started successfully', {
        schedule: '0 14 * * *',
        daysBack: 1,
        timezone: 'Europe/Copenhagen'
      });
    });

    test('should not start when scheduler is disabled', () => {
      process.env.SYNC_ENABLED = 'false';
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      
      syncScheduler.start();

      expect(cron.schedule).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sync scheduler is disabled (SYNC_ENABLED=false or invalid cron expression)'
      );
    });

    test('should warn if scheduler is already running', () => {
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      syncScheduler.start();
      
      jest.clearAllMocks();
      syncScheduler.start();

      expect(cron.schedule).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Sync scheduler is already running');
    });
  });

  describe('stop()', () => {
    test('should stop scheduler successfully', () => {
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      syncScheduler.start();
      
      jest.clearAllMocks();
      syncScheduler.stop();

      expect(mockCronJob.stop).toHaveBeenCalled();
      expect(syncScheduler.cronJob).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith('Sync scheduler stopped successfully');
    });

    test('should handle stop when scheduler is not running', () => {
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      
      syncScheduler.stop();

      expect(mockCronJob.stop).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Sync scheduler is not running');
    });
  });

  describe('triggerManualSync()', () => {
    test('should trigger manual sync successfully', async () => {
      const mockResult = {
        success: true,
        recordsSynced: 24,
        logId: 1
      };
      mockSyncService.syncConsumptionData.mockResolvedValue(mockResult);
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      const result = await syncScheduler.triggerManualSync();

      expect(mockSyncService.syncConsumptionData).toHaveBeenCalledWith({
        daysBack: 1
      });
      expect(result).toEqual(mockResult);
      expect(mockLogger.info).toHaveBeenCalledWith('Manual sync triggered', {
        daysBack: 1
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Manual sync completed', {
        success: true,
        recordsSynced: 24,
        logId: 1
      });
    });

    test('should handle manual sync errors', async () => {
      const error = new Error('Sync failed');
      mockSyncService.syncConsumptionData.mockRejectedValue(error);
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      const result = await syncScheduler.triggerManualSync();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sync failed');
      expect(result.recordsSynced).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith('Manual sync failed', {
        error: 'Sync failed',
        stack: expect.any(String)
      });
    });
  });

  describe('executeScheduledSync()', () => {
    test('should execute scheduled sync successfully', async () => {
      const mockResult = {
        success: true,
        recordsSynced: 24,
        logId: 1
      };
      mockSyncService.syncConsumptionData.mockResolvedValue(mockResult);
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      await syncScheduler.executeScheduledSync();

      expect(mockSyncService.syncConsumptionData).toHaveBeenCalledWith({
        daysBack: 1
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled sync execution started', {
        schedule: '0 14 * * *',
        daysBack: 1,
        timestamp: expect.any(String)
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled sync completed successfully', {
        recordsSynced: 24,
        logId: 1
      });
    });

    test('should handle scheduled sync failures', async () => {
      const mockResult = {
        success: false,
        error: 'API error',
        logId: 1
      };
      mockSyncService.syncConsumptionData.mockResolvedValue(mockResult);
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      await syncScheduler.executeScheduledSync();

      expect(mockLogger.error).toHaveBeenCalledWith('Scheduled sync failed', {
        error: 'API error',
        logId: 1
      });
    });

    test('should handle unexpected errors without crashing', async () => {
      const error = new Error('Unexpected error');
      mockSyncService.syncConsumptionData.mockRejectedValue(error);
      
      syncScheduler = new SyncScheduler(mockSyncService, mockLogger);
      
      // Should not throw
      await expect(syncScheduler.executeScheduledSync()).resolves.not.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error during scheduled sync execution',
        {
          error: 'Unexpected error',
          stack: expect.any(String),
          daysBack: 1
        }
      );
    });
  });
});
