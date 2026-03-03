import { Router } from 'express';
import * as ctrl from '../controllers/componentsController.js';

const router = Router();

router.get('/', ctrl.listComponents);
router.post('/', ctrl.createComponent);

export default router;
