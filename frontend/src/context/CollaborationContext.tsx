import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useProject } from './ProjectContext';

interface PresenceUser {
    userId: string;
    username: string;
    pageId?: string;
}

interface CollaborationComment {
    _id: string;
    projectId: string;
    pageId: string;
    blockId?: string;
    message: string;
    author: {
        userId: string;
        username: string;
    };
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
}

interface CollaborationLock {
    componentId: string;
    userId: string;
    username: string;
    updatedAt: number;
}

interface RemotePageUpdate {
    pageId: string;
    version: number;
    html: string;
    css: string;
    userId?: string;
}

interface ConflictState {
    pageId: string;
    serverVersion: number;
    html: string;
    css: string;
}

interface CollaborationContextType {
    users: PresenceUser[];
    sendCursor: (x: number, y: number) => void;
    isConnected: boolean;
    activePageId?: string;
    setActivePage: (pageId?: string) => void;
    sendPageUpdate: (html: string, css: string) => void;
    remoteUpdate: RemotePageUpdate | null;
    conflict: ConflictState | null;
    resolveConflictWithServer: () => void;
    resolveConflictWithLocal: () => void;
    locks: CollaborationLock[];
    requestLock: (componentId: string) => void;
    releaseLock: (componentId: string) => void;
    selectedComponentId?: string;
    setSelectedComponentId: (componentId?: string) => void;
    comments: CollaborationComment[];
    addComment: (message: string, blockId?: string) => void;
    resolveComment: (commentId: string, resolved: boolean) => void;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export const CollaborationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { currentProject } = useProject();
    const [users, setUsers] = useState<PresenceUser[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [activePageId, setActivePageId] = useState<string | undefined>();
    const [remoteUpdate, setRemoteUpdate] = useState<RemotePageUpdate | null>(null);
    const [conflict, setConflict] = useState<ConflictState | null>(null);
    const [locks, setLocks] = useState<CollaborationLock[]>([]);
    const [comments, setComments] = useState<CollaborationComment[]>([]);
    const [selectedComponentId, setSelectedComponentId] = useState<string | undefined>();
    const docVersions = useRef<Record<string, number>>({});
    const lastLocalSnapshot = useRef<Record<string, { html: string; css: string }>>({});
    const wsRef = useRef<WebSocket | null>(null);

    const wsUrl = useMemo(() => {
        const base = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws';
        if (!user?.token || !currentProject?._id) return null;
        const url = new URL(base);
        url.searchParams.set('token', user.token);
        url.searchParams.set('projectId', currentProject._id);
        return url.toString();
    }, [user?.token, currentProject?._id]);

    useEffect(() => {
        if (!wsUrl) {
            setUsers([]);
            setIsConnected(false);
            return;
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            if (activePageId) {
                ws.send(JSON.stringify({ type: 'subscribe', pageId: activePageId }));
                ws.send(JSON.stringify({ type: 'page_request', pageId: activePageId }));
                ws.send(JSON.stringify({ type: 'comment_list', pageId: activePageId }));
            }
        };
        ws.onclose = () => setIsConnected(false);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'presence') {
                    setUsers(message.users || []);
                }
                if (message.type === 'lock_update') {
                    const nextLocks = (message.locks || []).map((entry: [string, any]) => ({
                        componentId: entry[0],
                        ...entry[1],
                    }));
                    setLocks(nextLocks);
                }
                if (message.type === 'page_state') {
                    if (message.pageId) {
                        docVersions.current[message.pageId] = message.version || 0;
                        setRemoteUpdate({
                            pageId: message.pageId,
                            version: message.version || 0,
                            html: message.html || '',
                            css: message.css || '',
                        });
                    }
                }
                if (message.type === 'page_update') {
                    if (message.pageId) {
                        docVersions.current[message.pageId] = message.version || 0;
                        if (message.userId && message.userId === user?._id) {
                            return;
                        }
                        setRemoteUpdate({
                            pageId: message.pageId,
                            version: message.version || 0,
                            html: message.html || '',
                            css: message.css || '',
                            userId: message.userId,
                        });
                    }
                }
                if (message.type === 'page_ack') {
                    if (message.pageId) {
                        docVersions.current[message.pageId] = message.version || 0;
                    }
                }
                if (message.type === 'conflict') {
                    setConflict({
                        pageId: message.pageId,
                        serverVersion: message.serverVersion,
                        html: message.html || '',
                        css: message.css || '',
                    });
                }
                if (message.type === 'comment_list') {
                    setComments(message.comments || []);
                }
                if (message.type === 'comment_added') {
                    setComments((prev) => [message.comment, ...prev]);
                }
                if (message.type === 'comment_updated') {
                    setComments((prev) => prev.map((item) => (item._id === message.comment._id ? message.comment : item)));
                }
            } catch {
                // ignore malformed messages
            }
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [wsUrl]);

    const sendCursor = (x: number, y: number) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({ type: 'cursor', x, y }));
    };

    const setActivePage = (pageId?: string) => {
        setActivePageId(pageId);
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !pageId) return;
        wsRef.current.send(JSON.stringify({ type: 'subscribe', pageId }));
        wsRef.current.send(JSON.stringify({ type: 'page_request', pageId }));
        wsRef.current.send(JSON.stringify({ type: 'comment_list', pageId }));
    };

    const sendPageUpdate = (html: string, css: string) => {
        if (!activePageId) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const version = docVersions.current[activePageId] || 0;
        lastLocalSnapshot.current[activePageId] = { html, css };
        wsRef.current.send(JSON.stringify({ type: 'page_update', pageId: activePageId, html, css, version }));
    };

    const resolveConflictWithServer = () => {
        if (!conflict) return;
        docVersions.current[conflict.pageId] = conflict.serverVersion;
        setRemoteUpdate({
            pageId: conflict.pageId,
            version: conflict.serverVersion,
            html: conflict.html,
            css: conflict.css,
        });
        setConflict(null);
    };

    const resolveConflictWithLocal = () => {
        if (!conflict) return;
        const snapshot = lastLocalSnapshot.current[conflict.pageId];
        if (!snapshot) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(
            JSON.stringify({
                type: 'page_update',
                pageId: conflict.pageId,
                html: snapshot.html,
                css: snapshot.css,
                version: conflict.serverVersion,
            })
        );
        setConflict(null);
    };

    const requestLock = (componentId: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({ type: 'lock_request', componentId }));
    };

    const releaseLock = (componentId: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({ type: 'lock_release', componentId }));
    };

    const addComment = (message: string, blockId?: string) => {
        if (!activePageId) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(
            JSON.stringify({
                type: 'comment_add',
                pageId: activePageId,
                blockId,
                message,
            })
        );
    };

    const resolveComment = (commentId: string, resolved: boolean) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({ type: 'comment_resolve', commentId, resolved }));
    };

    return (
        <CollaborationContext.Provider
            value={{
                users,
                sendCursor,
                isConnected,
                activePageId,
                setActivePage,
                sendPageUpdate,
                remoteUpdate,
                conflict,
                resolveConflictWithServer,
                resolveConflictWithLocal,
                locks,
                requestLock,
                releaseLock,
                selectedComponentId,
                setSelectedComponentId,
                comments,
                addComment,
                resolveComment,
            }}
        >
            {children}
        </CollaborationContext.Provider>
    );
};

export const CollaborationContextInstance = CollaborationContext;
