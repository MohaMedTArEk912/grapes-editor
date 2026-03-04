import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { getLLMProvider } from '../lib/llmProvider.js';

// --- Team Management ---

export async function register(req: Request, res: Response) {
    const { username, sessionId } = req.body;
    if (!username || !sessionId) return res.status(400).json({ error: 'Missing credentials' });
    res.json({ success: true, username });
}

export async function createTeam(req: Request, res: Response) {
    const { sessionId, teamName, username } = req.body;
    if (!sessionId || !teamName) return res.status(400).json({ error: 'Missing data' });
    try {
        const team = await prisma.team.create({
            data: { name: teamName, adminSessionId: sessionId, members: { create: { sessionId, username: username || 'Admin', role: 'admin' } } }
        });
        res.json({ success: true, team: team.name });
    } catch (err: any) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Team already exists' });
        res.status(500).json({ error: err.message });
    }
}

export async function requestJoin(req: Request, res: Response) {
    const { sessionId, teamName, username } = req.body;
    if (!sessionId || !teamName) return res.status(400).json({ error: 'Missing data' });
    try {
        const team = await prisma.team.findUnique({ where: { name: teamName } });
        if (!team) return res.status(404).json({ error: 'Team not found' });
        const existingMember = await prisma.teamMember.findUnique({ where: { teamId_sessionId: { teamId: team.id, sessionId } } });
        if (existingMember) return res.json({ success: true, status: existingMember.role });
        await prisma.joinRequest.upsert({
            where: { teamId_sessionId: { teamId: team.id, sessionId } },
            update: { status: 'pending', username: username || 'User' },
            create: { teamId: team.id, sessionId, username: username || 'User', status: 'pending' }
        });
        res.json({ success: true, status: 'pending' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function searchTeams(req: Request, res: Response) {
    const { query } = req.query;
    if (typeof query !== 'string') return res.status(400).json({ error: 'Invalid query' });
    try {
        const teams = await prisma.team.findMany({ where: { name: { contains: query } }, include: { members: true }, take: 10 });
        res.json(teams);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function listTeams(req: Request, res: Response) {
    try {
        const teams = await prisma.team.findMany({ take: 20, include: { members: true }, orderBy: { createdAt: 'desc' } });
        res.json(teams);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getAdminData(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const team = await prisma.team.findFirst({ where: { adminSessionId: sessionId }, include: { members: true, joinRequests: { where: { status: 'pending' } } } });
        if (!team) return res.status(403).json({ error: 'Not an admin' });
        res.json({ pendingRequests: team.joinRequests, members: team.members.map((m: any) => ({ ...m, isAdmin: m.role === 'admin' })) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function resolveRequest(req: Request, res: Response) {
    const { adminSessionId, userSessionId, action } = req.body;
    if (!adminSessionId || !userSessionId || !action) return res.status(400).json({ error: 'Missing data' });
    try {
        const team = await prisma.team.findFirst({ where: { adminSessionId } });
        if (!team) return res.status(403).json({ error: 'Not authorized' });
        if (action === 'approve') {
            const request = await prisma.joinRequest.findUnique({ where: { teamId_sessionId: { teamId: team.id, sessionId: userSessionId } } });
            if (request) {
                await prisma.$transaction([
                    prisma.teamMember.create({ data: { teamId: team.id, sessionId: userSessionId, username: request.username, role: 'member' } }),
                    prisma.joinRequest.delete({ where: { id: request.id } })
                ]);
            }
        } else {
            await prisma.joinRequest.delete({ where: { teamId_sessionId: { teamId: team.id, sessionId: userSessionId } } });
        }
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getStatus(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (member) return res.json({ team: member.team.name, status: member.role });
        const request = await prisma.joinRequest.findFirst({ where: { sessionId }, include: { team: true } });
        if (request) return res.json({ team: request.team.name, status: 'pending' });
        res.json({ team: null, status: null });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function leaveTeam(req: Request, res: Response) {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    try {
        await prisma.teamMember.deleteMany({ where: { sessionId } });
        await prisma.joinRequest.deleteMany({ where: { sessionId } });
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

// --- Chat ---

export async function teamChat(req: Request, res: Response) {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) return res.status(400).json({ error: 'Missing data' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.status(403).json({ error: 'Unauthorized' });
        const team = member.team;
        const dbHistory = await prisma.teamChat.findMany({ where: { teamId: team.id }, orderBy: { createdAt: 'asc' }, take: 20 });
        const chatHistory = dbHistory.map((h: any) => ({ role: h.role, content: h.role === 'user' ? `${h.username}: ${h.content}` : h.content }));
        chatHistory.push({ role: 'user', content: `${member.username}: ${message}` });

        console.log(`AI Chat for team ${team.name} by ${member.username}`);
        const llmProvider = getLLMProvider();
        const reply = await llmProvider.chat({
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.3,
            messages: chatHistory
        });

        await prisma.teamChat.createMany({
            data: [
                { teamId: team.id, role: 'user', content: message, username: member.username },
                { teamId: team.id, role: 'assistant', content: reply }
            ]
        });
        res.json({ reply, teamName: team.name });
    } catch (err: any) {
        console.error('LLM Chat error:', err.message);
        res.status(500).json({ error: `AI Connection failed: ${err.message}` });
    }
}

export async function getChatHistory(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.json([]);
        const history = await prisma.teamChat.findMany({ where: { teamId: member.teamId }, orderBy: { createdAt: 'asc' } });
        res.json(history);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

// --- Ideas ---

export async function getIdeas(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.json([]);
        const ideas = await prisma.teamIdea.findMany({ where: { teamId: member.teamId }, orderBy: { createdAt: 'desc' } });
        res.json(ideas.map((i: any) => ({ ...i, idea: i.content, evaluation: i.evaluation ? JSON.parse(i.evaluation) : null })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function getBestIdea(req: Request, res: Response) {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.json(null);
        const ideas = await prisma.teamIdea.findMany({ where: { teamId: member.teamId } });
        if (ideas.length === 0) return res.json(null);
        const parsedIdeas = ideas.map((i: any) => ({ ...i, idea: i.content, evaluation: i.evaluation ? JSON.parse(i.evaluation) : null }));
        const best = parsedIdeas.reduce((prev: any, current: any) => {
            const prevScore = prev.evaluation ? prev.evaluation.overallScore : 0;
            const currScore = current.evaluation ? current.evaluation.overallScore : 0;
            return (currScore > prevScore) ? current : prev;
        });
        res.json(best);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function submitIdea(req: Request, res: Response) {
    const { idea, sessionId } = req.body;
    if (!idea || !sessionId) return res.status(400).json({ error: 'Missing data' });
    try {
        const member = await prisma.teamMember.findFirst({ where: { sessionId }, include: { team: true } });
        if (!member) return res.status(403).json({ error: 'Unauthorized' });
        const newIdea = await prisma.teamIdea.create({ data: { teamId: member.teamId, username: member.username, content: idea } });
        res.json({ ...newIdea, idea, evaluation: null });

        // Background AI Evaluation
        try {
            const prompt = `You are a professional innovation evaluator.\nEvaluate the startup idea for Feasibility (1-10), Innovation (1-10), MarketPotential (1-10).\nRespond ONLY in JSON matching this structure exactly (no markdown formatting, no comments):\n{\n  "feasibility": 8,\n  "innovation": 7,\n  "marketPotential": 9,\n  "overallScore": 8.0,\n  "strengths": ["point1", "point2"],\n  "weaknesses": ["point1", "point2"],\n  "summary": "short paragraph",\n  "recommendedNextSteps": ["step1", "step2", "step3"]\n}\n\nSTARTUP IDEA TO EVALUATE:\n${idea}`;
            const llmProvider = getLLMProvider();
            const response = await llmProvider.chat({
                model: 'google/gemma-3-4b-it:free',
                temperature: 0.2,
                messages: [{ role: 'user', content: prompt }]
            });
            let rawJson = response.trim() || "{}";
            if (rawJson.startsWith('```json')) rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
            if (rawJson.startsWith('```')) rawJson = rawJson.replace(/```/g, '').trim();
            const evaluation = JSON.parse(rawJson);
            await prisma.teamIdea.update({ where: { id: newIdea.id }, data: { evaluation: JSON.stringify(evaluation) } });
        } catch (err: any) { console.error('Evaluation generated error:', err.message); }
    } catch (err: any) { res.status(500).json({ error: err.message }); }
}

// --- Simple Chat (from merged server.js) ---

export async function simpleChat(req: Request, res: Response) {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message' });
    }
    try {
        const llmProvider = getLLMProvider();
        const reply = await llmProvider.chat({
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.3,
            messages: [{ role: 'user', content: message }],
        });
        res.json({ reply });
    } catch (err: any) {
        console.error('LLM error:', err.message);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
}

// --- Project-Context-Aware Chat ---

export async function projectChat(req: Request, res: Response) {
    const { message, projectId, history } = req.body;
    if (!message || !projectId) {
        return res.status(400).json({ error: 'Message and projectId are required' });
    }

    try {
        // Load project idea for context
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectIdea = project.description || 'No idea has been set for this project yet.';

        const systemPrompt = `You are an intelligent AI assistant embedded in a project management IDE called "Akasha". You are helping the user with their project.

PROJECT NAME: ${project.name}
PROJECT IDEA/DESCRIPTION:
${projectIdea}

Your role:
- Answer questions about the project idea, its feasibility, technical requirements, and implementation
- Help brainstorm features, architecture, and improvements
- Provide actionable advice based on the project context
- Be concise, helpful, and professional
- If the user asks about something unrelated to the project, still be helpful but try to relate it back to their project when relevant`;

        // Build messages array
        const messages: any[] = [
            { role: 'system', content: systemPrompt }
        ];

        // Add conversation history if provided
        if (Array.isArray(history)) {
            for (const msg of history.slice(-10)) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            }
        }

        messages.push({ role: 'user', content: message });

        const llmProvider = getLLMProvider();
        const reply = await llmProvider.chat({
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.4,
            messages,
        });

        res.json({ reply, projectName: project.name });
    } catch (err: any) {
        console.error('Project chat error:', err.message);
        res.status(500).json({ error: `AI Connection failed: ${err.message}` });
    }
}

// --- Idea Validation & Refinement ---

export async function analyzeIdea(req: Request, res: Response) {
    const { idea } = req.body;
    if (!idea || typeof idea !== 'string') {
        return res.status(400).json({ error: 'Valid idea string is required' });
    }

    try {
        const systemPrompt = `You are an elite startup mentor, product manager, and technical architect.
Analyze the following project idea. Return ONLY valid JSON. No markdown, no code fences, no extra text.
Keep answers concise to avoid token overflow:
- summary: max 25 words
- strengths/weaknesses/questions/suggestions: 4 items each, each item max 14 words
{
  "score": <number 0-100 evaluating viability and clarity>,
  "summary": "<one sentence clear summary of the core value proposition>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>", "<strength 4>"],
  "weaknesses": ["<potential pitfall 1>", "<weakness 2>", "<weakness 3>", "<weakness 4>"],
  "questions": ["<clarifying question 1>", "<clarifying question 2>", "<clarifying question 3>", "<clarifying question 4>"],
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>", "<actionable suggestion 4>"]
}`;

        const normalizeList = (value: unknown): string[] =>
            Array.isArray(value)
                ? value
                    .filter((item) => typeof item === 'string')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                : [];

        const parseJsonFromModelOutput = (modelOutput: string) => {
            let rawJson = modelOutput || '{}';
            const startIdx = rawJson.indexOf('{');
            const endIdx = rawJson.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                rawJson = rawJson.substring(startIdx, endIdx + 1);
            }
            return JSON.parse(rawJson);
        };

        const llmProvider = getLLMProvider();
        const response = await llmProvider.chat({
            model: 'google/gemini-2.5-flash',
            temperature: 0.2,
            max_tokens: 1200,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: idea }
            ]
        });

        const parsed = parseJsonFromModelOutput(response);
        const scoreNum = Number(parsed?.score);
        const safeScore = Number.isFinite(scoreNum)
            ? Math.max(0, Math.min(100, Math.round(scoreNum)))
            : 0;

        return res.json({
            score: safeScore,
            summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
            strengths: normalizeList(parsed?.strengths),
            weaknesses: normalizeList(parsed?.weaknesses),
            questions: normalizeList(parsed?.questions),
            suggestions: normalizeList(parsed?.suggestions)
        });
    } catch (err: any) {
        console.error('Idea analysis error:', err.message);
        res.status(500).json({ error: 'Failed to analyze idea. ' + err.message });
    }
}

export async function refineIdea(req: Request, res: Response) {
    const { idea, history, projectId } = req.body;
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
        return res.status(400).json({ error: 'Original idea is required' });
    }

    try {
        const systemPrompt = `You are an elite product manager and technical architect.
Your task is to take a raw project idea, incorporate the feedback and discussion history between the user and AI, and output a polished, implementation-ready Product Requirements Document (PRD) in Markdown.

Output constraints:
- Return ONLY valid Markdown
- Keep it focused and practical (around 600-1000 words)
- Use clear headings and concise bullets
- Start directly with: # Product Vision

Suggested structure:
# Product Vision
## Target Audience
## Core Value Proposition
## Problem Statement
## Key Features
## User Flows
## Technical Architecture (High Level)
## Data & API Requirements
## Milestones
## Success Metrics
## Risks & Mitigations`;

        const safeIdea = idea.trim().slice(0, 12000);
        const safeHistory = Array.isArray(history)
            ? history
                .filter((msg) => msg && typeof msg.content === 'string' && (msg.role === 'user' || msg.role === 'assistant'))
                .slice(-12)
                .map((msg) => ({ role: msg.role, content: String(msg.content).slice(0, 1200) }))
            : [];

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Original Idea:\n${safeIdea}` }
        ];

        if (safeHistory.length > 0) {
            messages.push({
                role: 'user',
                content: `Discussion history for refinement (latest first relevance):\n${JSON.stringify(safeHistory)}`
            });
        }

        messages.push({ role: 'user', content: 'Generate the final polished PRD markdown now.' });

        const llmProvider = getLLMProvider();
        const refinedContent = await llmProvider.chat({
            model: 'google/gemini-2.5-pro',
            temperature: 0.4,
            max_tokens: 1800,
            messages
        });

        if (!refinedContent || refinedContent.trim().length === 0) {
            throw new Error('Empty refinement response from AI model');
        }

        if (projectId) {
            try {
                await prisma.project.update({
                    where: { id: projectId },
                    data: { description: refinedContent }
                });
            } catch (err: any) {
                // Do not fail refinement response if project persistence fails.
                console.error('Project update after refinement failed:', err.message);
            }
        }

        res.json({ refinedIdea: refinedContent });
    } catch (err: any) {
        console.error('Idea refinement error:', err.message);
        res.status(500).json({ error: 'Failed to refine idea. ' + err.message });
    }
}
