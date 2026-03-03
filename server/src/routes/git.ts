import { Router } from 'express';
import * as ctrl from '../controllers/gitController.js';

const router = Router();

router.get('/:projectId/status', ctrl.getStatus);
router.get('/:projectId/history', ctrl.getHistory);
router.post('/:projectId/commit', ctrl.commitChanges);
router.get('/:projectId/diff', ctrl.getDiff);

export default router;
