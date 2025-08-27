-- Electricity Consumption App Database Schema
-- Single-user home application for eloverblik.dk data

-- Enable UUID extension for potential future use
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- App configuration table (single-user)
CREATE TABLE app_config (
    id SERIAL PRIMARY KEY,
    refresh_token TEXT, -- encrypted eloverblik refresh token
    access_token TEXT, -- current access token
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metering points table
CREATE TABLE metering_points (
    metering_point_id VARCHAR(18) PRIMARY KEY, -- 18-digit ID from eloverblik
    alias VARCHAR(255), -- user-friendly name
    type_of_mp VARCHAR(100),
    balance_supplier_name VARCHAR(255),
    postcode VARCHAR(10),
    city_name VARCHAR(255),
    street_name VARCHAR(255),
    building_number VARCHAR(20),
    floor_id VARCHAR(20),
    room_id VARCHAR(20),
    settlement_method VARCHAR(100),
    meter_reading_occurrence VARCHAR(100),
    first_consumer_party_name VARCHAR(255),
    second_consumer_party_name VARCHAR(255),
    meter_number VARCHAR(100),
    consumer_start_date DATE,
    has_relation BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consumption time-series data
CREATE TABLE consumption_data (
    id SERIAL PRIMARY KEY,
    metering_point_id VARCHAR(18) REFERENCES metering_points(metering_point_id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL, -- when the consumption occurred
    aggregation_level VARCHAR(20) NOT NULL, -- 'Actual', 'Hour', 'Day', 'Month', 'Year'
    quantity DECIMAL(12,3), -- consumption amount
    quality VARCHAR(50), -- data quality indicator
    measurement_unit VARCHAR(20) DEFAULT 'kWh', -- usually kWh
    business_type VARCHAR(100),
    curve_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metering_point_id, timestamp, aggregation_level)
);

-- Physical meter readings
CREATE TABLE meter_readings (
    id SERIAL PRIMARY KEY,
    metering_point_id VARCHAR(18) REFERENCES metering_points(metering_point_id) ON DELETE CASCADE,
    reading_date DATE NOT NULL,
    registration_date DATE,
    meter_number VARCHAR(100),
    meter_reading DECIMAL(12,3),
    measurement_unit VARCHAR(20) DEFAULT 'kWh',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tariff and pricing data
CREATE TABLE tariff_data (
    id SERIAL PRIMARY KEY,
    metering_point_id VARCHAR(18) REFERENCES metering_points(metering_point_id) ON DELETE CASCADE,
    tariff_type VARCHAR(50) NOT NULL, -- 'subscription', 'nettarif_c', 'transmission', 'system', 'elafgift'
    tariff_name VARCHAR(255),
    tariff_description TEXT,
    gln_number VARCHAR(50),
    price DECIMAL(10,6), -- price per unit
    price_discount DECIMAL(10,6), -- discount if applicable
    hour_from INTEGER CHECK (hour_from >= 0 AND hour_from <= 23), -- for hourly tariffs
    hour_to INTEGER CHECK (hour_to >= 0 AND hour_to <= 23), -- for hourly tariffs
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data synchronization log
CREATE TABLE data_sync_log (
    id SERIAL PRIMARY KEY,
    metering_point_id VARCHAR(18),
    sync_type VARCHAR(50) NOT NULL, -- 'timeseries', 'readings', 'tariffs'
    date_from DATE,
    date_to DATE,
    aggregation_level VARCHAR(20),
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'partial'
    error_message TEXT,
    records_synced INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimal query performance
CREATE INDEX idx_consumption_data_mp_time ON consumption_data(metering_point_id, timestamp);
CREATE INDEX idx_consumption_data_time_agg ON consumption_data(timestamp, aggregation_level);
CREATE INDEX idx_consumption_data_agg_time ON consumption_data(aggregation_level, timestamp);

CREATE INDEX idx_tariff_data_mp_valid ON tariff_data(metering_point_id, valid_from, valid_to);
CREATE INDEX idx_tariff_data_type ON tariff_data(tariff_type);

CREATE INDEX idx_meter_readings_mp_date ON meter_readings(metering_point_id, reading_date);

CREATE INDEX idx_sync_log_mp_type ON data_sync_log(metering_point_id, sync_type);
CREATE INDEX idx_sync_log_created ON data_sync_log(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to relevant tables
CREATE TRIGGER update_app_config_updated_at BEFORE UPDATE ON app_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_metering_points_updated_at BEFORE UPDATE ON metering_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tariff_data_updated_at BEFORE UPDATE ON tariff_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial app config row
INSERT INTO app_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Create a view for latest consumption data with tariff information
CREATE VIEW consumption_with_tariffs AS
SELECT 
    cd.*,
    mp.alias as metering_point_alias,
    mp.city_name,
    mp.street_name,
    td.tariff_type,
    td.price,
    td.price_discount,
    (cd.quantity * COALESCE(td.price, 0)) as estimated_cost
FROM consumption_data cd
JOIN metering_points mp ON cd.metering_point_id = mp.metering_point_id
LEFT JOIN tariff_data td ON cd.metering_point_id = td.metering_point_id 
    AND cd.timestamp::date BETWEEN td.valid_from AND COALESCE(td.valid_to, CURRENT_DATE)
    AND td.tariff_type = 'nettarif_c'; -- Primary tariff for cost calculation
