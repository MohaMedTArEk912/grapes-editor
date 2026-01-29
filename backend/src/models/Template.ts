import mongoose, { Document, Schema } from 'mongoose';

export interface TemplateContent {
    html?: string;
    css?: string;
}

export interface ITemplate extends Document {
    projectId: mongoose.Schema.Types.ObjectId;
    name: string;
    description?: string;
    type: 'page' | 'block';
    tags: string[];
    status: 'private' | 'public';
    previewImage?: string;
    content: TemplateContent;
    createdAt: Date;
    updatedAt: Date;
}

const TemplateSchema: Schema = new Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String },
        type: { type: String, enum: ['page', 'block'], required: true },
        tags: { type: [String], default: [] },
        status: { type: String, enum: ['private', 'public'], default: 'private', index: true },
        previewImage: { type: String },
        content: {
            html: { type: String, default: '' },
            css: { type: String, default: '' },
        },
    },
    { timestamps: true }
);

TemplateSchema.index({ projectId: 1, name: 1 });
TemplateSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<ITemplate>('Template', TemplateSchema);
