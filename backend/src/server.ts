import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { connectPostgres } from './config/postgres';
import { connectDB } from './config/db';
import projectRoutes from './routes/project.routes';
import authRoutes from './routes/auth.routes';
import symbolRoutes from './routes/symbol.routes';
import formRoutes from './routes/form.routes';
import cmsRoutes from './routes/cms.routes';
import pageRoutes from './routes/page.routes';
import sharedRoutes from './routes/shared.routes';
import vfsRoutes from './routes/vfs.routes';
import productRoutes from './routes/product.routes';
import commerceRoutes from './routes/commerce.routes';
import templateRoutes from './routes/template.routes';
import analyticsRoutes from './routes/analytics.routes';
import publishRoutes from './routes/publish.routes';
import { runDueSchedules } from './controllers/publish.controller';
import { protect } from './middleware/auth.middleware';
import CollaborationComment from './models/CollaborationComment';

dotenv.config();

// Connect to Database
connectDB();
connectPostgres();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(helmet());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', protect, projectRoutes);
app.use('/api/symbols', protect, symbolRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/cms', protect, cmsRoutes);
app.use('/api/pages', protect, pageRoutes);
app.use('/api/shared', protect, sharedRoutes);
app.use('/api/vfs', vfsRoutes); // VFS routes (auth handled internally)
app.use('/api/products', protect, productRoutes);
app.use('/api/commerce', protect, commerceRoutes);
app.use('/api/templates', protect, templateRoutes);
app.use('/api/analytics', protect, analyticsRoutes);
app.use('/api/publish', protect, publishRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Start Server
// ============================
// Realtime Collaboration (WS)
// ============================
const wss = new WebSocketServer({ server, path: '/ws' });

type Presence = {
    userId: string;
    username: string;
    pageId?: string;
};

type RoomState = {
    users: Map<string, Presence>;
    locks: Map<string, { userId: string; username: string; updatedAt: number }>;
    pages: Map<string, { version: number; html: string; css: string }>;
};

const rooms = new Map<string, RoomState>();

const getRoom = (projectId: string) => {
    if (!rooms.has(projectId)) {
        rooms.set(projectId, { users: new Map(), locks: new Map(), pages: new Map() });
    }
    return rooms.get(projectId)!;
};

const broadcast = (projectId: string, payload: unknown, exclude?: any) => {
    const room = getRoom(projectId);
    const message = JSON.stringify(payload);
    wss.clients.forEach((client: any) => {
        if (client.readyState === 1 && client.projectId === projectId && client !== exclude) {
            client.send(message);
        }
    });
};

const sendToClient = (client: any, payload: unknown) => {
    if (client?.readyState === 1) {
        client.send(JSON.stringify(payload));
    }
};

wss.on('connection', (ws: any, req) => {
    try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const projectId = url.searchParams.get('projectId');

        if (!token || !projectId) {
            ws.close(1008, 'Missing token or projectId');
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123') as { id: string; username?: string; };
        const userId = decoded.id;
        const username = decoded.username || 'User';

        ws.projectId = projectId;
        ws.userId = userId;

        const room = getRoom(projectId);
        room.users.set(userId, { userId, username });

        broadcast(projectId, { type: 'presence', users: Array.from(room.users.values()) });

        ws.on('message', async (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'cursor') {
                    broadcast(projectId, { type: 'cursor', userId, x: message.x, y: message.y });
                }

                if (message.type === 'subscribe' && message.pageId) {
                    ws.pageId = message.pageId;
                    const presence = room.users.get(userId);
                    if (presence) {
                        presence.pageId = message.pageId;
                        room.users.set(userId, presence);
                    }
                    broadcast(projectId, { type: 'presence', users: Array.from(room.users.values()) });
                    const pageState = room.pages.get(message.pageId);
                    if (pageState) {
                        sendToClient(ws, {
                            type: 'page_state',
                            pageId: message.pageId,
                            version: pageState.version,
                            html: pageState.html,
                            css: pageState.css,
                        });
                    }
                }

                if (message.type === 'page_request' && message.pageId) {
                    const pageState = room.pages.get(message.pageId);
                    sendToClient(ws, {
                        type: 'page_state',
                        pageId: message.pageId,
                        version: pageState?.version ?? 0,
                        html: pageState?.html ?? '',
                        css: pageState?.css ?? '',
                    });
                }

                if (message.type === 'page_update' && message.pageId) {
                    const current = room.pages.get(message.pageId) || { version: 0, html: '', css: '' };
                    if (message.version !== current.version) {
                        sendToClient(ws, {
                            type: 'conflict',
                            pageId: message.pageId,
                            serverVersion: current.version,
                            html: current.html,
                            css: current.css,
                        });
                        return;
                    }

                    const next = {
                        version: current.version + 1,
                        html: message.html || '',
                        css: message.css || '',
                    };
                    room.pages.set(message.pageId, next);
                    broadcast(projectId, {
                        type: 'page_update',
                        pageId: message.pageId,
                        version: next.version,
                        html: next.html,
                        css: next.css,
                        userId,
                    }, ws);
                    sendToClient(ws, {
                        type: 'page_ack',
                        pageId: message.pageId,
                        version: next.version,
                    });
                }

                if (message.type === 'lock_request' && message.componentId) {
                    const current = room.locks.get(message.componentId);
                    if (!current || current.userId === userId) {
                        const next = { userId, username, updatedAt: Date.now() };
                        room.locks.set(message.componentId, next);
                        broadcast(projectId, { type: 'lock_update', locks: Array.from(room.locks.entries()) });
                    } else {
                        sendToClient(ws, { type: 'lock_denied', componentId: message.componentId, owner: current });
                    }
                }

                if (message.type === 'lock_release' && message.componentId) {
                    const current = room.locks.get(message.componentId);
                    if (current?.userId === userId) {
                        room.locks.delete(message.componentId);
                        broadcast(projectId, { type: 'lock_update', locks: Array.from(room.locks.entries()) });
                    }
                }

                if (message.type === 'comment_list' && message.pageId) {
                    const comments = await CollaborationComment.find({
                        projectId,
                        pageId: message.pageId,
                    })
                        .sort({ createdAt: -1 })
                        .lean();
                    sendToClient(ws, { type: 'comment_list', pageId: message.pageId, comments });
                }

                if (message.type === 'comment_add' && message.pageId && message.message) {
                    const comment = await CollaborationComment.create({
                        projectId,
                        pageId: message.pageId,
                        blockId: message.blockId,
                        message: message.message,
                        author: { userId, username },
                        resolved: false,
                    });
                    broadcast(projectId, { type: 'comment_added', comment: comment.toObject() });
                }

                if (message.type === 'comment_resolve' && message.commentId) {
                    const comment = await CollaborationComment.findByIdAndUpdate(
                        message.commentId,
                        { resolved: Boolean(message.resolved) },
                        { new: true }
                    ).lean();
                    if (comment) {
                        broadcast(projectId, { type: 'comment_updated', comment });
                    }
                }
            } catch (err) {
                console.error('WS message error', err);
            }
        });

        ws.on('close', () => {
            const activeRoom = getRoom(projectId);
            activeRoom.users.delete(userId);
            for (const [key, lock] of activeRoom.locks.entries()) {
                if (lock.userId === userId) {
                    activeRoom.locks.delete(key);
                }
            }
            broadcast(projectId, { type: 'lock_update', locks: Array.from(activeRoom.locks.entries()) });
            broadcast(projectId, { type: 'presence', users: Array.from(activeRoom.users.values()) });
        });
    } catch (err) {
        ws.close(1011, 'Unauthorized');
    }
});

// Start Server
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Schedule runner (checks every minute)
setInterval(() => {
    runDueSchedules().catch((err) => console.error('Schedule runner error', err));
}, 60_000);
