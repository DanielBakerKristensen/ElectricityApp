# Account-Centric Refactoring Design Plan

## Executive Summary

This document outlines the complete refactoring of the Electricity App from a single-tenant architecture to a multi-tenant, account-centric system. The refactoring will ensure proper data isolation between accounts while enabling multi-user collaboration within each account.

## Current Architecture Issues

### Security Vulnerabilities
- **Data Leakage**: Users can access all properties/metering points regardless of ownership
- **No Account Isolation**: Missing tenant boundaries between different user groups
- **Default Fallbacks**: Routes default to "first available" property when none specified

### Architectural Limitations
- **Direct User-Property Relationships**: No clear account/tenant concept
- **No Collaboration Model**: Cannot invite users to shared properties
- **Scalability Issues**: Hard to add account-level features (billing, settings, etc.)

## Target Architecture

### Core Concepts
1. **Account**: Central tenant entity representing an organization/household
2. **Account Users**: Users belong to accounts with specific roles
3. **Account Properties**: Properties belong to accounts, not directly to users
4. **Role-Based Access**: Different permission levels within accounts

### Data Model
```
Account (Tenant)
├── Owner (Account User with OWNER role)
├── Properties (belong to account)
├── Users (Account Users with various roles)
└── Settings (account-level configuration)
```

## Phase 1: Backend Foundation

### 1.1 Database Schema Changes

#### New Models

**Account Model**
```sql
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**AccountUser Model**
```sql
CREATE TABLE account_users (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER') NOT NULL DEFAULT 'MEMBER',
    permissions JSONB, -- Optional granular permissions
    invited_by INTEGER REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, user_id)
);
```

**Invitation Model**
```sql
CREATE TABLE invitations (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    email VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'MEMBER', 'VIEWER') NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    invited_by INTEGER NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Model Updates

**Property Model Changes**
```sql
ALTER TABLE properties 
ADD COLUMN account_id INTEGER NOT NULL REFERENCES accounts(id);

-- Migration: Create accounts for existing users
-- and migrate properties to new accounts
```

**Remove UserProperty Model**
```sql
DROP TABLE user_properties; -- Replaced by account_users
```

### 1.2 Authentication & Authorization

#### JWT Token Structure Update
```json
{
  "userId": 123,
  "accountId": 456,
  "role": "OWNER",
  "permissions": ["properties:read", "properties:write", "users:invite"],
  "exp": 1234567890
}
```

#### New Middleware
```javascript
// accountAuth.js
const accountAuth = async (req, res, next) => {
  const token = req.cookies.auth_token;
  const decoded = jwt.verify(token, JWT_SECRET);
  
  // Verify user belongs to account
  const accountUser = await AccountUser.findOne({
    where: { 
      user_id: decoded.userId, 
      account_id: decoded.accountId 
    }
  });
  
  if (!accountUser) {
    return res.status(403).json({ error: 'Access denied to account' });
  }
  
  req.user = { id: decoded.userId };
  req.account = { id: decoded.accountId, role: accountUser.role };
  next();
};
```

#### Role-Based Permissions
```javascript
const permissions = {
  OWNER: ['*'], // All permissions
  ADMIN: ['properties:read', 'properties:write', 'users:invite', 'settings:read', 'settings:write'],
  MEMBER: ['properties:read', 'properties:write'],
  VIEWER: ['properties:read']
};
```

### 1.3 Route Restructuring

#### New Route Patterns
```
Before: /api/properties
After:  /api/accounts/:accountId/properties

Before: /api/metering-points
After:  /api/accounts/:accountId/properties/:propertyId/metering-points

Before: /api/data
After:  /api/accounts/:accountId/properties/:propertyId/data
```

#### Route Updates Required
- `/api/auth/*` - Update to include account context
- `/api/settings/*` - Scope to account
- `/api/electricity/*` - Add account filtering
- `/api/sync/*` - Account-based sync

## Phase 2: Data Access Control

### 2.1 Service Layer Updates

#### Property Service
```javascript
// Before: Property.findOne()
// After: Property.findOne({ where: { account_id: req.account.id } })

const getProperties = async (accountId, userId) => {
  return await Property.findAll({
    where: { account_id: accountId },
    include: [{ model: MeteringPoint, as: 'meteringPoints' }]
  });
};
```

#### Metering Point Service
```javascript
const getMeteringPoints = async (accountId, propertyId) => {
  // Verify property belongs to account
  const property = await Property.findOne({
    where: { id: propertyId, account_id: accountId }
  });
  
  if (!property) {
    throw new Error('Property not found or access denied');
  }
  
  return await MeteringPoint.findAll({
    where: { property_id: propertyId }
  });
};
```

### 2.2 Data Query Updates

#### Consumption Data Queries
```sql
-- Add account_id filtering through property relationship
SELECT cd.* 
FROM consumption_data cd
JOIN metering_points mp ON cd.metering_point_id = mp.id
JOIN properties p ON mp.property_id = p.id
WHERE p.account_id = :accountId
  AND mp.id = :meteringPointId
```

## Phase 3: Invitation System

### 3.1 Invitation Endpoints

#### Send Invitation
```javascript
POST /api/accounts/:accountId/invitations
{
  "email": "user@example.com",
  "role": "MEMBER"
}
```

#### Accept Invitation
```javascript
POST /api/invitations/:token/accept
{
  "name": "John Doe",
  "password": "securepassword"
}
```

#### List Invitations
```javascript
GET /api/accounts/:accountId/invitations
```

### 3.2 Email Notification System

#### Email Templates
- Invitation email with accept link
- Welcome email for new users
- Account access notifications

#### Email Service Integration
```javascript
const emailService = {
  sendInvitation: async (email, accountName, inviterName, token) => {
    // Send invitation email
  },
  sendWelcome: async (email, accountName) => {
    // Send welcome email
  }
};

// ... (rest of the code remains the same)
  currentProperty: null,
  availableProperties: [],
  userRole: null,
  switchAccount: () => {},
  switchProperty: () => {}
});
```

#### Header Component Updates
```javascript
const Header = () => {
  const { currentAccount, availableAccounts, currentProperty, availableProperties } = useAccountContext();
  
  return (
    <header>
      <AccountSelector accounts={availableAccounts} />
      <PropertySelector properties={availableProperties} />
      <UserMenu />
    </header>
  );
};
```

### 4.2 Route Updates

#### Protected Routes
```javascript
// Wrap routes with account context
<AccountProvider>
  <Route path="/accounts/:accountId/dashboard" component={Dashboard} />
  <Route path="/accounts/:accountId/properties" component={Properties} />
  <Route path="/accounts/:accountId/settings" component={Settings} />
</AccountProvider>
```

#### API Client Updates
```javascript
// Add account context to all API calls
const apiClient = {
  getProperties: (accountId) => api.get(`/accounts/${accountId}/properties`),
  getData: (accountId, propertyId, params) => 
    api.get(`/accounts/${accountId}/properties/${propertyId}/data`, { params })
};
```

### 4.3 New UI Components

#### Account Management
- Account settings page
- User invitation interface
- Role management for owners/admins
- Account switching interface

#### Property Management
- Property creation/editing scoped to account
- Property selector in header
- Property-specific settings

## Phase 5: Migration & Testing

### 5.1 Data Migration Script

#### Migration Steps
```javascript
// 1. Create accounts for existing users
// 2. Assign existing properties to new accounts
// 3. Create account_user relationships
// 4. Update foreign key constraints
// 5. Validate data integrity
```

#### Migration Validation
```sql
-- Verify all properties have account_id
SELECT COUNT(*) FROM properties WHERE account_id IS NULL;

-- Verify all users have account access
SELECT u.id, u.email 
FROM users u 
LEFT JOIN account_users au ON u.id = au.user_id 
WHERE au.user_id IS NULL;
```

### 5.2 Testing Strategy

#### Security Testing
- **Data Isolation**: Verify users can't access other accounts' data
- **Permission Testing**: Test role-based access controls
- **JWT Validation**: Test token manipulation scenarios

#### Integration Testing
- **Multi-Account Scenarios**: Users with multiple accounts
- **Invitation Flow**: End-to-end invitation testing
- **Data Consistency**: Account switching and data access

#### Performance Testing
- **Query Optimization**: Account-based filtering performance
- **Concurrent Users**: Multi-tenant load testing
- **Database Indexing**: Account_id column indexing

## Implementation Timeline

### Week 1-2: Backend Foundation
- Database migrations
- Model updates
- Authentication middleware

### Week 3-4: Data Access Control
- Route restructuring
- Service layer updates
- Permission system

### Week 5-6: Invitation System
- Invitation endpoints
- Email integration
- User management

### Week 7-8: Frontend Refactoring
- Context providers
- Component updates
- Route changes

### Week 9-10: Testing & Migration
- Data migration
- Security testing
- Performance optimization

## Risk Mitigation

### Technical Risks
- **Data Loss**: Comprehensive backups before migration
- **Downtime**: Blue-green deployment strategy
- **Performance**: Query optimization and indexing

### Business Risks
- **User Disruption**: Clear communication about changes
- **Feature Loss**: Ensure all existing functionality preserved
- **Adoption**: User training for new account features

## Success Metrics

### Security Metrics
- Zero data leakage between accounts
- All routes properly protected
- Role-based access working correctly

### User Experience Metrics
- Seamless account switching
- Intuitive invitation system
- No disruption to existing workflows

### Technical Metrics
- Query performance maintained or improved
- Zero data loss during migration
- All tests passing

## Conclusion

This refactoring will transform the Electricity App into a secure, multi-tenant platform that supports collaboration while maintaining strict data isolation. The phased approach minimizes risk while ensuring a smooth transition for existing users.
