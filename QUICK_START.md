# Quick Start Guide

Get the SQL Query Optimizer running in 5 minutes!

## Prerequisites

- Node.js 18+
- Docker Desktop
- OpenAI API key

## Setup

### 1. Install Dependencies (1 min)

```bash
npm install
cd packages/shared && npm install && npm run build && cd ../..
```

### 2. Start Services (30 seconds)

```bash
docker-compose up -d
```

Wait for services to be ready (~30 seconds).

### 3. Configure OpenAI API Key (30 seconds)

```bash
# Create .env file
cp packages/backend/.env.example packages/backend/.env

# Edit and add your OpenAI API key
nano packages/backend/.env
# OR use your favorite editor:
# code packages/backend/.env
# vim packages/backend/.env
```

Replace `sk-your-openai-api-key-here` with your actual key.

### 4. Start Backend (1 min)

```bash
cd packages/backend
npm install
npm run dev
```

Keep this terminal open. You should see:
```
[INFO] Server running on port 3001
```

### 5. Start Frontend (1 min)

In a NEW terminal:

```bash
cd packages/frontend
npm install
npm run dev
```

### 6. Open Application

Navigate to: **http://localhost:5173**

## First Test

Try this query:

```sql
SELECT u.username, o.order_date, o.total_amount
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status = 'pending'
```

Click **"Optimize Query"** and see the magic! ✨

## Troubleshooting

**Backend won't start?**
- Check OpenAI API key is set correctly in `.env`
- Verify Docker containers are running: `docker-compose ps`

**Frontend can't connect?**
- Make sure backend is running on port 3001
- Check terminal for error messages

**Need more help?**
- See `SETUP_GUIDE.md` for detailed troubleshooting
- Check `README.md` for full documentation

## What's Next?

- Try different queries
- Enable "Include Index Recommendations"
- Check out the EXPLAIN plans
- Explore the sample database tables

---

Enjoy optimizing! 🚀

