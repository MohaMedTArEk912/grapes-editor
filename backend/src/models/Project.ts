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
        customDomain?: string;
        domainProvider?: 'vercel' | 'netlify';
        domainStatus?: 'pending' | 'provisioned' | 'verified' | 'failed';
        sslStatus?: 'pending' | 'active' | 'failed';
        netlifySiteId?: string;
        vercelProjectName?: string;
}

const ProjectSchema: Schema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true },
        description: { type: String },
        content: { type: Object, default: {} }, // Store the raw JSON components
        styles: { type: String, default: '' },
        assets: { type: Array, default: [] },
        headerHtml: { type: String, default: '' },
        headerCss: { type: String, default: '' },
        footerHtml: { type: String, default: '' },
        footerCss: { type: String, default: '' },
        owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            customDomain: { type: String },
            domainProvider: { type: String, enum: ['vercel', 'netlify'] },
            domainStatus: { type: String, enum: ['pending', 'provisioned', 'verified', 'failed'], default: 'pending' },
            sslStatus: { type: String, enum: ['pending', 'active', 'failed'], default: 'pending' },
            netlifySiteId: { type: String },
            vercelProjectName: { type: String },
    },
    { timestamps: true }
);

// Compound index to ensure slugs are unique per user
ProjectSchema.index({ slug: 1, owner: 1 }, { unique: true });

export default mongoose.model<IProject>('Project', ProjectSchema);
