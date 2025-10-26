# SQL Query Optimizer - Setup Without Docker

This guide explains how to set up and run the SQL Query Optimizer using local MySQL and Redis installations instead of Docker.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install MySQL Locally](#install-mysql-locally)
3. [Install Redis Locally](#install-redis-locally)
4. [Database Setup](#database-setup)
5. [Project Configuration](#project-configuration)
6. [Running the Application](#running-the-application)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js 18+** and **npm 9+**
- **OpenAI API Key**
- macOS, Linux, or Windows with WSL2

---

## Install MySQL Locally

### macOS

**Option 1: Using Homebrew (Recommended)**

```bash
# Install MySQL
brew install mysql

# Start MySQL service
brew services start mysql

# Secure installation (optional but recommended)
mysql_secure_installation
```

**Option 2: Download from Official Site**

1. Download MySQL from: https://dev.mysql.com/downloads/mysql/
2. Install the DMG package
3. Start MySQL from System Preferences

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install MySQL Server
sudo apt install mysql-server

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure installation
sudo mysql_secure_installation
```

### Linux (CentOS/RHEL)

```bash
# Install MySQL
sudo yum install mysql-server

# Start MySQL service
sudo systemctl start mysqld
sudo systemctl enable mysqld

# Get temporary root password
sudo grep 'temporary password' /var/log/mysqld.log

# Secure installation
sudo mysql_secure_installation
```

### Windows

1. Download MySQL Installer from: https://dev.mysql.com/downloads/installer/
2. Run the installer
3. Choose "Developer Default" setup
4. Follow the wizard to complete installation
5. MySQL will run as a Windows service

### Verify MySQL Installation

```bash
# Check MySQL version
mysql --version

# Test connection
mysql -u root -p
```

If successful, you should see the MySQL prompt:
```
mysql>
```

Type `exit` to quit.

---

## Install Redis Locally

### macOS

```bash
# Install Redis using Homebrew
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Linux (Ubuntu/Debian)

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Linux (CentOS/RHEL)

```bash
# Enable EPEL repository
sudo yum install epel-release

# Install Redis
sudo yum install redis

# Start Redis service
sudo systemctl start redis
sudo systemctl enable redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Windows

**Option 1: Windows Subsystem for Linux (WSL2) - Recommended**

```bash
# Install WSL2 first, then:
sudo apt update
sudo apt install redis-server
redis-server --daemonize yes
```

**Option 2: Memurai (Redis-compatible)**

1. Download from: https://www.memurai.com/
2. Install and run as Windows service

**Option 3: Build from source**

Follow instructions at: https://redis.io/docs/getting-started/installation/install-redis-on-windows/

### Verify Redis Installation

```bash
# Check Redis version
redis-cli --version

# Test connection and basic operations
redis-cli
> ping
PONG
> set test "hello"
OK
> get test
"hello"
> exit
```

---

## Database Setup

### Step 1: Create Database

```bash
# Log in to MySQL
mysql -u root -p

# Create database
CREATE DATABASE testdb;

# Create a user for the application (recommended)
CREATE USER 'optimizer'@'localhost' IDENTIFIED BY 'optimizerpass';
GRANT ALL PRIVILEGES ON testdb.* TO 'optimizer'@'localhost';
FLUSH PRIVILEGES;

# Verify
SHOW DATABASES;
exit;
```

### Step 2: Import Sample Data

```bash
# Import the init.sql file
mysql -u root -p testdb < init.sql

# Verify tables were created
mysql -u root -p testdb -e "SHOW TABLES;"
```

You should see:
```
+-----------------+
| Tables_in_testdb|
+-----------------+
| order_items     |
| orders          |
| products        |
| users           |
+-----------------+
```

### Step 3: Verify Sample Data

```bash
# Check data was inserted
mysql -u root -p testdb -e "SELECT COUNT(*) FROM users;"
mysql -u root -p testdb -e "SELECT * FROM users LIMIT 3;"
```

---

## Project Configuration

### Step 1: Install Project Dependencies

```bash
cd /Users/geetha/workspace/sql_query_optimizer

# Install root dependencies
npm install

# Build shared package
cd packages/shared
npm install
npm run build
cd ../..
```

### Step 2: Configure Backend Environment

Create the backend `.env` file:

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env` with your local settings:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# MySQL Configuration (Local Installation)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root                    # or 'optimizer' if you created a dedicated user
MYSQL_PASSWORD=your_mysql_password # Your actual MySQL password
MYSQL_DATABASE=testdb

# Redis Configuration (Local Installation)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                    # Leave empty unless you set a password
REDIS_TTL=3600

# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Important Notes:**

- Replace `your_mysql_password` with your actual MySQL root password
- Replace `sk-your-actual-openai-api-key-here` with your OpenAI API key
- If you created a dedicated MySQL user, use those credentials instead

### Step 3: Test Connections

**Test MySQL:**

```bash
mysql -h localhost -P 3306 -u root -p testdb -e "SELECT 'Connected!' as status;"
```

**Test Redis:**

```bash
redis-cli ping
# Should return: PONG
```

---

## Running the Application

### Terminal 1: Start MySQL and Redis (if not running as services)

**macOS (if not using brew services):**

```bash
# Start MySQL
mysql.server start

# Start Redis
redis-server
```

**Linux (if not enabled as systemd services):**

```bash
# Start MySQL
sudo systemctl start mysql

# Start Redis
sudo systemctl start redis-server
```

### Terminal 2: Start Backend

```bash
cd packages/backend
npm install
npm run dev
```

You should see:

```
[INFO] Server running on port 3001
[INFO] CORS enabled for: http://localhost:5173
[INFO] Environment: development
Redis Client Connected
```

**If you see connection errors:**
- MySQL: Check credentials in `.env` file
- Redis: Verify Redis is running with `redis-cli ping`

### Terminal 3: Start Frontend

```bash
cd packages/frontend
npm install
npm run dev
```

You should see:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Access the Application

Open your browser to: **http://localhost:5173**

---

## Stopping the Application

### Stop Backend and Frontend

- Press `Ctrl+C` in each terminal

### Stop MySQL

**macOS:**
```bash
# If using Homebrew services
brew services stop mysql

# Or
mysql.server stop
```

**Linux:**
```bash
sudo systemctl stop mysql
```

### Stop Redis

**macOS:**
```bash
# If using Homebrew services
brew services stop redis

# Or find and kill the process
pkill redis-server
```

**Linux:**
```bash
sudo systemctl stop redis-server
```

---

## Troubleshooting

### MySQL Issues

**Issue: Can't connect to MySQL server**

```bash
# Check if MySQL is running
# macOS:
mysql.server status

# Linux:
sudo systemctl status mysql

# Start MySQL if not running
# macOS:
mysql.server start

# Linux:
sudo systemctl start mysql
```

---

**Issue: Access denied for user 'root'@'localhost'**

```bash
# Reset root password (macOS/Linux)
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
exit;

# Update .env with new password
```

---

**Issue: Database doesn't exist**

```bash
mysql -u root -p
CREATE DATABASE testdb;
exit;

# Re-import sample data
mysql -u root -p testdb < init.sql
```

---

### Redis Issues

**Issue: Could not connect to Redis**

```bash
# Check if Redis is running
ps aux | grep redis

# Start Redis manually
redis-server

# Or as a service:
# macOS:
brew services start redis

# Linux:
sudo systemctl start redis-server
```

---

**Issue: Redis connection refused**

```bash
# Check Redis configuration
redis-cli config get bind
redis-cli config get port

# Ensure Redis is listening on localhost:6379
# Edit /etc/redis/redis.conf or /usr/local/etc/redis.conf
# Set: bind 127.0.0.1
# Set: port 6379

# Restart Redis after changes
```

---

**Issue: Redis password required**

If you set a Redis password:

1. Update `packages/backend/.env`:
   ```env
   REDIS_PASSWORD=your_redis_password
   ```

2. Restart backend

---

### Performance Issues

**Issue: MySQL using too much memory**

```bash
# Edit MySQL config file
# macOS: /usr/local/etc/my.cnf
# Linux: /etc/mysql/my.cnf

# Add under [mysqld]:
[mysqld]
innodb_buffer_pool_size = 256M
max_connections = 50

# Restart MySQL
```

---

**Issue: Redis using too much memory**

```bash
redis-cli
> CONFIG SET maxmemory 256mb
> CONFIG SET maxmemory-policy allkeys-lru
> exit

# To persist, edit redis.conf
```

---

## Service Management Scripts

### Create Start Script

Create `start-local.sh`:

```bash
#!/bin/bash

echo "Starting MySQL..."
mysql.server start

echo "Starting Redis..."
redis-server --daemonize yes

echo "Waiting for services..."
sleep 3

echo "Services started!"
echo "MySQL: localhost:3306"
echo "Redis: localhost:6379"
```

Make it executable:
```bash
chmod +x start-local.sh
```

### Create Stop Script

Create `stop-local.sh`:

```bash
#!/bin/bash

echo "Stopping MySQL..."
mysql.server stop

echo "Stopping Redis..."
pkill redis-server

echo "Services stopped!"
```

Make it executable:
```bash
chmod +x stop-local.sh
```

### Usage

```bash
# Start services
./start-local.sh

# Stop services
./stop-local.sh
```

---

## Database Management

### Backup Database

```bash
# Backup entire database
mysqldump -u root -p testdb > backup_$(date +%Y%m%d).sql

# Backup specific table
mysqldump -u root -p testdb users > users_backup.sql
```

### Restore Database

```bash
mysql -u root -p testdb < backup_20251001.sql
```

### Reset Database

```bash
# Drop and recreate database
mysql -u root -p -e "DROP DATABASE IF EXISTS testdb; CREATE DATABASE testdb;"

# Re-import sample data
mysql -u root -p testdb < init.sql
```

---

## Monitoring

### Monitor MySQL

```bash
# View active connections
mysql -u root -p -e "SHOW PROCESSLIST;"

# View database size
mysql -u root -p -e "SELECT table_schema AS 'Database', 
ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' 
FROM information_schema.tables 
WHERE table_schema = 'testdb' 
GROUP BY table_schema;"
```

### Monitor Redis

```bash
# Monitor Redis commands in real-time
redis-cli monitor

# View Redis stats
redis-cli info

# View memory usage
redis-cli info memory

# View connected clients
redis-cli client list
```

---

## Advantages of Local Setup

✅ No Docker overhead - better performance  
✅ Direct access to services for debugging  
✅ Easier to integrate with existing local tools  
✅ Persistent data by default  
✅ More control over configuration  

## Disadvantages

❌ Requires manual installation of MySQL and Redis  
❌ Service management varies by OS  
❌ Potential port conflicts with other applications  
❌ More complex initial setup  

---

## Next Steps

Once everything is running:

1. **Test the health endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Open the web interface:**
   - Navigate to http://localhost:5173
   - Try the sample queries

3. **Monitor logs:**
   - Watch backend terminal for API requests
   - Check MySQL slow query log if needed

---

## Additional Resources

- **MySQL Documentation**: https://dev.mysql.com/doc/
- **Redis Documentation**: https://redis.io/documentation
- **Project Setup Guide**: See `SETUP_GUIDE.md`
- **Quick Start**: See `QUICK_START.md`

---

**Happy coding! 🚀**

