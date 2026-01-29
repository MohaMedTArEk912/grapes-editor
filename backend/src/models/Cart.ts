import mongoose, { Document, Schema } from 'mongoose';

export interface CartItemSnapshot {
    productId: mongoose.Types.ObjectId;
    name: string;
    price: number;
    currency: string;
    image?: string;
    quantity: number;
}

export interface ICart extends Document {
    projectId: mongoose.Types.ObjectId;
    status: 'open' | 'checked_out';
    items: CartItemSnapshot[];
    subtotal: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}

const CartItemSchema = new Schema<CartItemSnapshot>(
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

const CartSchema: Schema = new Schema(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        status: { type: String, enum: ['open', 'checked_out'], default: 'open' },
        items: { type: [CartItemSchema], default: [] },
        subtotal: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'USD' },
    },
    { timestamps: true }
);

CartSchema.index({ projectId: 1, status: 1 });

export default mongoose.model<ICart>('Cart', CartSchema);
