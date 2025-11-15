const SyncService = require('../services/sync-service');

describe('End-to-End Sync Tests', () => {
  let syncService;
  let mockEloverblikService;
  let mockSequelize;
  let mockLogger;
  let queryResults;

  beforeEach(() => {
    // Track query results for verification
    queryResults = {
      syncLogs: [],
      consumptionData: []
    };

    // Mock Eloverblik service with realistic API response
    mockEloverblikService = {
      getConsumptionData: jest.fn()
    };

    // Mock Sequelize with realistic database behavior
    mockSequelize = {
      query: jest.fn((query, options) => {
        // Handle sync log creation
        if (query.includes('INSERT INTO data_sync_log')) {
          const logId = queryResults.syncLogs.length + 1;
          const logEntry = {
            id: logId,
            metering_point_id: options.bind[0],
            sync_type: options.bind[1],
            date_from: options.bind[2],
            date_to: options.bind[3],
            aggregation_level: options.bind[4],
            status: options.bind[5],
            records_synced: options.bind[6],
            error_message: null,
            created_at: new Date()
          };
          queryResults.syncLogs.push(logEntry);
          return Promise.resolve([[{ id: logId }]]);
        }

        // Handle sync log update
        if (query.includes('UPDATE data_sync_log')) {
          const logId = options.bind[3];
          const log = queryResults.syncLogs.find(l => l.id === logId);
          if (log) {
            log.status = options.bind[0];
            log.records_synced = options.bind[1] || log.records_synced;
            log.error_message = options.bind[2];
          }
          return Promise.resolve([]);
        }

        // Handle consumption data insert
        if (query.includes('INSERT INTO consumption_data')) {
          const recordCount = options.bind.length / 6;
          for (let i = 0; i < recordCount; i++) {
            const offset = i * 6;
            queryResults.consumptionData.push({
              metering_point_id: options.bind[offset],
              timestamp: options.bind[offset + 1],
              aggregation_level: options.bind[offset + 2],
              quantity: options.bind[offset + 3],
              quality: options.bind[offset + 4],
              measurement_unit: options.bind[offset + 5]
            });
          }
          return Promise.resolve([]);
        }

        return Promise.resolve([]);
      }),
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

    // Set environment variables
    process.env.ELOVERBLIK_METERING_POINTS = '571313174012345678';
    process.env.SYNC_DAYS_BACK = '1';

    syncService = new SyncService(mockEloverblikService, mockSequelize, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Sync Flow', () => {
    test('should complete full sync successfully with realistic data', async () => {
      // Mock realistic Eloverblik API response
      const mockApiResponse = {
        result: [{
          MyEnergyData_MarketDocument: {
            TimeSeries: [{
              measurement_Unit: { name: 'kWh' },
              Period: [{
                timeInterval: { start: '2024-01-15T00:00:00Z' },
                resolution: 'PT1H',
                Point: [
                  { position: '1', out_Quantity: { quantity: '0.523', quality: 'OK' } },
                  { position: '2', out_Quantity: { quantity: '0.487', quality: 'OK' } },
                  { position: '3', out_Quantity: { quantity: '0.445', quality: 'OK' } },
                  { position: '4', out_Quantity: { quantity: '0.412', quality: 'OK' } },
                  { position: '5', out_Quantity: { quantity: '0.398', quality: 'OK' } },
                  { position: '6', out_Quantity: { quantity: '0.456', quality: 'OK' } },
                  { position: '7', out_Quantity: { quantity: '0.534', quality: 'OK' } },
                  { position: '8', out_Quantity: { quantity: '0.612', quality: 'OK' } },
                  { position: '9', out_Quantity: { quantity: '0.678', quality: 'OK' } },
                  { position: '10', out_Quantity: { quantity: '0.723', quality: 'OK' } },
                  { position: '11', out_Quantity: { quantity: '0.756', quality: 'OK' } },
                  { position: '12', out_Quantity: { quantity: '0.789', quality: 'OK' } },
                  { position: '13', out_Quantity: { quantity: '0.812', quality: 'OK' } },
                  { position: '14', out_Quantity: { quantity: '0.834', quality: 'OK' } },
                  { position: '15', out_Quantity: { quantity: '0.867', quality: 'OK' } },
                  { position: '16', out_Quantity: { quantity: '0.923', quality: 'OK' } },
                  { position: '17', out_Quantity: { quantity: '1.012', quality: 'OK' } },
                  { position: '18', out_Quantity: { quantity: '1.145', quality: 'OK' } },
                  { position: '19', out_Quantity: { quantity: '1.234', quality: 'OK' } },
                  { position: '20', out_Quantity: { quantity: '1.156', quality: 'OK' } },
                  { position: '21', out_Quantity: { quantity: '0.987', quality: 'OK' } },
                  { position: '22', out_Quantity: { quantity: '0.823', quality: 'OK' } },
                  { position: '23', out_Quantity: { quantity: '0.712', quality: 'OK' } },
                  { position: '24', out_Quantity: { quantity: '0.634', quality: 'OK' } }
                ]
              }]
            }]
          }
        }]
      };

      mockEloverblikService.getConsumptionData.mockResolvedValue(mockApiResponse);

      // Execute sync
      const result = await syncService.syncConsumptionData();

      // Verify sync result
      expect(result.success).toBe(true);
      expect(result.recordsSynced).toBe(24);
      expect(result.logId).toBe(1);

      // Verify sync log was created correctly
      expect(queryResults.syncLogs).toHaveLength(1);
      const syncLog = queryResults.syncLogs[0];
      expect(syncLog.status).toBe('success');
      expect(syncLog.records_synced).toBe(24);
      expect(syncLog.sync_type).toBe('timeseries');
      expect(syncLog.aggregation_level).toBe('Hour');
      expect(syncLog.error_message).toBeNull();

      // Verify consumption data was stored correctly
      expect(queryResults.consumptionData).toHaveLength(24);
      
      // Check first record
      const firstRecord = queryResults.consumptionData[0];
      expect(firstRecord.metering_point_id).toBe('571313174012345678');
      expect(firstRecord.aggregation_level).toBe('Hour');
      expect(firstRecord.quantity).toBe(0.523);
      expect(firstRecord.quality).toBe('OK');
      expect(firstRecord.measurement_unit).toBe('kWh');
      expect(firstRecord.timestamp).toBeInstanceOf(Date);

      // Check last record
      const lastRecord = queryResults.consumptionData[23];
      expect(lastRecord.quantity).toBe(0.634);
    });

    test('should handle duplicate data with upsert behavior', async () => {
      // First sync
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

      mockEloverblikService.getConsumptionData.mockResolvedValue(mockApiResponse);

      // Execute first sync
      const result1 = await syncService.syncConsumptionData();
      expect(result1.success).toBe(true);
      expect(result1.recordsSynced).toBe(2);

      // Clear consumption data to simulate upsert (in real DB, ON CONFLICT would update)
      queryResults.consumptionData = [];

      // Execute second sync with same data
      const result2 = await syncService.syncConsumptionData();
      expect(result2.success).toBe(true);
      expect(result2.recordsSynced).toBe(2);

      // Verify both sync logs were created
      expect(queryResults.syncLogs).toHaveLength(2);
      expect(queryResults.syncLogs[0].status).toBe('success');
      expect(queryResults.syncLogs[1].status).toBe('success');

      // In real scenario, upsert would prevent duplicates
      // Here we verify the query was called correctly
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Object)
      );
    });

    test('should create error log entry when API fails', async () => {
      const apiError = {
        response: { status: 401 },
        message: 'Unauthorized'
      };
      mockEloverblikService.getConsumptionData.mockRejectedValue(apiError);

      // Execute sync
      const result = await syncService.syncConsumptionData();

      // Verify sync result
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');

      // Verify sync log was created with error status
      expect(queryResults.syncLogs).toHaveLength(1);
      const syncLog = queryResults.syncLogs[0];
      expect(syncLog.status).toBe('error');
      expect(syncLog.error_message).toContain('Authentication failed');
      expect(syncLog.records_synced).toBe(0);

      // Verify no consumption data was stored
      expect(queryResults.consumptionData).toHaveLength(0);
    });

    test('should handle partial data in API response', async () => {
      // Mock API response with missing quality field
      const mockApiResponse = {
        result: [{
          MyEnergyData_MarketDocument: {
            TimeSeries: [{
              measurement_Unit: { name: 'kWh' },
              Period: [{
                timeInterval: { start: '2024-01-15T00:00:00Z' },
                resolution: 'PT1H',
                Point: [
                  { position: '1', out_Quantity: { quantity: '1.234' } }, // Missing quality
                  { position: '2', out_Quantity: { quantity: '2.345', quality: 'OK' } }
                ]
              }]
            }]
          }
        }]
      };

      mockEloverblikService.getConsumptionData.mockResolvedValue(mockApiResponse);

      // Execute sync
      const result = await syncService.syncConsumptionData();

      // Verify sync completed successfully with default values
      expect(result.success).toBe(true);
      expect(result.recordsSynced).toBe(2);

      // Verify first record has default quality
      const firstRecord = queryResults.consumptionData[0];
      expect(firstRecord.quality).toBe('OK'); // Default value
    });

    test('should verify sync log entries have correct timestamps', async () => {
      const mockApiResponse = {
        result: [{
          MyEnergyData_MarketDocument: {
            TimeSeries: [{
              measurement_Unit: { name: 'kWh' },
              Period: [{
                timeInterval: { start: '2024-01-15T00:00:00Z' },
                resolution: 'PT1H',
                Point: [
                  { position: '1', out_Quantity: { quantity: '1.234', quality: 'OK' } }
                ]
              }]
            }]
          }
        }]
      };

      mockEloverblikService.getConsumptionData.mockResolvedValue(mockApiResponse);

      const beforeSync = new Date();
      await syncService.syncConsumptionData();
      const afterSync = new Date();

      // Verify sync log has timestamp within expected range
      const syncLog = queryResults.syncLogs[0];
      expect(syncLog.created_at).toBeInstanceOf(Date);
      expect(syncLog.created_at.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
      expect(syncLog.created_at.getTime()).toBeLessThanOrEqual(afterSync.getTime());
    });
  });

  describe('Multiple Day Sync', () => {
    test('should sync multiple days of data', async () => {
      // Mock API response with data for multiple days
      const mockApiResponse = {
        result: [{
          MyEnergyData_MarketDocument: {
            TimeSeries: [{
              measurement_Unit: { name: 'kWh' },
              Period: [
                {
                  timeInterval: { start: '2024-01-14T00:00:00Z' },
                  resolution: 'PT1H',
                  Point: [
                    { position: '1', out_Quantity: { quantity: '1.0', quality: 'OK' } },
                    { position: '2', out_Quantity: { quantity: '1.1', quality: 'OK' } }
                  ]
                },
                {
                  timeInterval: { start: '2024-01-15T00:00:00Z' },
                  resolution: 'PT1H',
                  Point: [
                    { position: '1', out_Quantity: { quantity: '2.0', quality: 'OK' } },
                    { position: '2', out_Quantity: { quantity: '2.1', quality: 'OK' } }
                  ]
                }
              ]
            }]
          }
        }]
      };

      mockEloverblikService.getConsumptionData.mockResolvedValue(mockApiResponse);

      // Execute sync with 2 days back
      const result = await syncService.syncConsumptionData({ daysBack: 2 });

      // Verify all records were synced
      expect(result.success).toBe(true);
      expect(result.recordsSynced).toBe(4);
      expect(queryResults.consumptionData).toHaveLength(4);
    });
  });
});
