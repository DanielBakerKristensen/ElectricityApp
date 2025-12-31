const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserProperty = sequelize.define('UserProperty', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    property_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'properties',
            key: 'id'
        }
    },
    role: {
        type: DataTypes.ENUM('OWNER', 'GUEST', 'ADMIN'),
        defaultValue: 'OWNER',
        allowNull: false
    }
}, {
    tableName: 'user_properties',
    timestamps: true
});

module.exports = UserProperty;
