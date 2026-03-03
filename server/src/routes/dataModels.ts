import { Router } from 'express';
import * as ctrl from '../controllers/dataModelsController.js';

const router = Router();

router.get('/', ctrl.listDataModels);
router.post('/', ctrl.createDataModel);
router.put('/:id', ctrl.updateDataModel);
router.delete('/:id', ctrl.deleteDataModel);

export default router;
