const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefreshToken = sequelize.define('RefreshToken', {
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
        comment: 'Foreign key to properties table'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'My Token'
    },
    token: {
        type: DataTypes.TEXT, // Tokens can be long
        allowNull: false
    }
}, {
    tableName: 'refresh_tokens',
    timestamps: true,
    indexes: [
        {
            fields: ['property_id'],
            name: 'refresh_tokens_property_id_idx'
        }
    ]
});

module.exports = RefreshToken;
