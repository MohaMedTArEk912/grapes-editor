import { Router } from 'express';
import * as ctrl from '../controllers/apiHistoryController.js';

const router = Router();

router.get('/', ctrl.listHistory);
router.post('/', ctrl.saveHistory);
router.delete('/:id', ctrl.deleteHistoryEntry);
router.delete('/clear/:projectId', ctrl.clearHistory);

export default router;
