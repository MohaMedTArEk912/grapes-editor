import { Router } from 'express';
import * as ctrl from '../controllers/workspaceController.js';

const router = Router();

router.get('/', ctrl.getWorkspace);

export default router;
