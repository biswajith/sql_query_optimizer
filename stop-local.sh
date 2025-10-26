#!/bin/bash

# Stop Local Services (MySQL and Redis) - macOS/Linux

echo "🛑 Stopping SQL Query Optimizer Services..."
echo ""

# Detect OS
OS="$(uname -s)"

# Stop MySQL
echo "📦 Stopping MySQL..."
case "$OS" in
  Darwin*)  # macOS
    if command -v brew &> /dev/null; then
      brew services stop mysql 2>/dev/null || mysql.server stop
    else
      mysql.server stop
    fi
    ;;
  Linux*)
    sudo systemctl stop mysql 2>/dev/null || sudo systemctl stop mysqld
    ;;
  *)
    echo "⚠️  Unknown OS. Please stop MySQL manually."
    ;;
esac

# Stop Redis
echo "🔴 Stopping Redis..."
case "$OS" in
  Darwin*)  # macOS
    if command -v brew &> /dev/null; then
      brew services stop redis 2>/dev/null || pkill redis-server
    else
      pkill redis-server
    fi
    ;;
  Linux*)
    sudo systemctl stop redis-server 2>/dev/null || sudo systemctl stop redis
    ;;
  *)
    echo "⚠️  Unknown OS. Please stop Redis manually."
    ;;
esac

echo ""
echo "✅ Services stopped!"
echo ""

