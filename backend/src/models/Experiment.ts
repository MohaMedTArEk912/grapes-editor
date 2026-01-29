import mongoose, { Document, Schema } from 'mongoose';

export interface ExperimentVariant {
    name: string;
    weight: number;
    content?: {
        html?: string;
        css?: string;
    };
}

export interface IExperiment extends Document {
    projectId: mongoose.Schema.Types.ObjectId;
    name: string;
    pageId?: string;
    status: 'draft' | 'running' | 'paused' | 'completed';
    variants: ExperimentVariant[];
    createdAt: Date;
    updatedAt: Date;
}

const VariantSchema = new Schema<ExperimentVariant>(
    {
        name: { type: String, required: true },
        weight: { type: Number, required: true, min: 0 },
        content: {
            html: { type: String, default: '' },
            css: { type: String, default: '' },
        },
    },
    { _id: true }
);

const ExperimentSchema: Schema = new Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        name: { type: String, required: true },
        pageId: { type: String },
        status: { type: String, enum: ['draft', 'running', 'paused', 'completed'], default: 'draft' },
        variants: { type: [VariantSchema], default: [] },
    },
    { timestamps: true }
);

ExperimentSchema.index({ projectId: 1, status: 1 });

export default mongoose.model<IExperiment>('Experiment', ExperimentSchema);
