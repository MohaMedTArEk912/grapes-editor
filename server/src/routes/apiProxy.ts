import { Router } from 'express';
import * as ctrl from '../controllers/apiProxyController.js';

const router = Router();

router.post('/', ctrl.proxyRequest);

export default router;
