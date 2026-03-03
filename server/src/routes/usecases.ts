import { Router } from 'express';
import * as ctrl from '../controllers/usecasesController.js';

const router = Router();

router.get('/', ctrl.listUseCases);
router.post('/', ctrl.createUseCase);
router.put('/:id', ctrl.updateUseCase);
router.delete('/:id', ctrl.deleteUseCase);

export default router;
