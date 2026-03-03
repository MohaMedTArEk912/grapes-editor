import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { GeneratorService } from '../services/generator.js';
import { SyncService } from '../services/sync.js';

const generatorService = new GeneratorService();

export async function syncProject(req: Request, res: Response) {
    try {
        const { projectId } = req.body;
        if (!projectId) { res.status(400).json({ error: 'Project ID required' }); return; }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || !project.rootPath) {
            res.status(404).json({ error: 'Project not found or no root path' });
            return;
        }

        const syncService = new SyncService(project.rootPath);
        const pages = await prisma.page.findMany({ where: { projectId } });
        for (const page of pages) {
            await syncService.syncPageToDisk(page.id, projectId);
        }

        res.json({ success: true, message: 'Project synced to disk' });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync project' });
    }
}

export async function exportProject(req: Request, res: Response) {
    try {
        const { projectId, exportPath } = req.body;
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error("Project not found");

        const targetDir = exportPath || project.rootPath;
        if (!targetDir) throw new Error("No target directory specified");

        const result = await generatorService.generateFrontend(projectId, targetDir);
        res.json(result);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export project' });
    }
}
