import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { simpleGit } from 'simple-git';
import fs from 'fs-extra';

async function getGit(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !project.rootPath) {
        throw new Error('Project not tracked in git');
    }
    if (!fs.existsSync(project.rootPath)) {
        throw new Error('Project path does not exist');
    }
    return simpleGit(project.rootPath);
}

export async function getStatus(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const git = await getGit(projectId);
        const status = await git.status();
        res.json(status);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function getHistory(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const git = await getGit(projectId);
        const log = await git.log({ maxCount: limit });
        res.json(log.all);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function commitChanges(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const { message, files } = req.body;
        const git = await getGit(projectId);

        await git.add(files || '.');
        const commit = await git.commit(message);
        res.json(commit);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function getDiff(req: Request, res: Response) {
    try {
        const { projectId } = req.params;
        const { commitId } = req.query;
        const git = await getGit(projectId);

        const diff = await git.diff(commitId ? [String(commitId)] : []);
        res.send(diff);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
