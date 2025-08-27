-- Create database if it doesn't exist
SELECT 'CREATE DATABASE electricity_app' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'electricity_app')\gexec

-- Connect to the new database
\c electricity_app

-- Create user if it doesn't exist and set password
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'electricity_user') THEN
        CREATE USER electricity_user WITH PASSWORD '${DB_PASSWORD:-electricity_password}';
    ELSE
        ALTER USER electricity_user WITH PASSWORD '${DB_PASSWORD:-electricity_password}';
    END IF;
END
$$;

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE electricity_app TO electricity_user;

-- Grant privileges on all existing tables in the public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO electricity_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO electricity_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO electricity_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO electricity_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO electricity_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO electricity_user;
