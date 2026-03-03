import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

export async function getPageContent(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const blocks = await prisma.block.findMany({
            where: { pageId: id },
            orderBy: { order: 'asc' }
        });

        const serializedBlocks = blocks.map(b => ({
            id: b.id,
            block_type: b.blockType,
            name: b.name,
            parent_id: b.parentId,
            properties: JSON.parse(b.properties),
            styles: JSON.parse(b.styles),
            responsive_styles: JSON.parse(b.responsiveStyles),
            classes: JSON.parse(b.classes),
            event_handlers: JSON.parse(b.events),
            bindings: JSON.parse(b.bindings),
            children: JSON.parse(b.children),
            order: b.order
        }));

        res.json({ content: JSON.stringify(serializedBlocks) });
    } catch (error) {
        console.error('Error getting page content:', error);
        res.status(500).json({ error: 'Failed to get page content' });
    }
}

export async function listPages(req: Request, res: Response) {
    res.json([]);
}

export async function createPage(req: Request, res: Response) {
    try {
        const { name, path, projectId } = req.body;
        res.json({ id: 'new-id', name, path });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
}
