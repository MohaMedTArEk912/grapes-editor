import express from 'express';
import { deployVercel, deployNetlify, scheduleVercel, scheduleNetlify, getSchedules, provisionDomain, refreshSslStatus } from '../controllers/publish.controller';

const router = express.Router();

router.post('/vercel', deployVercel);
router.post('/netlify', deployNetlify);
router.post('/vercel/schedule', scheduleVercel);
router.post('/netlify/schedule', scheduleNetlify);
router.get('/schedules/:projectId', getSchedules);
router.post('/domain/provision', provisionDomain);
router.get('/domain/:projectId/ssl', refreshSslStatus);

export default router;