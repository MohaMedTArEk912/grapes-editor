import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Helper to parse JSON fields safely
function parseJSON(str: string, fallback: any = []) {
    try { return JSON.parse(str); } catch { return fallback; }
}

// Transform Prisma UseCase to API response shape (snake_case)
function toUseCaseResponse(uc: any) {
    return {
        id: uc.id,
        project_id: uc.projectId,
        name: uc.name,
        description: uc.description || '',
        actors: parseJSON(uc.actors, []),
        preconditions: uc.preconditions || '',
        postconditions: uc.postconditions || '',
        steps: parseJSON(uc.steps, []),
        priority: uc.priority || 'medium',
        status: uc.status || 'draft',
        category: uc.category || '',
        created_at: uc.createdAt instanceof Date ? uc.createdAt.toISOString() : uc.createdAt,
        updated_at: uc.updatedAt instanceof Date ? uc.updatedAt.toISOString() : uc.updatedAt,
        archived: uc.archived || false,
    };
}

// GET /api/usecases?projectId=X - List all use cases for a project
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const useCases = await prisma.useCase.findMany({
            where: { projectId, archived: false },
            orderBy: { createdAt: 'desc' },
        });

        res.json(useCases.map(toUseCaseResponse));
    } catch (error) {
        console.error('Error listing use cases:', error);
        res.status(500).json({ error: 'Failed to list use cases' });
    }
});

// POST /api/usecases - Create a new use case
router.post('/', async (req, res) => {
    try {
        const { projectId, name, description, actors, preconditions, postconditions, steps, priority, status, category } = req.body;

        if (!projectId || !name) {
            res.status(400).json({ error: 'Project ID and name are required' });
            return;
        }

        const useCase = await prisma.useCase.create({
            data: {
                projectId,
                name,
                description: description || '',
                actors: JSON.stringify(actors || []),
                preconditions: preconditions || '',
                postconditions: postconditions || '',
                steps: JSON.stringify(steps || []),
                priority: priority || 'medium',
                status: status || 'draft',
                category: category || '',
            },
        });

        res.json(toUseCaseResponse(useCase));
    } catch (error) {
        console.error('Error creating use case:', error);
        res.status(500).json({ error: 'Failed to create use case' });
    }
});

// PUT /api/usecases/:id - Update a use case
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, actors, preconditions, postconditions, steps, priority, status, category } = req.body;

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (actors !== undefined) data.actors = JSON.stringify(actors);
        if (preconditions !== undefined) data.preconditions = preconditions;
        if (postconditions !== undefined) data.postconditions = postconditions;
        if (steps !== undefined) data.steps = JSON.stringify(steps);
        if (priority !== undefined) data.priority = priority;
        if (status !== undefined) data.status = status;
        if (category !== undefined) data.category = category;

        const useCase = await prisma.useCase.update({
            where: { id },
            data,
        });

        res.json(toUseCaseResponse(useCase));
    } catch (error) {
        console.error('Error updating use case:', error);
        res.status(500).json({ error: 'Failed to update use case' });
    }
});

// DELETE /api/usecases/:id - Soft-delete a use case
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.useCase.update({
            where: { id },
            data: { archived: true },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting use case:', error);
        res.status(500).json({ error: 'Failed to delete use case' });
    }
});

export default router;
