import { Request, Response } from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent';
import Experiment from '../models/Experiment';
import Project from '../models/Project';

const ensureProjectOwner = async (projectId: string, userId: string) => {
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

export const trackEvent = async (req: Request, res: Response) => {
    try {
        const { projectId, pageId, type, x, y, element, meta, experimentId, variant } = req.body;
        if (!projectId || !type) {
            return res.status(400).json({ message: 'projectId and type are required' });
        }

        // @ts-ignore
        await ensureProjectOwner(projectId, req.user._id);

        const event = await AnalyticsEvent.create({
            projectId,
            pageId,
            type,
            x,
            y,
            element,
            meta,
            experimentId,
            variant,
        });

        res.status(201).json(event);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

export const getSummary = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const since = req.query.since ? new Date(req.query.since as string) : null;

        // @ts-ignore
        await ensureProjectOwner(projectId, req.user._id);

        const match: Record<string, unknown> = { projectId };
        if (since) match.createdAt = { $gte: since };

        const totals = await AnalyticsEvent.countDocuments(match);

        const byType = await AnalyticsEvent.aggregate([
            { $match: match },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        const byPage = await AnalyticsEvent.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$pageId',
                    events: { $sum: 1 },
                    pageViews: {
                        $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] }
                    },
                    clicks: {
                        $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] }
                    },
                    formSubmits: {
                        $sum: { $cond: [{ $eq: ['$type', 'form_submit'] }, 1, 0] }
                    },
                },
            },
            { $sort: { events: -1 } },
        ]);

        res.json({ totals, byType, byPage });
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

export const getHeatmap = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const pageId = req.query.pageId as string | undefined;
        const grid = parseInt(req.query.grid as string) || 24;

        // @ts-ignore
        await ensureProjectOwner(projectId, req.user._id);

        const match: Record<string, unknown> = { projectId, type: 'click' };
        if (pageId) match.pageId = pageId;

        const points = await AnalyticsEvent.aggregate([
            { $match: match },
            {
                $project: {
                    x: { $floor: { $divide: ['$x', grid] } },
                    y: { $floor: { $divide: ['$y', grid] } },
                },
            },
            {
                $group: {
                    _id: { x: '$x', y: '$y' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
        ]);

        res.json({ grid, points });
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// ============================================================================
// EXPERIMENTS
// ============================================================================

export const getExperiments = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        // @ts-ignore
        await ensureProjectOwner(projectId, req.user._id);
        // @ts-ignore - Mongoose accepts strings for ObjectId at runtime
        const experiments = await Experiment.find({ projectId }).sort({ updatedAt: -1 });
        res.json(experiments);
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

export const createExperiment = async (req: Request, res: Response) => {
    try {
        const { projectId, name, pageId, variants, status } = req.body;
        if (!projectId || !name) {
            return res.status(400).json({ message: 'projectId and name are required' });
        }
        // @ts-ignore
        await ensureProjectOwner(projectId, req.user._id);

        const experiment = await Experiment.create({
            projectId,
            name,
            pageId,
            variants: variants || [],
            status: status || 'draft',
        });
        res.status(201).json(experiment);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

export const updateExperiment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const experiment = await Experiment.findById(id);
        if (!experiment) return res.status(404).json({ message: 'Experiment not found' });

        // @ts-ignore
        await ensureProjectOwner(experiment.projectId.toString(), req.user._id);

        const { name, pageId, variants, status } = req.body;
        if (name !== undefined) experiment.name = name;
        if (pageId !== undefined) experiment.pageId = pageId;
        if (variants !== undefined) experiment.variants = variants;
        if (status !== undefined) experiment.status = status;

        const updated = await experiment.save();
        res.json(updated);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

export const deleteExperiment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const experiment = await Experiment.findById(id);
        if (!experiment) return res.status(404).json({ message: 'Experiment not found' });

        // @ts-ignore
        await ensureProjectOwner(experiment.projectId.toString(), req.user._id);

        await experiment.deleteOne();
        res.json({ message: 'Experiment removed' });
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

export const getExperimentStats = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const experiment = await Experiment.findById(id);
        if (!experiment) return res.status(404).json({ message: 'Experiment not found' });

        // @ts-ignore
        await ensureProjectOwner(experiment.projectId.toString(), req.user._id);

        const stats = await AnalyticsEvent.aggregate([
            { $match: { experimentId: experiment._id } },
            { $group: { _id: '$variant', events: { $sum: 1 } } },
        ]);

        res.json({ experimentId: experiment._id, stats });
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
