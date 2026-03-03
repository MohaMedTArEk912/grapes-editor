import { Router } from 'express';
import * as ctrl from '../controllers/pagesController.js';

const router = Router();

router.get('/:id/content', ctrl.getPageContent);
router.get('/', ctrl.listPages);
router.post('/', ctrl.createPage);

export default router;
