import express from 'express';
import {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
} from '../controllers/project.controller';

const router = express.Router();

router.route('/').get(getProjects).post(createProject);
router.route('/:id').get(getProject).put(updateProject).delete(deleteProject);

export default router;
