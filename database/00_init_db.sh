#!/bin/bash
set -e

# Create the application database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER electricity_user WITH PASSWORD '${DB_PASSWORD:-electricity_password}';
    CREATE DATABASE electricity_app;
    GRANT ALL PRIVILEGES ON DATABASE electricity_app TO electricity_user;
EOSQL

# Connect to the new database and set up schema
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "electricity_app" -f /docker-entrypoint-initdb.d/01_schema.sql

# Grant privileges on all tables to the application user
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "electricity_app" <<-EOSQL
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO electricity_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO electricity_user;
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO electricity_user;
    
    -- Set default privileges for future objects
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO electricity_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO electricity_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO electricity_user;
EOSQL
