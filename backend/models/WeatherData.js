const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WeatherData = sequelize.define('WeatherData', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    property_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'properties',
            key: 'id'
        },
        comment: 'Foreign key to the properties table'
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Timestamp of weather observation (hourly)'
    },
    temperature_celsius: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Temperature in Celsius'
    },
    humidity_percent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Relative humidity percentage'
    },
    precipitation_mm: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        comment: 'Precipitation in millimeters'
    },
    weather_condition: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Human-readable weather condition'
    },
    weather_code: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'WMO weather code'
    },
    wind_speed_kmh: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        comment: 'Wind speed in km/h'
    },
    pressure_hpa: {
        type: DataTypes.DECIMAL(7, 2),
        allowNull: true,
        comment: 'Atmospheric pressure in hPa'
    },
    data_source: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'open-meteo',
        comment: 'Source of weather data'
    },
    createdAt: {
        type: DataTypes.DATE,
        field: 'created_at'
    },
    updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at'
    }
}, {
    tableName: 'weather_data',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['property_id', 'timestamp'],
            name: 'weather_data_property_timestamp_unique'
        },
        {
            fields: ['timestamp'],
            name: 'weather_data_timestamp_idx'
        },
        {
            fields: ['property_id'],
            name: 'weather_data_property_idx'
        }
    ]
});

module.exports = WeatherData;