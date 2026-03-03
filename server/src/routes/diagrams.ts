import { Router } from 'express';
import * as ctrl from '../controllers/diagramsController.js';

const router = Router();

router.get('/', ctrl.listDiagrams);
router.post('/', ctrl.createDiagram);
router.get('/:name', ctrl.getDiagram);
router.delete('/:name', ctrl.deleteDiagram);

export default router;
