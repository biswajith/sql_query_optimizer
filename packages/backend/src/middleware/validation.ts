import { Request, Response, NextFunction } from 'express';
import { OptimizationRequestSchema } from '@sql-optimizer/shared';
import { AppError, ErrorType } from './errorHandler';
import { logger } from '../utils/logger';

export function validateOptimizationRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validated = OptimizationRequestSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error: any) {
    logger.warn('Validation error:', error);
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'Invalid request body: ' + error.message,
      400,
      error.errors
    );
  }
}

