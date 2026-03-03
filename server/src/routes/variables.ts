import { Router } from 'express';
import * as ctrl from '../controllers/variablesController.js';

const router = Router();

router.get('/', ctrl.listVariables);
router.post('/', ctrl.createVariable);
router.delete('/:id', ctrl.deleteVariable);

export default router;
