import { Router } from 'express';
import * as ctrl from '../controllers/logicFlowsController.js';

const router = Router();

router.get('/', ctrl.listLogicFlows);
router.post('/', ctrl.createLogicFlow);
router.put('/:id', ctrl.updateLogicFlow);
router.delete('/:id', ctrl.deleteLogicFlow);

export default router;
