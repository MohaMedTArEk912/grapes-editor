import { Router } from 'express';
import {
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    publishTemplate,
} from '../controllers/template.controller';

const router = Router();

router.get('/', getTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/publish', publishTemplate);

export default router;
