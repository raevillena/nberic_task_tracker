#!/bin/bash
# MariaDB Database Setup Script (Bash)
# This script creates a database, user, and grants privileges

set -e  # Exit on error

echo "========================================"
echo "MariaDB Database Setup Script"
echo "========================================"
echo ""

# Prompt for MariaDB root password
read -sp "Enter MariaDB root password: " ROOT_PASSWORD
echo ""

# Prompt for database name
read -p "Enter database name (default: nberic_task_tracker): " DB_NAME
DB_NAME=${DB_NAME:-nberic_task_tracker}

# Prompt for database user
read -p "Enter database username (default: nberic_user): " DB_USER
DB_USER=${DB_USER:-nberic_user}

# Prompt for database user password
read -sp "Enter password for database user '$DB_USER': " DB_PASSWORD
echo ""

# Prompt for host (for privileges)
read -p "Enter host for user privileges (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

echo ""
echo "Summary:"
echo "  Database Name: $DB_NAME"
echo "  Database User: $DB_USER"
echo "  Database Host: $DB_HOST"
echo ""

read -p "Proceed with database setup? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 1
fi

echo ""
echo "Creating database and user..."

# Create SQL commands
SQL_COMMANDS=$(cat <<EOF
-- Create database
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER IF NOT EXISTS '$DB_USER'@'$DB_HOST' IDENTIFIED BY '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'$DB_HOST';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Show created database
SHOW DATABASES LIKE '$DB_NAME';

-- Show user privileges
SHOW GRANTS FOR '$DB_USER'@'$DB_HOST';
EOF
)

# Execute SQL commands
if echo "$SQL_COMMANDS" | mysql -u root -p"$ROOT_PASSWORD"; then
    echo ""
    echo "========================================"
    echo "Database setup completed successfully!"
    echo "========================================"
    echo ""
    echo "Connection details for .env.local:"
    echo "  DB_NAME=$DB_NAME"
    echo "  DB_USER=$DB_USER"
    echo "  DB_PASSWORD=<your_password>"
    echo "  DB_HOST=$DB_HOST"
    echo "  DB_PORT=3306"
    echo ""
else
    echo "Error: Database setup failed!"
    exit 1
fi

# Clear sensitive variables
unset ROOT_PASSWORD
unset DB_PASSWORD

