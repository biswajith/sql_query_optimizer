import { Router } from 'express';
import { optimizeQuery, healthCheck } from '../controllers/optimizerController';
import { validateOptimizationRequest } from '../middleware/validation';

const router = Router();

router.post('/optimize', validateOptimizationRequest, optimizeQuery);
router.get('/health', healthCheck);

export default router;

