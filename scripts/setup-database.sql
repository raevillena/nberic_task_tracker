-- MariaDB Database Setup Script
-- This script creates a database, user, and grants privileges
-- 
-- Usage:
--   1. Edit the variables below
--   2. Run: mysql -u root -p < setup-database.sql
--   OR
--   3. Use the interactive scripts: setup-database.sh or setup-database.ps1

-- ============================================
-- CONFIGURATION VARIABLES - EDIT THESE
-- ============================================

SET @db_name = 'nberic_task_tracker';        -- Database name
SET @db_user = 'nberic_user';                 -- Database username
SET @db_password = 'your_secure_password';    -- Database user password
SET @db_host = 'localhost';                   -- Host for user privileges ('localhost' or '%' for any host)

-- ============================================
-- SCRIPT EXECUTION - DO NOT EDIT BELOW
-- ============================================

-- Create database with UTF8MB4 character set for full Unicode support
CREATE DATABASE IF NOT EXISTS `nberic_task_tracker` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create user (if not exists)
CREATE USER IF NOT EXISTS 'nberic_user'@'localhost' 
IDENTIFIED BY 'your_secure_password';

-- Grant all privileges on the database to the user
GRANT ALL PRIVILEGES ON `nberic_task_tracker`.* 
TO 'nberic_user'@'localhost';

-- Flush privileges to apply changes immediately
FLUSH PRIVILEGES;

-- Verify database creation
SHOW DATABASES LIKE 'nberic_task_tracker';

-- Verify user privileges
SHOW GRANTS FOR 'nberic_user'@'localhost';

-- ============================================
-- NOTES
-- ============================================
-- 
-- After running this script, update your .env.local with:
--   DB_NAME=nberic_task_tracker
--   DB_USER=nberic_user
--   DB_PASSWORD=your_secure_password
--   DB_HOST=localhost
--   DB_PORT=3306
--
-- To use variables (requires MariaDB 10.2.3+), you can use:
--   SET @db_name = 'your_database_name';
--   SET @db_user = 'your_username';
--   SET @db_password = 'your_password';
--   SET @db_host = 'localhost';
--
-- Then use: CREATE DATABASE IF NOT EXISTS @db_name;
-- (Note: Some commands don't support variables directly)

