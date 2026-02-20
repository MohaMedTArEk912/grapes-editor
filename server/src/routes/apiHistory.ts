import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

function parseJSON(str: string, fallback: any = {}) {
    try { return JSON.parse(str); } catch { return fallback; }
}

function toResponse(r: any) {
    return {
        id: r.id,
        project_id: r.projectId,
        method: r.method,
        url: r.url,
        headers: parseJSON(r.headers, {}),
        body: r.body || '',
        params: parseJSON(r.params, {}),
        response_status: r.responseStatus,
        response_headers: parseJSON(r.responseHeaders, {}),
        response_body: r.responseBody || '',
        duration: r.duration || 0,
        created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    };
}

// GET /api/api-history?projectId=X — List recent requests (newest first, max 100)
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const requests = await prisma.apiRequest.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        res.json(requests.map(toResponse));
    } catch (error) {
        console.error('Error listing API history:', error);
        res.status(500).json({ error: 'Failed to list API history' });
    }
});

// POST /api/api-history — Save a request
router.post('/', async (req, res) => {
    try {
        const { projectId, method, url, headers, body, params, responseStatus, responseHeaders, responseBody, duration } = req.body;

        if (!projectId || !url) {
            res.status(400).json({ error: 'Project ID and URL are required' });
            return;
        }

        const entry = await prisma.apiRequest.create({
            data: {
                projectId,
                method: method || 'GET',
                url,
                headers: JSON.stringify(headers || {}),
                body: typeof body === 'string' ? body : JSON.stringify(body || ''),
                params: JSON.stringify(params || {}),
                responseStatus: responseStatus || null,
                responseHeaders: JSON.stringify(responseHeaders || {}),
                responseBody: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || ''),
                duration: duration || 0,
            },
        });

        res.json(toResponse(entry));
    } catch (error) {
        console.error('Error saving API history:', error);
        res.status(500).json({ error: 'Failed to save API history' });
    }
});

// DELETE /api/api-history/:id — Delete a history entry
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.apiRequest.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting API history:', error);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// DELETE /api/api-history/clear/:projectId — Clear all history for a project
router.delete('/clear/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        await prisma.apiRequest.deleteMany({ where: { projectId } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing API history:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

export default router;
