import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import optimizerRoutes from './routes/optimizer.routes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { getModelName } from './config/llm';
import { getRedisClient } from './config/redis';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Middleware
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api', optimizerRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SQL Query Optimizer API',
    version: '1.0.0',
    endpoints: {
      optimize: 'POST /api/optimize',
      health: 'GET /api/health',
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`CORS enabled for: ${CORS_ORIGIN}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Model: ${getModelName()}`);
  // Connect to Redis up front so the first request can use the cache.
  getRedisClient();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;

