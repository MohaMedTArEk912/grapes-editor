import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

export async function listLogicFlows(req: Request, res: Response) {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const flows = await prisma.logicFlow.findMany({
            where: { projectId, archived: false },
            orderBy: { name: 'asc' }
        });

        const hydrated = flows.map(f => ({
            ...f,
            trigger: JSON.parse(f.trigger),
            nodes: JSON.parse(f.nodes),
            edges: JSON.parse(f.edges)
        }));

        res.json(hydrated);
    } catch (error) {
        console.error('Error listing logic flows:', error);
        res.status(500).json({ error: 'Failed to list logic flows' });
    }
}

export async function createLogicFlow(req: Request, res: Response) {
    try {
        const { projectId, name, context } = req.body;
        const trigger = { type: 'manual' };
        const nodes: any[] = [];
        const edges: any[] = [];

        const flow = await prisma.logicFlow.create({
            data: {
                projectId,
                name,
                trigger: JSON.stringify(trigger),
                nodes: JSON.stringify(nodes),
                edges: JSON.stringify(edges)
            }
        });

        res.json({ ...flow, trigger, nodes, edges });
    } catch (error) {
        console.error('Error creating logic flow:', error);
        res.status(500).json({ error: 'Failed to create logic flow' });
    }
}

export async function updateLogicFlow(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, trigger, nodes, edges, description } = req.body;

        const updates: any = {};
        if (name) updates.name = name;
        if (trigger) updates.trigger = JSON.stringify(trigger);
        if (nodes) updates.nodes = JSON.stringify(nodes);
        if (edges) updates.edges = JSON.stringify(edges);

        const flow = await prisma.logicFlow.update({
            where: { id },
            data: updates
        });

        res.json({
            ...flow,
            trigger: JSON.parse(flow.trigger),
            nodes: JSON.parse(flow.nodes),
            edges: JSON.parse(flow.edges)
        });
    } catch (error) {
        console.error('Error updating logic flow:', error);
        res.status(500).json({ error: 'Failed to update logic flow' });
    }
}

export async function deleteLogicFlow(req: Request, res: Response) {
    try {
        const { id } = req.params;
        await prisma.logicFlow.update({
            where: { id },
            data: { archived: true }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting logic flow:', error);
        res.status(500).json({ error: 'Failed to delete logic flow' });
    }
}
