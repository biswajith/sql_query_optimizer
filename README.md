# SQL Query Optimizer

A TypeScript-based monorepo application that analyzes SQL queries and provides optimization suggestions with a LangChain tool-using agent (default model: OpenAI GPT-6 Luna, configurable via LLM_MODEL), with table schema caching in Redis.

## Features

- 🚀 **AI-Powered Optimization**: An agent proposes rewrites, checks each with EXPLAIN, and the server verifies the final query's cost
- 🔒 **Deterministic SQL Guard**: A SQL parser accepts only a single read-only SELECT; the backend uses a read-only MySQL user
- ⚡ **Redis Caching**: Caches table schemas and indexes for faster repeated queries
- 📊 **EXPLAIN Plan Analysis**: Generates and displays MySQL EXPLAIN plans
- 🎨 **Modern UI**: Built with React and Adobe Spectrum design system
- 🔍 **Table Schema Insights**: Shows complete table structures and indexes
- 💡 **Index Recommendations**: Optional suggestions for creating new indexes

## Architecture

This is a monorepo containing three packages:

- **`packages/shared`**: Shared TypeScript types and utilities
- **`packages/backend`**: Express.js API server with MySQL, Redis, and OpenAI integration
- **`packages/frontend`**: React frontend with Adobe Spectrum UI

## Prerequisites

- **Node.js**: 20.x or higher
- **npm**: 9.x or higher
- **MySQL**: 5.7 or higher (or use Docker)
- **Redis**: 7.x or higher (or use Docker)
- **OpenAI API Key**: Required for LLM features

## Quick Start

### 1. Clone and Install Dependencies

```bash
cd sql_query_optimizer
npm install
```

### 2. Start MySQL and Redis

**Option A: Using Docker (Recommended for Quick Setup)**

```bash
docker-compose up -d
```

This will start:
- MySQL 8.0 on `localhost:3306` with sample data
- Redis 7 on `localhost:6379`

**Option B: Using Local Installations (No Docker)**

If you prefer to use locally installed MySQL and Redis:

```bash
# Use the provided script (macOS/Linux)
./start-local.sh

# OR start services manually:
# MySQL: brew services start mysql  (macOS) or systemctl start mysql (Linux)
# Redis: brew services start redis  (macOS) or systemctl start redis (Linux)
```

📖 **See `SETUP_WITHOUT_DOCKER.md` for detailed instructions on local installation**

### 3. Configure Environment Variables

Create `.env` file in the backend package:

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env` and add your OpenAI API key:

```env
# Server
PORT=3001
NODE_ENV=development

# MySQL (using Docker defaults)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=optimizer_ro
MYSQL_PASSWORD=optimizer_ro_pass
MYSQL_DATABASE=testdb

# Redis (using Docker defaults)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=3600

# OpenAI - ADD YOUR KEY HERE
OPENAI_API_KEY=sk-your-actual-api-key-here
LLM_MODEL=openai:gpt-6-luna

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 4. Build Shared Package

```bash
cd packages/shared
npm install
npm run build
cd ../..
```

### 5. Start Backend Server

```bash
cd packages/backend
npm install
npm run dev
```

Backend will start on `http://localhost:3001`

### 6. Start Frontend (in a new terminal)

```bash
cd packages/frontend
npm install
npm run dev
```

Frontend will start on `http://localhost:5173`

## Usage

1. Open your browser to `http://localhost:5173`
2. Enter a SQL query in the text area (example below)
3. Optionally enable "Include Index Recommendations"
4. Click "Optimize Query"
5. View the optimization results, EXPLAIN plan, and suggestions

### Example Queries

**Simple Query:**
```sql
SELECT * FROM users WHERE email = 'john.doe@example.com'
```

**Join Query (good for testing optimization):**
```sql
SELECT u.username, o.order_date, o.total_amount
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status = 'pending'
ORDER BY o.order_date DESC
```

**Complex Query with Multiple Joins:**
```sql
SELECT u.username, p.name, oi.quantity, o.order_date
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE p.category = 'Electronics'
AND o.status IN ('shipped', 'delivered')
```

## API Endpoints

### POST `/api/optimize`

Optimize a SQL query.

**Request:**
```json
{
  "query": "SELECT * FROM users WHERE email = 'test@example.com'",
  "includeIndexRecommendations": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalQuery": "...",
    "optimizedQuery": "...",
    "explainPlan": [...],
    "tables": [...],
    "indexes": [...],
    "reasoning": "...",
    "cacheHit": true
  }
}
```

### GET `/api/health`

Check service health status.

**Response:**
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

## Security Features

### LLM-Based Query Validation

The optimizer includes a critical security layer that validates all SQL queries before execution:

- ✅ **Allowed**: `SELECT`, `EXPLAIN`, `SHOW CREATE TABLE`, `SHOW INDEX`
- ❌ **Blocked**: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, etc.

This prevents accidental or malicious database modifications.

## Development

### Project Structure

```
sql_query_optimizer/
├── packages/
│   ├── shared/              # Shared types
│   │   └── src/types/
│   ├── backend/             # Express API
│   │   └── src/
│   │       ├── config/      # Database, Redis, LLM configs
│   │       ├── services/    # Business logic
│   │       ├── controllers/ # Request handlers
│   │       ├── middleware/  # Express middleware
│   │       └── routes/      # API routes
│   └── frontend/            # React UI
│       └── src/
│           ├── components/  # UI components
│           ├── hooks/       # React hooks
│           └── services/    # API client
├── docker-compose.yml       # Docker services
├── init.sql                 # Sample database
└── package.json            # Workspace config
```

### Running Without Docker

If you prefer to use local MySQL and Redis installations:

1. **Install MySQL** (5.7+) and **Redis** (7+) locally
2. **Start services**: Use `./start-local.sh` or start manually
3. **Create database**: `mysql -u root -p -e "CREATE DATABASE testdb;"`
4. **Import sample data**: `mysql -u root -p testdb < init.sql`
5. **Update `.env`** file with your local credentials

📖 **See `SETUP_WITHOUT_DOCKER.md` for complete step-by-step instructions**

### Troubleshooting

**Backend won't start:**
- Check MySQL and Redis are running: `docker-compose ps`
- Verify OpenAI API key is set in `.env`
- Check logs for connection errors

**Frontend can't connect to backend:**
- Ensure backend is running on port 3001
- Check CORS settings in backend `.env`

**Query validation failing:**
- This is a security feature - only SELECT queries are allowed
- Check if your query contains destructive operations

**Cache not working:**
- Verify Redis is running: `redis-cli ping` should return `PONG`
- Check Redis connection in health endpoint: `curl http://localhost:3001/api/health`

## Technology Stack

### Backend
- **Node.js** + **TypeScript**
- **Express.js** - Web framework
- **MySQL2** - Database client
- **ioredis** - Redis client
- **LangChain.js** - LLM orchestration
- **LangChain v1 agent** - Query optimization (default model OpenAI GPT-6 Luna)

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Adobe React Spectrum** - UI component library
- **Axios** - HTTP client

### Infrastructure
- **Docker** + **Docker Compose** - Local development
- **Redis** - Caching layer
- **MySQL 8.0** - Database

## Performance

- **Redis Caching**: Table schemas and indexes are cached for 1 hour
- **Query Validation Caching**: Validation results cached to reduce LLM calls
- **Parallel Fetching**: Table schemas and indexes fetched in parallel
- **Average Response Time**: 2-5 seconds for first query, <1 second for cached schemas

## Cost Considerations

Each optimization request is one agent run: one model call per round, with up to 6 EXPLAIN tool calls. Safety checks and table extraction use a SQL parser and make no model calls. Cost depends on the model set in `LLM_MODEL`; see your provider's pricing.

Redis caches table schemas and indexes, which saves MySQL round trips, not model calls.

## Future Enhancements

See `PROJECT_PLAN.md` for detailed roadmap, including:
- Query history and comparison
- Advanced visualizations (execution plan trees, performance graphs)
- Multi-database support (PostgreSQL)
- Batch query processing
- User authentication

## License

MIT

## Contributing

This is a demonstration project. For production use, consider:
- Adding authentication and authorization
- Implementing query result caching
- Adding comprehensive error handling
- Setting up monitoring and logging
- Implementing rate limiting per user
- Adding unit and integration tests

## Support

For issues or questions, please refer to the `PROJECT_PLAN.md` for detailed documentation.

