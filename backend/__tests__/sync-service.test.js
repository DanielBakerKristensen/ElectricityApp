const SyncService = require('../services/sync-service');

describe('SyncService', () => {
  let syncService;
  let mockEloverblikService;
  let mockSequelize;
  let mockLogger;

  beforeEach(() => {
    // Mock Eloverblik service
    mockEloverblikService = {
      getConsumptionData: jest.fn()
    };

    // Mock Sequelize
    mockSequelize = {
      query: jest.fn(),
      QueryTypes: {
        INSERT: 'INSERT',
        UPDATE: 'UPDATE'
      }
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Set environment variable for metering point
    process.env.ELOVERBLIK_METERING_POINTS = '571313174012345678';
    process.env.SYNC_DAYS_BACK = '1';

    syncService = new SyncService(mockEloverblikService, mockSequelize, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDateRange', () => {
    test('should calculate correct date range for 1 day back', () => {
      const result = syncService.calculateDateRange(1);
      
      expect(result).toHaveProperty('dateFrom');
      expect(result).toHaveProperty('dateTo');
      expect(result.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.dateFrom).toBe(result.dateTo); // Same day for 1 day back
    });

    test('should calculate correct date range for 7 days back', () => {
      const result = syncService.calculateDateRange(7);
      
      const dateFrom = new Date(result.dateFrom);
      const dateTo = new Date(result.dateTo);
      const daysDiff = Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24));
      
      expect(daysDiff).toBe(6); // 7 days means 6 days difference
    });

    test('should use default of 1 day when no parameter provided', () => {
      const result = syncService.calculateDateRange();
      
      expect(result.dateFrom).toBe(result.dateTo);
    });
  });

  describe('parseConsumptionData', () => {
    test('should parse valid API response correctly', () => {
      const mockApiResponse = {
        result: [{
          MyEnergyData_MarketDocument: {
            TimeSeries: [{
              measurement_Unit: { name: 'kWh' },
              Period: [{
                timeInterval: { start: '2024-01-15T00:00:00Z' },
                resolution: 'PT1H',
                Point: [
                  { position: '1', out_Quantity: { quantity: '1.234', quality: 'OK' } },
                  { position: '2', out_Quantity: { quantity: '2.345', quality: 'OK' } }
                ]
              }]
            }]
          }
        }]
      };

      const meteringPointId = '571313174012345678';
      const records = syncService.parseConsumptionData(mockApiResponse, meteringPointId);

      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({
        metering_point_id: meteringPointId,
        aggregation_level: 'Hour',
        quantity: 1.234,
        quality: 'OK',
        measurement_unit: 'kWh'
      });
      expect(records[0].timestamp).toBeInstanceOf(Date);
    });

    test('should return empty array when no market document found', () => {
      const mockApiResponse = { result: [] };
      const meteringPointId = '571313174012345678';
      
      const records = syncService.parseConsumptionData(mockApiResponse, meteringPointId);
      
      expect(records).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('No market document found in API response');
    });

    test('should return empty array when no time series data found', () => {
      const mockApiResponse = {
        result: [{
          MyEnergyData_MarketDocument: {
            TimeSeries: []
          }
        }]
      };
      const meteringPointId = '571313174012345678';
      
      const records = syncService.parseConsumptionData(mockApiResponse, meteringPointId);
      
      expect(records).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('No time series data found in API response');
    });
  });

  describe('storeConsumptionData', () => {
    test('should store records successfully', async () => {
      const mockRecords = [
        {
          metering_point_id: '571313174012345678',
          timestamp: new Date('2024-01-15T00:00:00Z'),
          aggregation_level: 'Hour',
          quantity: 1.234,
          quality: 'OK',
          measurement_unit: 'kWh'
        }
      ];

      mockSequelize.query.mockResolvedValue([]);

      const count = await syncService.storeConsumptionData(mockRecords);

      expect(count).toBe(1);
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully stored consumption data', {
        recordCount: 1
      });
    });

    test('should return 0 when no records provided', async () => {
      const count = await syncService.storeConsumptionData([]);

      expect(count).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('No records to store');
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      const mockRecords = [
        {
          metering_point_id: '571313174012345678',
          timestamp: new Date('2024-01-15T00:00:00Z'),
          aggregation_level: 'Hour',
          quantity: 1.234,
          quality: 'OK',
          measurement_unit: 'kWh'
        }
      ];

      const dbError = new Error('Database connection failed');
      mockSequelize.query.mockRejectedValue(dbError);

      await expect(syncService.storeConsumptionData(mockRecords)).rejects.toThrow(
        'Failed to store consumption data: Database connection failed'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Mock createSyncLog to return a log ID
      mockSequelize.query.mockImplementation((query) => {
        if (query.includes('INSERT INTO data_sync_log')) {
          return Promise.resolve([[{ id: 1 }]]);
        }
        return Promise.resolve([]);
      });
    });

    test('should handle API authentication errors (401)', async () => {
      const authError = {
        response: { status: 401 },
        message: 'Unauthorized'
      };
      mockEloverblikService.getConsumptionData.mockRejectedValue(authError);

      const result = await syncService.syncConsumptionData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle API authentication errors (403)', async () => {
      const authError = {
        response: { status: 403 },
        message: 'Forbidden'
      };
      mockEloverblikService.getConsumptionData.mockRejectedValue(authError);

      const result = await syncService.syncConsumptionData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    test('should handle network timeout errors', async () => {
      const timeoutError = {
        code: 'ETIMEDOUT',
        message: 'Request timeout'
      };
      mockEloverblikService.getConsumptionData.mockRejectedValue(timeoutError);

      const result = await syncService.syncConsumptionData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.error).toContain('ETIMEDOUT');
    });

    test('should handle connection refused errors', async () => {
      const connError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };
      mockEloverblikService.getConsumptionData.mockRejectedValue(connError);

      const result = await syncService.syncConsumptionData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    test('should handle API rate limiting (429)', async () => {
      const rateLimitError = {
        response: { status: 429 },
        message: 'Too many requests'
      };
      mockEloverblikService.getConsumptionData.mockRejectedValue(rateLimitError);

      const result = await syncService.syncConsumptionData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should handle database connection failures during log creation', async () => {
      const dbError = new Error('Database unavailable');
      mockSequelize.query.mockRejectedValue(dbError);

      const result = await syncService.syncConsumptionData();

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Critical: Cannot access database for sync log',
        expect.any(Object)
      );
    });
  });
});
