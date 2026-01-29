import React, { useState } from 'react';
import { Users, WifiOff, Wifi, Lock, MessageSquare, AlertTriangle } from 'lucide-react';
import { useCollaboration } from '../../context/useCollaboration';

export const CollaborationPanel: React.FC = () => {
    const {
        users,
        isConnected,
        activePageId,
        locks,
        requestLock,
        releaseLock,
        selectedComponentId,
        comments,
        addComment,
        resolveComment,
        conflict,
        resolveConflictWithServer,
        resolveConflictWithLocal,
    } = useCollaboration();
    const [commentText, setCommentText] = useState('');

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users size={18} />
                    Collaboration
                </h3>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                    {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {isConnected ? 'Online' : 'Offline'}
                </span>
            </div>

            {users.length === 0 && (
                <div className="text-slate-400 text-sm">No collaborators connected.</div>
            )}

            <div className="space-y-2">
                {users.map((user) => (
                    <div
                        key={user.userId}
                        className="flex items-center justify-between p-2 rounded bg-[#141428] border border-[#2a2a4a]"
                    >
                        <span className="text-sm text-slate-200">{user.username}</span>
                        <span className="text-[11px] text-slate-400">{user.pageId ? user.pageId.slice(0, 6) : user.userId.slice(0, 6)}</span>
                    </div>
                ))}
            </div>

            <div className="mt-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-2">
                    <Lock size={14} />
                    Locks
                </div>
                <div className="text-xs text-slate-400 mb-2">Selected component: {selectedComponentId || 'None'}</div>
                <div className="flex items-center gap-2 mb-3">
                    <button
                        onClick={() => selectedComponentId && requestLock(selectedComponentId)}
                        disabled={!selectedComponentId}
                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-40"
                    >
                        Lock
                    </button>
                    <button
                        onClick={() => selectedComponentId && releaseLock(selectedComponentId)}
                        disabled={!selectedComponentId}
                        className="px-3 py-1 text-xs bg-[#0a0a1a] border border-[#2a2a4a] rounded text-slate-300 disabled:opacity-40"
                    >
                        Release
                    </button>
                </div>
                {locks.length === 0 ? (
                    <div className="text-xs text-slate-500">No active locks.</div>
                ) : (
                    <div className="space-y-2">
                        {locks.map((lock) => (
                            <div key={lock.componentId} className="flex items-center justify-between p-2 rounded bg-[#141428] border border-[#2a2a4a]">
                                <span className="text-xs text-slate-200">{lock.componentId}</span>
                                <span className="text-[11px] text-slate-400">{lock.username}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-2">
                    <MessageSquare size={14} />
                    Comments
                </div>
                <div className="text-xs text-slate-400 mb-2">Active page: {activePageId ? activePageId.slice(0, 6) : 'None'}</div>
                <div className="flex items-center gap-2 mb-3">
                    <input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white"
                        placeholder="Leave a comment"
                    />
                    <button
                        onClick={() => {
                            if (!commentText.trim()) return;
                            addComment(commentText.trim(), selectedComponentId);
                            setCommentText('');
                        }}
                        disabled={!activePageId}
                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-40"
                    >
                        Add
                    </button>
                </div>
                {comments.length === 0 ? (
                    <div className="text-xs text-slate-500">No comments yet.</div>
                ) : (
                    <div className="space-y-2 max-h-48 overflow-auto">
                        {comments.map((comment) => (
                            <div key={comment._id} className="p-2 rounded bg-[#141428] border border-[#2a2a4a]">
                                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                                    <span>{comment.author.username}</span>
                                    <button
                                        onClick={() => resolveComment(comment._id, !comment.resolved)}
                                        className="text-indigo-300 hover:text-indigo-200"
                                    >
                                        {comment.resolved ? 'Reopen' : 'Resolve'}
                                    </button>
                                </div>
                                <div className={`text-xs ${comment.resolved ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                    {comment.message}
                                </div>
                                {comment.blockId && (
                                    <div className="text-[10px] text-slate-500 mt-1">Block: {comment.blockId}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {conflict && (
                <div className="mt-5 p-3 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200">
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                        <AlertTriangle size={14} />
                        Sync conflict
                    </div>
                    <div className="text-xs mb-3">Server has a newer version for this page.</div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resolveConflictWithServer}
                            className="px-3 py-1 text-xs bg-amber-500 text-black rounded"
                        >
                            Use server
                        </button>
                        <button
                            onClick={resolveConflictWithLocal}
                            className="px-3 py-1 text-xs bg-[#0a0a1a] border border-amber-500/40 rounded text-amber-200"
                        >
                            Overwrite
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
