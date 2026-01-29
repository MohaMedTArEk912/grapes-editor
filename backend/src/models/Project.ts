import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
    name: string;
    slug: string;
    description?: string;
    content: object; // GrapesJS JSON
    styles: string;  // CSS
    assets: any[];   // Assets list
    owner: mongoose.Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true },
        description: { type: String },
        content: { type: Object, default: {} }, // Store the raw JSON components
        styles: { type: String, default: '' },
        assets: { type: Array, default: [] },
        owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// Compound index to ensure slugs are unique per user
ProjectSchema.index({ slug: 1, owner: 1 }, { unique: true });

export default mongoose.model<IProject>('Project', ProjectSchema);
