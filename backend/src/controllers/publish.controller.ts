import { Request, Response } from 'express';
import crypto from 'crypto';
import PublishSchedule from '../models/PublishSchedule';
import Project from '../models/Project';

const buildStaticHtml = (html: string, css: string) => {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>${css || ''}</style>
  </head>
  <body>${html || ''}</body>
</html>`;
};

/**
 * @desc    Deploy a static build to Vercel
 * @route   POST /api/publish/vercel
 * @access  Private
 */
const deployVercelInternal = async (name: string, html: string, css: string) => {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
        throw new Error('VERCEL_TOKEN is not configured');
    }

    const indexHtml = buildStaticHtml(html || '', css || '');

    const response = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name,
            files: [
                {
                    file: 'index.html',
                    data: indexHtml,
                },
            ],
            projectSettings: {
                framework: null,
            },
        }),
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to deploy to Vercel');
    }

    return { url: payload?.url, id: payload?.id };
};

const deployNetlifyInternal = async (name: string, html: string, css: string) => {
    const token = process.env.NETLIFY_TOKEN;
    if (!token) {
        throw new Error('NETLIFY_TOKEN is not configured');
    }

    const indexHtml = buildStaticHtml(html || '', css || '');
    const siteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    });

    const sitePayload = await siteResponse.json();
    if (!siteResponse.ok) {
        throw new Error(sitePayload?.message || 'Failed to create Netlify site');
    }

    const siteId = sitePayload?.id;
    const sha = crypto.createHash('sha1').update(indexHtml).digest('hex');

    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            files: {
                'index.html': sha,
            },
        }),
    });

    const deployPayload = await deployResponse.json();
    if (!deployResponse.ok) {
        throw new Error(deployPayload?.message || 'Failed to create Netlify deploy');
    }

    const uploadUrl = deployPayload?.upload_url || deployPayload?.uploadUrl;
    if (uploadUrl) {
        const uploadResponse = await fetch(`${uploadUrl}/index.html`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/html',
            },
            body: indexHtml,
        });
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload Netlify files');
        }
    }

    return {
        url: deployPayload?.deploy_ssl_url || deployPayload?.deploy_url,
        id: deployPayload?.id,
        siteUrl: sitePayload?.ssl_url || sitePayload?.url,
        siteId: sitePayload?.id,
    };
};

const updateProjectPublishMeta = async (projectId: string, updates: Record<string, unknown>) => {
    await Project.findByIdAndUpdate(projectId, updates);
};

export const deployVercel = async (req: Request, res: Response) => {
    try {
        const { name, html, css, projectId } = req.body as { name?: string; html?: string; css?: string; projectId?: string };
        if (!name) {
            return res.status(400).json({ message: 'Deployment name is required' });
        }
        const deployment = await deployVercelInternal(name, html || '', css || '');
        if (projectId) {
            await updateProjectPublishMeta(projectId, {
                vercelProjectName: name,
                domainProvider: 'vercel',
            });
        }
        res.json(deployment);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to deploy to Vercel' });
    }
};

/**
 * @desc    Deploy a static build to Netlify
 * @route   POST /api/publish/netlify
 * @access  Private
 */
export const deployNetlify = async (req: Request, res: Response) => {
    try {
        const { name, html, css, projectId } = req.body as { name?: string; html?: string; css?: string; projectId?: string };
        if (!name) {
            return res.status(400).json({ message: 'Deployment name is required' });
        }

        const deployment = await deployNetlifyInternal(name, html || '', css || '');
        if (projectId && deployment.siteId) {
            await updateProjectPublishMeta(projectId, {
                netlifySiteId: deployment.siteId,
                domainProvider: 'netlify',
            });
        }
        res.json(deployment);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to deploy to Netlify' });
    }
};

/**
 * @desc    Create scheduled Vercel deploy
 * @route   POST /api/publish/vercel/schedule
 * @access  Private
 */
export const scheduleVercel = async (req: Request, res: Response) => {
    try {
        const { projectId, name, html, css, scheduledAt } = req.body as {
            projectId?: string;
            name?: string;
            html?: string;
            css?: string;
            scheduledAt?: string;
        };

        if (!projectId || !name || !scheduledAt) {
            return res.status(400).json({ message: 'projectId, name, and scheduledAt are required' });
        }

        const schedule = await PublishSchedule.create({
            projectId: projectId as any,
            provider: 'vercel',
            name,
            html: html || '',
            css: css || '',
            scheduledAt: new Date(scheduledAt),
        });

        res.status(201).json(schedule);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to schedule deployment' });
    }
};

/**
 * @desc    List schedules for project
 * @route   GET /api/publish/schedules/:projectId
 * @access  Private
 */
export const getSchedules = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        // @ts-ignore - Mongoose accepts strings for ObjectId at runtime
        const schedules = await PublishSchedule.find({ projectId }).sort({ scheduledAt: -1 });
        res.json(schedules);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch schedules' });
    }
};

export const runDueSchedules = async () => {
    const now = new Date();
    const schedules = await PublishSchedule.find({
        status: 'scheduled',
        scheduledAt: { $lte: now }
    }).limit(5);

    for (const schedule of schedules) {
        schedule.status = 'running';
        schedule.lastRunAt = new Date();
        await schedule.save();

        try {
            if (schedule.provider === 'vercel') {
                const deployment = await deployVercelInternal(schedule.name, schedule.html, schedule.css);
                schedule.status = 'completed';
                schedule.resultUrl = deployment.url ? `https://${deployment.url}` : undefined;
            } else if (schedule.provider === 'netlify') {
                const deployment = await deployNetlifyInternal(schedule.name, schedule.html, schedule.css);
                schedule.status = 'completed';
                schedule.resultUrl = deployment.url || deployment.siteUrl;
            }
        } catch (err: any) {
            schedule.status = 'failed';
            schedule.errorMessage = err.message || 'Deployment failed';
        }

        await schedule.save();
    }
};

/**
 * @desc    Create scheduled Netlify deploy
 * @route   POST /api/publish/netlify/schedule
 * @access  Private
 */
export const scheduleNetlify = async (req: Request, res: Response) => {
    try {
        const { projectId, name, html, css, scheduledAt } = req.body as {
            projectId?: string;
            name?: string;
            html?: string;
            css?: string;
            scheduledAt?: string;
        };

        if (!projectId || !name || !scheduledAt) {
            return res.status(400).json({ message: 'projectId, name, and scheduledAt are required' });
        }

        const schedule = await PublishSchedule.create({
            projectId: projectId as any,
            provider: 'netlify',
            name,
            html: html || '',
            css: css || '',
            scheduledAt: new Date(scheduledAt),
        });

        res.status(201).json(schedule);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to schedule deployment' });
    }
};

// ============================================================================
// CUSTOM DOMAIN + SSL
// ============================================================================

export const provisionDomain = async (req: Request, res: Response) => {
    try {
        const { projectId, provider, domain } = req.body as {
            projectId?: string;
            provider?: 'vercel' | 'netlify';
            domain?: string;
        };

        if (!projectId || !provider || !domain) {
            return res.status(400).json({ message: 'projectId, provider, and domain are required' });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (provider === 'netlify') {
            const token = process.env.NETLIFY_TOKEN;
            if (!token) throw new Error('NETLIFY_TOKEN is not configured');
            if (!project.netlifySiteId) {
                return res.status(400).json({ message: 'Netlify site not found. Deploy first.' });
            }

            const domainResponse = await fetch(`https://api.netlify.com/api/v1/sites/${project.netlifySiteId}/domains`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ domain }),
            });
            const domainPayload = await domainResponse.json();
            if (!domainResponse.ok) {
                throw new Error(domainPayload?.message || 'Failed to provision Netlify domain');
            }

            await updateProjectPublishMeta(projectId, {
                customDomain: domain,
                domainProvider: 'netlify',
                domainStatus: 'provisioned',
                sslStatus: 'pending',
            });

            return res.json({ domain: domainPayload?.domain || domain, provider: 'netlify' });
        }

        const token = process.env.VERCEL_TOKEN;
        if (!token) throw new Error('VERCEL_TOKEN is not configured');
        if (!project.vercelProjectName) {
            return res.status(400).json({ message: 'Vercel project not found. Deploy first.' });
        }

        const domainResponse = await fetch(`https://api.vercel.com/v10/projects/${project.vercelProjectName}/domains`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: domain }),
        });
        const domainPayload = await domainResponse.json();
        if (!domainResponse.ok) {
            throw new Error(domainPayload?.error?.message || 'Failed to provision Vercel domain');
        }

        await updateProjectPublishMeta(projectId, {
            customDomain: domain,
            domainProvider: 'vercel',
            domainStatus: domainPayload?.verified ? 'verified' : 'provisioned',
            sslStatus: domainPayload?.verified ? 'active' : 'pending',
        });

        return res.json({ domain: domainPayload?.name || domain, provider: 'vercel', verified: domainPayload?.verified });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to provision domain' });
    }
};

export const refreshSslStatus = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const project = await Project.findById(projectId);
        if (!project || !project.customDomain || !project.domainProvider) {
            return res.status(404).json({ message: 'Domain configuration not found' });
        }

        if (project.domainProvider === 'netlify') {
            const token = process.env.NETLIFY_TOKEN;
            if (!token) throw new Error('NETLIFY_TOKEN is not configured');
            if (!project.netlifySiteId) {
                return res.status(400).json({ message: 'Netlify site not found.' });
            }

            const sslResponse = await fetch(`https://api.netlify.com/api/v1/sites/${project.netlifySiteId}/ssl`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            const sslPayload = await sslResponse.json();
            if (!sslResponse.ok) {
                throw new Error(sslPayload?.message || 'Failed to fetch Netlify SSL status');
            }

            const status = sslPayload?.state || sslPayload?.status || 'pending';
            const mappedStatus = status === 'issued' || status === 'ready' ? 'active' : status === 'error' ? 'failed' : 'pending';

            await updateProjectPublishMeta(projectId as string, { sslStatus: mappedStatus });
            return res.json({ sslStatus: mappedStatus, provider: 'netlify', details: sslPayload });
        }

        const token = process.env.VERCEL_TOKEN;
        if (!token) throw new Error('VERCEL_TOKEN is not configured');
        if (!project.vercelProjectName) {
            return res.status(400).json({ message: 'Vercel project not found.' });
        }

        const domainResponse = await fetch(
            `https://api.vercel.com/v10/projects/${project.vercelProjectName}/domains/${project.customDomain}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        const domainPayload = await domainResponse.json();
        if (!domainResponse.ok) {
            throw new Error(domainPayload?.error?.message || 'Failed to fetch Vercel domain status');
        }

        const verified = Boolean(domainPayload?.verified);
        await updateProjectPublishMeta(projectId as string, {
            domainStatus: verified ? 'verified' : 'provisioned',
            sslStatus: verified ? 'active' : 'pending',
        });
        return res.json({ sslStatus: verified ? 'active' : 'pending', provider: 'vercel', verified });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to refresh SSL' });
    }
};