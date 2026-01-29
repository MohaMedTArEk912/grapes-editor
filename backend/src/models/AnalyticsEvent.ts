import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalyticsEvent extends Document {
    projectId: mongoose.Schema.Types.ObjectId;
    pageId?: string;
    type: 'page_view' | 'click' | 'form_submit' | 'custom';
    x?: number;
    y?: number;
    element?: string;
    meta?: Record<string, unknown>;
    experimentId?: mongoose.Schema.Types.ObjectId;
    variant?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AnalyticsEventSchema: Schema = new Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        pageId: { type: String },
        type: { type: String, enum: ['page_view', 'click', 'form_submit', 'custom'], required: true, index: true },
        x: { type: Number },
        y: { type: Number },
        element: { type: String },
        meta: { type: Schema.Types.Mixed },
        experimentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Experiment' },
        variant: { type: String },
    },
    { timestamps: true }
);

AnalyticsEventSchema.index({ projectId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ projectId: 1, pageId: 1, type: 1 });

export default mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);
