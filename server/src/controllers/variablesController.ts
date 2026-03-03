import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

export async function listVariables(req: Request, res: Response) {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const vars = await prisma.variable.findMany({
            where: { projectId },
            orderBy: { name: 'asc' }
        });

        const response = vars.map(v => ({
            id: v.id, name: v.name,
            variable_type: v.type,
            scope: 'global',
            default_value: v.value ? JSON.parse(v.value) : null,
            archived: false
        }));

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list variables' });
    }
}

export async function createVariable(req: Request, res: Response) {
    try {
        const { projectId, name, variable_type, default_value, isSecret } = req.body;

        const v = await prisma.variable.create({
            data: {
                projectId, name,
                type: variable_type,
                value: JSON.stringify(default_value),
                isSecret: !!isSecret
            }
        });

        res.json({
            id: v.id, name: v.name,
            variable_type: v.type,
            scope: 'global',
            default_value: default_value
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
}

export async function deleteVariable(req: Request, res: Response) {
    try {
        const { id } = req.params;
        await prisma.variable.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
}
