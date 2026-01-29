import { Request, Response } from 'express';
import Template from '../models/Template';
import Project from '../models/Project';

const requireProjectOwner = async (projectId: string, userId: string) => {
    const project = await Project.findById(projectId);
    if (!project) {
        const error = new Error('Project not found');
        // @ts-ignore
        error.status = 404;
        throw error;
    }
    // @ts-ignore
    if (project.owner.toString() !== userId.toString()) {
        const error = new Error('Not authorized');
        // @ts-ignore
        error.status = 401;
        throw error;
    }
    return project;
};

/**
 * @desc    List templates
 * @route   GET /api/templates
 * @access  Private
 */
export const getTemplates = async (req: Request, res: Response) => {
    try {
        const scope = (req.query.scope as string) || 'public';
        const projectId = req.query.projectId as string | undefined;

        const query: Record<string, unknown> = {};
        if (scope === 'public') {
            query.status = 'public';
        } else if (scope === 'project') {
            if (!projectId) {
                return res.status(400).json({ message: 'projectId is required for project scope' });
            }
            // @ts-ignore
            await requireProjectOwner(projectId, req.user._id);
            query.projectId = projectId;
        }

        const templates = await Template.find(query).sort({ updatedAt: -1 });
        res.json(templates);
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

/**
 * @desc    Create template
 * @route   POST /api/templates
 * @access  Private
 */
export const createTemplate = async (req: Request, res: Response) => {
    try {
        const { projectId, name, description, type, tags, previewImage, content, status } = req.body;
        if (!projectId || !name || !type) {
            return res.status(400).json({ message: 'projectId, name, and type are required' });
        }

        // @ts-ignore
        await requireProjectOwner(projectId, req.user._id);

        const template = await Template.create({
            projectId,
            name,
            description,
            type,
            tags: tags || [],
            previewImage,
            content: content || {},
            status: status || 'private',
        });

        res.status(201).json(template);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

/**
 * @desc    Update template
 * @route   PUT /api/templates/:id
 * @access  Private
 */
export const updateTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const template = await Template.findById(id);
        if (!template) return res.status(404).json({ message: 'Template not found' });

        // @ts-ignore
        await requireProjectOwner(template.projectId.toString(), req.user._id);

        const { name, description, tags, previewImage, content, status } = req.body;
        if (name !== undefined) template.name = name;
        if (description !== undefined) template.description = description;
        if (tags !== undefined) template.tags = tags;
        if (previewImage !== undefined) template.previewImage = previewImage;
        if (content !== undefined) template.content = content;
        if (status !== undefined) template.status = status;

        const updated = await template.save();
        res.json(updated);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

/**
 * @desc    Delete template
 * @route   DELETE /api/templates/:id
 * @access  Private
 */
export const deleteTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const template = await Template.findById(id);
        if (!template) return res.status(404).json({ message: 'Template not found' });

        // @ts-ignore
        await requireProjectOwner(template.projectId.toString(), req.user._id);

        await template.deleteOne();
        res.json({ message: 'Template removed' });
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

/**
 * @desc    Publish/unpublish template
 * @route   POST /api/templates/:id/publish
 * @access  Private
 */
export const publishTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body as { status?: 'private' | 'public' };

        const template = await Template.findById(id);
        if (!template) return res.status(404).json({ message: 'Template not found' });

        // @ts-ignore
        await requireProjectOwner(template.projectId.toString(), req.user._id);

        template.status = status || 'public';
        const updated = await template.save();
        res.json(updated);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};
