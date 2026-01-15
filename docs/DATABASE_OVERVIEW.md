# Database Overview

This document provides a comprehensive overview of all data stored in the Electricity App database, organized by users and data types.

## Data Summary Table

| User ID | Email | Name | Properties | Metering Points | Consumption Data | Meter Readings | Tariff Data | Weather Data | Refresh Tokens | Sync Logs |
|---------|-------|------|------------|-----------------|------------------|----------------|-------------|---------------|----------------|-----------|
| 1 | admin@example.com | N/A | 1 | 1 | 13,825 | 0 | 0 | 96 | 0 | 2 |

## Database Schema Overview

The database contains two main schemas:

### 1. New Multi-User Schema
- **Users**: User accounts with authentication and preferences
- **Properties**: Physical properties/locations owned by users
- **UserProperties**: Junction table linking users to properties with roles
- **MeteringPoints**: Configuration for electricity metering points per property
- **WeatherData**: Weather information linked to properties
- **RefreshTokens**: API tokens for data retrieval per property

### 2. Legacy Single-User Schema
- **MeteringPoints** (legacy): Original metering point data from eloverblik.dk
- **ConsumptionData**: Time-series electricity consumption data
- **MeterReadings**: Physical meter readings
- **TariffData**: Pricing and tariff information
- **DataSyncLog**: Synchronization operation logs
- **AppConfig**: Application configuration (single-user setup)

## Total Database Counts

| Data Type | Total Records |
|-----------|---------------|
| Users | 1 |
| Properties | 1 |
| Metering Points (New) | 1 |
| Metering Points (Legacy) | 1 |
| Consumption Data Records | 13,825 |
| Meter Readings | 0 |
| Tariff Data Records | 0 |
| Weather Data Records | 96 |
| Refresh Tokens | 0 |
| Sync Logs | 4 |
| App Configs | 1 |

## Data Distribution Analysis

### User 1 (admin@example.com)
- **Properties**: 1 property owned
- **Metering Points**: 1 configured metering point
- **Consumption Data**: 13,825 records - This is the main dataset containing electricity usage over time
- **Weather Data**: 96 records - Weather data for the property location (increased from 72)
- **Sync Logs**: 2 records - History of data synchronization operations

### Legacy Data (Not User-Specific)
The legacy schema contains data that hasn't been migrated to the new multi-user structure:
- **Additional Properties**: 0 properties (cleanup completed)
- **Additional Metering Points**: 0 metering points (cleanup completed)
- **Additional Weather Data**: 0 weather records (cleanup completed)
- **Additional Sync Logs**: 0 sync logs (cleanup completed)

## Key Insights

1. **Active User**: There is 1 active user (admin@example.com) with a substantial amount of consumption data (13,825 records)

2. **Data Migration Status**: The database is in a transitional state with both legacy and new schemas present

3. **Consumption Data**: This is the largest dataset with over 13,000 records, indicating active electricity monitoring

4. **Weather Integration**: Weather data is being collected (96 records) for correlation with electricity usage (increased from 72)

5. **Sync Activity**: 4 sync logs show recent data synchronization operations with the eloverblik.dk API

6. **Missing Data Types**: No meter readings or tariff data are currently stored, suggesting these features may not be fully implemented

## Cleanup Completed (January 12, 2026)

The following cleanup operations were successfully completed:
- ✅ **Deleted 2 unlinked properties**: "Default Property" (ID: 1) and "Test hjemmet" (ID: 2)
- ✅ **Deleted 2 unlinked metering points**: "Default Meter" and "main"
- ✅ **Deleted 1,200 unlinked weather data records**
- ✅ **Deleted all 89 sync logs** for a fresh start
- ✅ **Database backup created**: `backup_before_cleanup.sql`

## Recommendations

1. **Complete Migration**: The database is now clean with only user-linked data remaining
2. **Token Setup**: Configure refresh tokens for automated data retrieval
3. **Tariff Integration**: Implement tariff data collection for cost analysis
4. **User Management**: Add more users and properties to scale the application
5. **Data Quality**: Set up proper sync logging to monitor data collection health

---

*Generated on: January 12, 2026*
*Database: PostgreSQL (electricity_app)*
*Total Records: ~15,000+ across all tables*
