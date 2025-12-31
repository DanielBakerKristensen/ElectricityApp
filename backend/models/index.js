const User = require('./User');
const Property = require('./Property');
const UserProperty = require('./UserProperty');
const MeteringPoint = require('./MeteringPoint');
const RefreshToken = require('./RefreshToken'); // Keeping for now, or might deprecate

// User <-> Properties (Many-to-Many)
User.belongsToMany(Property, { through: UserProperty, foreignKey: 'user_id', as: 'properties' });
Property.belongsToMany(User, { through: UserProperty, foreignKey: 'property_id', as: 'users' });

// Also define associations for access to the join table itself if needed
User.hasMany(UserProperty, { foreignKey: 'user_id' });
UserProperty.belongsTo(User, { foreignKey: 'user_id' });
Property.hasMany(UserProperty, { foreignKey: 'property_id' });
UserProperty.belongsTo(Property, { foreignKey: 'property_id' });

// Property -> MeteringPoints
Property.hasMany(MeteringPoint, { foreignKey: 'property_id', as: 'meteringPoints' });
MeteringPoint.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });

module.exports = {
    User,
    Property,
    UserProperty,
    MeteringPoint,
    RefreshToken
};
