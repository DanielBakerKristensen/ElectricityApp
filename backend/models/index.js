const User = require('./User');
const Property = require('./Property');
const UserProperty = require('./UserProperty');
const MeteringPoint = require('./MeteringPoint');
const RefreshToken = require('./RefreshToken'); // Keeping for now, or might deprecate
const WeatherData = require('./WeatherData');

// User <-> Properties (Many-to-Many)
User.belongsToMany(Property, { through: UserProperty, foreignKey: 'user_id', as: 'properties' });
Property.belongsToMany(User, { through: UserProperty, foreignKey: 'property_id', as: 'users' });

// Also define associations for access to the join table itself if needed
User.hasMany(UserProperty, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserProperty.belongsTo(User, { foreignKey: 'user_id' });
Property.hasMany(UserProperty, { foreignKey: 'property_id', onDelete: 'CASCADE' });
UserProperty.belongsTo(Property, { foreignKey: 'property_id' });

// Property -> MeteringPoints
Property.hasMany(MeteringPoint, { foreignKey: 'property_id', as: 'meteringPoints', onDelete: 'CASCADE' });
MeteringPoint.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });

// Property -> WeatherData
Property.hasMany(WeatherData, { foreignKey: 'property_id', as: 'weatherData', onDelete: 'CASCADE' });
WeatherData.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });

// Property -> RefreshTokens
Property.hasMany(RefreshToken, { foreignKey: 'property_id', onDelete: 'CASCADE' });
RefreshToken.belongsTo(Property, { foreignKey: 'property_id' });

module.exports = {
    User,
    Property,
    UserProperty,
    MeteringPoint,
    RefreshToken,
    WeatherData
};
