-- Initialize database for AI development environment
CREATE DATABASE ai_dev_app;
CREATE DATABASE ai_dev_app_test;

-- Create additional users if needed
-- CREATE USER ai_dev_user WITH PASSWORD 'ai_dev_password';
-- GRANT ALL PRIVILEGES ON DATABASE ai_dev_app TO ai_dev_user;
-- GRANT ALL PRIVILEGES ON DATABASE ai_dev_app_test TO ai_dev_user;

-- Enable required extensions
\c ai_dev_app;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c ai_dev_app_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";