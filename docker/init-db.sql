-- Initialize database for AI development environment
CREATE DATABASE eceee_v4;
CREATE DATABASE eceee_v4_test;

-- Create additional users if needed
-- CREATE USER ai_dev_user WITH PASSWORD 'ai_dev_password';
-- GRANT ALL PRIVILEGES ON DATABASE eceee_v4 TO ai_dev_user;
-- GRANT ALL PRIVILEGES ON DATABASE eceee_v4_test TO ai_dev_user;

-- Enable required extensions
\c eceee_v4;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c eceee_v4_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";