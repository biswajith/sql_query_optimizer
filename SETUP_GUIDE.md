# SQL Query Optimizer - Complete Setup Guide

This guide will walk you through setting up the SQL Query Optimizer from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Configuration](#configuration)
4. [Running the Application](#running-the-application)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Node.js (18.x or higher)**
   ```bash
   node --version  # Should be v18.x or higher
   ```
   Download from: https://nodejs.org/

2. **npm (9.x or higher)**
   ```bash
   npm --version  # Should be v9.x or higher
   ```

3. **Docker and Docker Compose** (for easy MySQL and Redis setup)
   ```bash
   docker --version
   docker-compose --version
   ```
   Download from: https://www.docker.com/products/docker-desktop

4. **OpenAI API Key**
   - Sign up at: https://platform.openai.com/
   - Navigate to API Keys section
   - Create a new secret key
   - Save it securely (you'll need it for configuration)

### Optional (if not using Docker)

- **MySQL 5.7+**: https://dev.mysql.com/downloads/mysql/
- **Redis 7+**: https://redis.io/download

---

## Installation Steps

### Step 1: Navigate to Project Directory

```bash
cd /Users/geetha/workspace/sql_query_optimizer
```

### Step 2: Install Dependencies

Install dependencies for all packages in the monorepo:

```bash
npm install
```

This will install dependencies for the root, shared, backend, and frontend packages.

### Step 3: Build Shared Package

The shared package contains types used by both backend and frontend:

```bash
cd packages/shared
npm install
npm run build
cd ../..
```

You should see a `dist` folder created in `packages/shared/`.

---

## Configuration

### Step 1: Start MySQL and Redis with Docker

**Option A: Using Docker Compose (Recommended)**

```bash
# Start services in the background
docker-compose up -d

# Check if services are running
docker-compose ps

# View logs (optional)
docker-compose logs -f
```

This will:
- Start MySQL 8.0 on `localhost:3306`
- Start Redis 7 on `localhost:6379`
- Create sample database with tables: `users`, `orders`, `products`, `order_items`
- Insert sample data for testing

**Option B: Using Local Installations**

If you prefer local installations:

1. **MySQL Setup:**
   ```bash
   # Start MySQL service
   mysql.server start  # macOS
   # OR
   sudo service mysql start  # Linux
   
   # Create database
   mysql -u root -p
   CREATE DATABASE testdb;
   exit;
   
   # Import sample data
   mysql -u root -p testdb < init.sql
   ```

2. **Redis Setup:**
   ```bash
   # Start Redis
   redis-server
   
   # Test connection (in another terminal)
   redis-cli ping  # Should return PONG
   ```

### Step 2: Configure Backend Environment

1. Create backend `.env` file:
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   ```

2. Edit `packages/backend/.env`:
   ```bash
   nano packages/backend/.env
   # OR
   code packages/backend/.env
   ```

3. Update the following values:

   ```env
   # Server
   PORT=3001
   NODE_ENV=development

   # MySQL Configuration
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=rootpass      # Change if using local MySQL
   MYSQL_DATABASE=testdb

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=                # Leave empty if no password
   REDIS_TTL=3600

   # OpenAI Configuration - IMPORTANT: Add your key here!
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   OPENAI_MODEL=gpt-4o-mini

   # CORS Configuration
   CORS_ORIGIN=http://localhost:5173

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

   ⚠️ **Important**: Replace `sk-your-actual-openai-api-key-here` with your real OpenAI API key!

### Step 3: Verify Configuration

Check that services are accessible:

```bash
# Test MySQL connection
mysql -h localhost -P 3306 -u root -p -e "SHOW DATABASES;"

# Test Redis connection
redis-cli ping  # Should return PONG
```

---

## Running the Application

### Terminal 1: Start Backend Server

```bash
cd packages/backend
npm install
npm run dev
```

You should see:
```
[2025-10-01T12:00:00.000Z] [INFO] Server running on port 3001
[2025-10-01T12:00:00.000Z] [INFO] CORS enabled for: http://localhost:5173
[2025-10-01T12:00:00.000Z] [INFO] Environment: development
```

**Backend is now running at:** `http://localhost:3001`

### Terminal 2: Start Frontend

Open a new terminal:

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

**Frontend is now running at:** `http://localhost:5173`

### Open the Application

Open your browser and navigate to: `http://localhost:5173`

---

## Testing

### Test 1: Health Check

Verify all services are connected:

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "mysql": true,
      "redis": true,
      "llm": true
    },
    "timestamp": "2025-10-01T12:00:00.000Z"
  }
}
```

### Test 2: Simple Query Optimization

In the web interface:

1. Enter this query:
   ```sql
   SELECT * FROM users WHERE email = 'john.doe@example.com'
   ```

2. Click "Optimize Query"

3. You should see:
   - Original and optimized queries
   - EXPLAIN plan
   - Table schema
   - Index information
   - Optimization reasoning

### Test 3: Complex Query with Joins

Try this query:
```sql
SELECT u.username, o.order_date, o.total_amount, o.status
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status = 'pending'
ORDER BY o.order_date DESC
```

This will test:
- Multi-table extraction
- Join optimization
- Index usage analysis

### Test 4: Index Recommendations

1. Enable "Include Index Recommendations" toggle
2. Enter a query without proper indexes:
   ```sql
   SELECT * FROM products 
   WHERE category = 'Electronics' 
   AND price > 100
   ORDER BY price DESC
   ```
3. The optimizer should suggest composite indexes

---

## Troubleshooting

### Issue: Backend fails to start

**Error:** "OPENAI_API_KEY is not configured"

**Solution:**
1. Check `packages/backend/.env` file exists
2. Verify `OPENAI_API_KEY` is set correctly
3. No spaces around the `=` sign
4. Key should start with `sk-`

---

**Error:** "MySQL connection test failed"

**Solution:**
```bash
# Check if MySQL is running
docker-compose ps
# OR
mysql.server status

# Check connection manually
mysql -h localhost -P 3306 -u root -p

# Check credentials in .env match your MySQL setup
```

---

**Error:** "Redis Client Error"

**Solution:**
```bash
# Check if Redis is running
docker-compose ps
# OR
redis-cli ping

# Restart Redis
docker-compose restart redis
# OR
redis-server
```

---

### Issue: Frontend can't connect to backend

**Error:** "Network Error" or "CORS Error"

**Solution:**
1. Verify backend is running on port 3001
2. Check `CORS_ORIGIN` in backend `.env` is set to `http://localhost:5173`
3. Restart backend after changing `.env`

---

### Issue: Query validation rejecting safe queries

**Error:** "Query rejected: DROP statement detected"

**Solution:**
- This is expected for destructive queries (security feature)
- Only `SELECT`, `EXPLAIN`, `SHOW CREATE TABLE`, `SHOW INDEX` are allowed
- If a safe query is rejected, check for typos or syntax errors

---

### Issue: Slow response times

**Symptoms:** Query optimization takes >10 seconds

**Solution:**
1. First request is always slower (no cache)
2. Check internet connection (LLM API calls)
3. Check OpenAI API status: https://status.openai.com/
4. Verify Redis is caching (check "Cache Hit" indicator in results)

---

### Issue: Build errors in shared package

**Error:** "Cannot find module '@sql-optimizer/shared'"

**Solution:**
```bash
cd packages/shared
npm install
npm run build

# Verify dist folder was created
ls -la dist/
```

---

### Helpful Commands

```bash
# View Docker logs
docker-compose logs -f mysql
docker-compose logs -f redis

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Remove volumes and start fresh
docker-compose down -v
docker-compose up -d

# View backend logs
cd packages/backend
npm run dev

# View frontend logs
cd packages/frontend
npm run dev

# Test backend API directly
curl -X POST http://localhost:3001/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT * FROM users LIMIT 1","includeIndexRecommendations":false}'
```

---

## Next Steps

Once everything is running:

1. **Explore the Sample Data**: Check out the pre-loaded tables
2. **Try Different Queries**: Test various SQL patterns
3. **Enable Index Recommendations**: See what indexes the AI suggests
4. **Check Cache Performance**: Run the same query twice and compare times
5. **Review the Code**: Explore the monorepo structure

---

## Additional Resources

- **Project Plan**: See `PROJECT_PLAN.md` for architecture details
- **API Documentation**: See `README.md` for API endpoint details
- **OpenAI API**: https://platform.openai.com/docs/
- **MySQL Documentation**: https://dev.mysql.com/doc/
- **Redis Documentation**: https://redis.io/documentation

---

## Getting Help

If you encounter issues not covered here:

1. Check the logs in both backend and frontend terminals
2. Verify all prerequisites are installed correctly
3. Ensure all services are running (MySQL, Redis, Backend, Frontend)
4. Review the `PROJECT_PLAN.md` for detailed implementation details

---

**Happy Optimizing! 🚀**

