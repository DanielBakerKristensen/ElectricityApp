const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Property = sequelize.define('Property', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // user_id removed in favor of UserProperty M:N relationship
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'My Property'
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    latitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: true,
        comment: 'Latitude for weather data'
    },
    longitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: true,
        comment: 'Longitude for weather data'
    },
    weather_sync_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether to sync weather data for this property'
    }
}, {
    tableName: 'properties',
    timestamps: true
});

module.exports = Property;
