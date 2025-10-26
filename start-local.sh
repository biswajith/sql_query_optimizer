#!/bin/bash

# Start Local Services (MySQL and Redis) - macOS/Linux

echo "🚀 Starting SQL Query Optimizer Services..."
echo ""

# Detect OS
OS="$(uname -s)"

# Start MySQL
echo "📦 Starting MySQL..."
case "$OS" in
  Darwin*)  # macOS
    if command -v brew &> /dev/null; then
      brew services start mysql 2>/dev/null || mysql.server start
    else
      mysql.server start
    fi
    ;;
  Linux*)
    sudo systemctl start mysql 2>/dev/null || sudo systemctl start mysqld
    ;;
  *)
    echo "⚠️  Unknown OS. Please start MySQL manually."
    ;;
esac

# Start Redis
echo "🔴 Starting Redis..."
case "$OS" in
  Darwin*)  # macOS
    if command -v brew &> /dev/null; then
      brew services start redis 2>/dev/null || redis-server --daemonize yes
    else
      redis-server --daemonize yes
    fi
    ;;
  Linux*)
    sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis
    ;;
  *)
    echo "⚠️  Unknown OS. Please start Redis manually."
    ;;
esac

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 3

# Verify MySQL
echo ""
echo "✅ Checking MySQL..."
if mysql -e "SELECT 1;" &>/dev/null; then
  echo "   MySQL is running on localhost:3306"
else
  echo "   ⚠️  MySQL may not be running. Check credentials or start manually."
fi

# Verify Redis
echo ""
echo "✅ Checking Redis..."
if redis-cli ping &>/dev/null; then
  echo "   Redis is running on localhost:6379"
else
  echo "   ⚠️  Redis is not running. Start manually with: redis-server"
fi

echo ""
echo "🎉 Services started!"
echo ""
echo "Next steps:"
echo "  1. Configure backend: cp packages/backend/.env.example packages/backend/.env"
echo "  2. Start backend: cd packages/backend && npm run dev"
echo "  3. Start frontend: cd packages/frontend && npm run dev"
echo ""

