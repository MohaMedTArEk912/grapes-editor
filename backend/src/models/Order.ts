import mongoose, { Document, Schema } from 'mongoose';

export interface OrderItemSnapshot {
    productId: mongoose.Types.ObjectId;
    name: string;
    price: number;
    currency: string;
    image?: string;
    quantity: number;
}

export interface OrderCustomer {
    name?: string;
    email?: string;
}

export interface IOrder extends Document {
    projectId: mongoose.Types.ObjectId;
    items: OrderItemSnapshot[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    customer?: OrderCustomer;
    paymentProvider: 'stripe' | 'paypal' | 'manual';
    paymentStatus: 'pending' | 'paid' | 'failed';
    fulfillmentStatus: 'pending' | 'fulfilled' | 'cancelled';
    externalId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const OrderItemSchema = new Schema<OrderItemSnapshot>(
    {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true },
        image: { type: String },
        quantity: { type: Number, required: true, min: 1 },
    },
    { _id: true }
);

const OrderSchema: Schema = new Schema(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        items: { type: [OrderItemSchema], default: [] },
        subtotal: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        total: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'USD' },
        customer: {
            name: { type: String },
            email: { type: String },
        },
        paymentProvider: { type: String, enum: ['stripe', 'paypal', 'manual'], default: 'manual' },
        paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
        fulfillmentStatus: { type: String, enum: ['pending', 'fulfilled', 'cancelled'], default: 'pending' },
        externalId: { type: String },
    },
    { timestamps: true }
);

OrderSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model<IOrder>('Order', OrderSchema);
