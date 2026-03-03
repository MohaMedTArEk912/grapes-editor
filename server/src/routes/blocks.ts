import { Router } from 'express';
import * as ctrl from '../controllers/blocksController.js';

const router = Router();

router.post('/sync', ctrl.syncBlocks);

export default router;
