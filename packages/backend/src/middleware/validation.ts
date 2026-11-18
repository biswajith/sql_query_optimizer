import { Request, Response, NextFunction } from 'express';
import { OptimizationRequestSchema } from '@sql-optimizer/shared';
import { AppError, ErrorType } from './errorHandler';

export function validateOptimizationRequest(req: Request, res: Response, next: NextFunction) {
  const parsed = OptimizationRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    return next(
      new AppError(ErrorType.VALIDATION_ERROR, `Invalid request body: ${detail}`, 400)
    );
  }

  req.body = parsed.data;
  next();
}
