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
    }
}, {
    tableName: 'properties',
    timestamps: true
});

module.exports = Property;
