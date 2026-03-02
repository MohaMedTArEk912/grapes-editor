import express from 'express';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const aiRouter = express.Router();
const prisma = new PrismaClient();

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Helper to check team membership
const checkMembership = async (sessionId: string) => {
    const member = await prisma.teamMember.findFirst({
        where: { sessionId }
    });
    return member !== null;
};

aiRouter.post('/register', async (req, res) => {
    const { username, sessionId } = req.body;
    if (!username || !sessionId) return res.status(400).json({ error: 'Missing credentials' });

    // In this simple implementation, we don't have a formal User model yet,
    // so we just return success. Persistence happens at the TeamMember level.
    res.json({ success: true, username });
});

aiRouter.post('/create-team', async (req, res) => {
    const { sessionId, teamName, username } = req.body;
    if (!sessionId || !teamName) return res.status(400).json({ error: 'Missing data' });

    try {
        const team = await prisma.team.create({
            data: {
                name: teamName,
                adminSessionId: sessionId,
                members: {
                    create: {
                        sessionId,
                        username: username || 'Admin',
                        role: 'admin'
                    }
                }
            }
        });
        res.json({ success: true, team: team.name });
    } catch (err: any) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Team already exists' });
        res.status(500).json({ error: err.message });
    }
});

aiRouter.post('/request-join', async (req, res) => {
    const { sessionId, teamName, username } = req.body;
    if (!sessionId || !teamName) return res.status(400).json({ error: 'Missing data' });

    try {
        const team = await prisma.team.findUnique({ where: { name: teamName } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        const existingMember = await prisma.teamMember.findUnique({
            where: { teamId_sessionId: { teamId: team.id, sessionId } }
        });
        if (existingMember) return res.json({ success: true, status: existingMember.role });

        const request = await prisma.joinRequest.upsert({
            where: { teamId_sessionId: { teamId: team.id, sessionId } },
            update: { status: 'pending', username: username || 'User' },
            create: {
                teamId: team.id,
                sessionId,
                username: username || 'User',
                status: 'pending'
            }
        });

        res.json({ success: true, status: 'pending' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.get('/search-teams', async (req, res) => {
    const { query } = req.query;
    if (typeof query !== 'string') return res.status(400).json({ error: 'Invalid query' });

    try {
        const teams = await prisma.team.findMany({
            where: {
                name: { contains: query }
            },
            include: { members: true },
            take: 10
        });
        res.json(teams);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.get('/list-teams', async (req, res) => {
    try {
        const teams = await prisma.team.findMany({
            take: 20,
            include: { members: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(teams);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.get('/admin-data', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });

    try {
        const team = await prisma.team.findFirst({
            where: { adminSessionId: sessionId },
            include: {
                members: true,
                joinRequests: { where: { status: 'pending' } }
            }
        });

        if (!team) return res.status(403).json({ error: 'Not an admin' });

        res.json({
            pendingRequests: team.joinRequests,
            members: team.members.map((m: any) => ({ ...m, isAdmin: m.role === 'admin' }))
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.post('/resolve-request', async (req, res) => {
    const { adminSessionId, userSessionId, action } = req.body;
    if (!adminSessionId || !userSessionId || !action) return res.status(400).json({ error: 'Missing data' });

    try {
        const team = await prisma.team.findFirst({
            where: { adminSessionId: adminSessionId }
        });
        if (!team) return res.status(403).json({ error: 'Not authorized' });

        if (action === 'approve') {
            const request = await prisma.joinRequest.findUnique({
                where: { teamId_sessionId: { teamId: team.id, sessionId: userSessionId } }
            });

            if (request) {
                await prisma.$transaction([
                    prisma.teamMember.create({
                        data: {
                            teamId: team.id,
                            sessionId: userSessionId,
                            username: request.username,
                            role: 'member'
                        }
                    }),
                    prisma.joinRequest.delete({
                        where: { id: request.id }
                    })
                ]);
            }
        } else {
            await prisma.joinRequest.delete({
                where: { teamId_sessionId: { teamId: team.id, sessionId: userSessionId } }
            });
        }

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.get('/status', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });

    try {
        const member = await prisma.teamMember.findFirst({
            where: { sessionId },
            include: { team: true }
        });

        if (member) {
            return res.json({ team: member.team.name, status: member.role });
        }

        const request = await prisma.joinRequest.findFirst({
            where: { sessionId },
            include: { team: true }
        });

        if (request) {
            return res.json({ team: request.team.name, status: 'pending' });
        }

        res.json({ team: null, status: null });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.post('/leave-team', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    try {
        await prisma.teamMember.deleteMany({ where: { sessionId } });
        await prisma.joinRequest.deleteMany({ where: { sessionId } });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.post('/chat', async (req, res) => {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) return res.status(400).json({ error: 'Missing data' });

    try {
        const member = await prisma.teamMember.findFirst({
            where: { sessionId },
            include: { team: true }
        });

        if (!member) return res.status(403).json({ error: 'Unauthorized' });

        const team = member.team;

        // Fetch chat history from DB
        const dbHistory = await prisma.teamChat.findMany({
            where: { teamId: team.id },
            orderBy: { createdAt: 'asc' },
            take: 20
        });

        const chatHistory = dbHistory.map((h: any) => ({
            role: h.role,
            content: h.role === 'user' ? `${h.username}: ${h.content}` : h.content
        }));

        chatHistory.push({ role: 'user', content: `${member.username}: ${message}` });

        console.log(`AI Chat for team ${team.name} by ${member.username}`);
        const completion = await client.chat.completions.create({
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.3,
            messages: chatHistory as any,
        });

        const reply = completion.choices[0].message.content || "";

        // Save to DB
        await prisma.teamChat.createMany({
            data: [
                { teamId: team.id, role: 'user', content: message, username: member.username },
                { teamId: team.id, role: 'assistant', content: reply }
            ]
        });

        res.json({ reply, teamName: team.name });
    } catch (err: any) {
        console.error('OpenRouter error:', err.message);
        res.status(500).json({ error: `AI Connection failed: ${err.message}` });
    }
});

aiRouter.get('/chat-history', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });

    try {
        const member = await prisma.teamMember.findFirst({
            where: { sessionId },
            include: { team: true }
        });

        if (!member) return res.json([]);

        const history = await prisma.teamChat.findMany({
            where: { teamId: member.teamId },
            orderBy: { createdAt: 'asc' }
        });

        res.json(history);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.get('/ideas', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });

    try {
        const member = await prisma.teamMember.findFirst({
            where: { sessionId },
            include: { team: true }
        });

        if (!member) return res.json([]);

        const ideas = await prisma.teamIdea.findMany({
            where: { teamId: member.teamId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(ideas.map((i: any) => ({
            ...i,
            idea: i.content,
            evaluation: i.evaluation ? JSON.parse(i.evaluation) : null
        })));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.get('/bestIdea', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });

    try {
        const member = await prisma.teamMember.findFirst({
            where: { sessionId },
            include: { team: true }
        });

        if (!member) return res.json(null);

        const ideas = await prisma.teamIdea.findMany({
            where: { teamId: member.teamId }
        });

        if (ideas.length === 0) return res.json(null);

        const parsedIdeas = ideas.map((i: any) => ({
            ...i,
            idea: i.content,
            evaluation: i.evaluation ? JSON.parse(i.evaluation) : null
        }));

        const best = parsedIdeas.reduce((prev: any, current: any) => {
            const prevScore = prev.evaluation ? prev.evaluation.overallScore : 0;
            const currScore = current.evaluation ? current.evaluation.overallScore : 0;
            return (currScore > prevScore) ? current : prev;
        });
        res.json(best);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

aiRouter.post('/ideas', async (req, res) => {
    const { idea, sessionId } = req.body;
    if (!idea || !sessionId) return res.status(400).json({ error: 'Missing data' });

    try {
        const member = await prisma.teamMember.findFirst({
            where: { sessionId },
            include: { team: true }
        });

        if (!member) return res.status(403).json({ error: 'Unauthorized' });

        const newIdea = await prisma.teamIdea.create({
            data: {
                teamId: member.teamId,
                username: member.username,
                content: idea
            }
        });

        res.json({ ...newIdea, idea, evaluation: null });

        // AI Evaluation
        try {
            const prompt = `You are a professional innovation evaluator.
Evaluate the startup idea for Feasibility (1-10), Innovation (1-10), MarketPotential (1-10).
Respond ONLY in JSON matching this structure exactly (no markdown formatting, no comments):
{
  "feasibility": 8,
  "innovation": 7,
  "marketPotential": 9,
  "overallScore": 8.0,
  "strengths": ["point1", "point2"],
  "weaknesses": ["point1", "point2"],
  "summary": "short paragraph",
  "recommendedNextSteps": ["step1", "step2", "step3"]
}

STARTUP IDEA TO EVALUATE:
${idea}`;

            const completion = await client.chat.completions.create({
                model: 'google/gemma-3-4b-it:free',
                temperature: 0.2,
                messages: [{ role: 'user', content: prompt }]
            });

            let rawJson = completion.choices[0].message?.content?.trim() || "{}";
            if (rawJson.startsWith('```json')) rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
            if (rawJson.startsWith('```')) rawJson = rawJson.replace(/```/g, '').trim();

            const evaluation = JSON.parse(rawJson);

            await prisma.teamIdea.update({
                where: { id: newIdea.id },
                data: { evaluation: JSON.stringify(evaluation) }
            });

        } catch (err: any) {
            console.error('Evaluation generated error:', err.message);
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default aiRouter;
