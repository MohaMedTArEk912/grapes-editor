import { Router } from 'express';
import {
    trackEvent,
    getSummary,
    getHeatmap,
    getExperiments,
    createExperiment,
    updateExperiment,
    deleteExperiment,
    getExperimentStats,
} from '../controllers/analytics.controller';

const router = Router();

router.post('/track', trackEvent);
router.get('/summary/:projectId', getSummary);
router.get('/heatmap/:projectId', getHeatmap);

router.get('/experiments/:projectId', getExperiments);
router.post('/experiments', createExperiment);
router.put('/experiments/:id', updateExperiment);
router.delete('/experiments/:id', deleteExperiment);
router.get('/experiments/:id/stats', getExperimentStats);

export default router;
