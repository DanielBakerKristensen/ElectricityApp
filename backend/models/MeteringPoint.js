const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MeteringPoint = sequelize.define('MeteringPoint', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'My Meter'
    },
    meteringPointId: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'metering_points_config', // Distinct from sync table
    timestamps: true
});

module.exports = MeteringPoint;
