import mongoose, { Schema, Document } from 'mongoose';

export interface CollaborationCommentDocument extends Document {
    projectId: string;
    pageId: string;
    blockId?: string;
    message: string;
    author: {
        userId: string;
        username: string;
    };
    resolved: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const CollaborationCommentSchema = new Schema<CollaborationCommentDocument>(
    {
        projectId: { type: String, required: true, index: true },
        pageId: { type: String, required: true, index: true },
        blockId: { type: String },
        message: { type: String, required: true },
        author: {
            userId: { type: String, required: true },
            username: { type: String, required: true },
        },
        resolved: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export default mongoose.model<CollaborationCommentDocument>('CollaborationComment', CollaborationCommentSchema);
