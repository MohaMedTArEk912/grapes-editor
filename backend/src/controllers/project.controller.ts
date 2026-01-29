import { Request, Response } from 'express';
import Project from '../models/Project';

// @desc    Get all projects for current user
// @route   GET /api/projects
// @access  Private
export const getProjects = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const projects = await Project.find({ owner: req.user._id }).sort({ updatedAt: -1 });
        res.json(projects);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
export const getProject = async (req: Request, res: Response) => {
    try {
        const project = await Project.findById(req.params.id);

        if (project) {
            // Check ownership
            // @ts-ignore
            if (project.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }
            res.json(project);
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a project
// @route   POST /api/projects
// @access  Private
export const createProject = async (req: Request, res: Response) => {
    try {
        const { name, content, styles, assets, headerHtml, headerCss, footerHtml, footerCss, customDomain, domainProvider, domainStatus, sslStatus, netlifySiteId, vercelProjectName } = req.body;
        const slug = name.toLowerCase().replace(/ /g, '-') + '-' + Date.now();

        const project = new Project({
            name,
            slug,
            content,
            styles,
            assets,
            headerHtml,
            headerCss,
            footerHtml,
            footerCss,
            customDomain,
            domainProvider,
            domainStatus,
            sslStatus,
            netlifySiteId,
            vercelProjectName,
            // @ts-ignore
            owner: req.user._id,
        });

        const createdProject = await project.save();
        res.status(201).json(createdProject);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private
export const updateProject = async (req: Request, res: Response) => {
    try {
        const { name, content, styles, assets, headerHtml, headerCss, footerHtml, footerCss, customDomain, domainProvider, domainStatus, sslStatus, netlifySiteId, vercelProjectName } = req.body;
        const project = await Project.findById(req.params.id);

        if (project) {
            // Check ownership
            // @ts-ignore
            if (project.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            project.name = name || project.name;
            project.content = content || project.content;
            project.styles = styles || project.styles;
            project.assets = assets || project.assets;
            if (headerHtml !== undefined) project.headerHtml = headerHtml;
            if (headerCss !== undefined) project.headerCss = headerCss;
            if (footerHtml !== undefined) project.footerHtml = footerHtml;
            if (footerCss !== undefined) project.footerCss = footerCss;
            if (customDomain !== undefined) project.customDomain = customDomain;
            if (domainProvider !== undefined) project.domainProvider = domainProvider;
            if (domainStatus !== undefined) project.domainStatus = domainStatus;
            if (sslStatus !== undefined) project.sslStatus = sslStatus;
            if (netlifySiteId !== undefined) project.netlifySiteId = netlifySiteId;
            if (vercelProjectName !== undefined) project.vercelProjectName = vercelProjectName;

            const updatedProject = await project.save();
            res.json(updatedProject);
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private
export const deleteProject = async (req: Request, res: Response) => {
    try {
        const project = await Project.findById(req.params.id);

        if (project) {
            // Check ownership
            // @ts-ignore
            if (project.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            await project.deleteOne();
            res.json({ message: 'Project removed' });
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
