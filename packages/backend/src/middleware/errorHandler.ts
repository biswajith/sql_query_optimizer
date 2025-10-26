import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    logger.error(`${err.type}: ${err.message}`, err.details);
    
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      type: err.type,
    });
  }
  
  // Unknown error
  logger.error('Unhandled error:', err);
  
  return res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
    type: ErrorType.INTERNAL_ERROR,
  });
}

