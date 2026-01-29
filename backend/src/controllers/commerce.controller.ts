import { Request, Response } from 'express';
import Product from '../models/Product';
import Project from '../models/Project';
import Cart from '../models/Cart';
import Order from '../models/Order';
import Stripe from 'stripe';

const getProjectOrThrow = async (projectId: string, userId: string) => {
    const project = await Project.findById(projectId);
    if (!project) {
        const error = new Error('Project not found');
        // @ts-ignore
        error.status = 404;
        throw error;
    }
    // @ts-ignore
    if (project.owner.toString() !== userId.toString()) {
        const error = new Error('Not authorized');
        // @ts-ignore
        error.status = 401;
        throw error;
    }
    return project;
};

const getOrCreateCart = async (projectId: string) => {
    const existing = await Cart.findOne({ projectId, status: 'open' });
    if (existing) return existing;
    return Cart.create({ projectId, status: 'open', items: [], subtotal: 0, currency: 'USD' });
};

const recalcCart = (cart: any) => {
    const subtotal = (cart.items || []).reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    cart.subtotal = subtotal;
    if (!cart.currency && cart.items?.length) {
        cart.currency = cart.items[0].currency || 'USD';
    }
    return cart;
};

const buildOrderTotals = (items: any[], taxRate = 0) => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * taxRate;
    return {
        subtotal,
        tax,
        total: subtotal + tax,
    };
};

// ============================================================================
// CART
// ============================================================================

export const getCart = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);
        const cart = await getOrCreateCart(projectId);
        res.json(cart);
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

export const addCartItem = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { productId, quantity } = req.body;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);

        const product = await Product.findOne({ _id: productId, projectId });
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const cart = await getOrCreateCart(projectId);
        const existing = cart.items.find((item: any) => item.productId.toString() === productId);
        if (existing) {
            existing.quantity += Number(quantity || 1);
        } else {
            cart.items.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                currency: product.currency,
                image: product.image,
                quantity: Number(quantity || 1),
            });
        }

        recalcCart(cart);
        const saved = await cart.save();
        res.status(201).json(saved);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

export const updateCartItem = async (req: Request, res: Response) => {
    try {
        const { projectId, itemId } = req.params;
        const { quantity } = req.body;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);

        const cart = await getOrCreateCart(projectId);
        const item = cart.items.id(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        item.quantity = Math.max(1, Number(quantity || 1));

        recalcCart(cart);
        const saved = await cart.save();
        res.json(saved);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

export const removeCartItem = async (req: Request, res: Response) => {
    try {
        const { projectId, itemId } = req.params;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);

        const cart = await getOrCreateCart(projectId);
        const item = cart.items.id(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        item.deleteOne();
        recalcCart(cart);
        const saved = await cart.save();
        res.json(saved);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

export const clearCart = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);
        const cart = await getOrCreateCart(projectId);
        cart.items = [] as any[];
        cart.subtotal = 0;
        const saved = await cart.save();
        res.json(saved);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

// ============================================================================
// ORDERS
// ============================================================================

export const getOrders = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);
        const orders = await Order.find({ projectId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

export const createOrder = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { cartId, customer } = req.body;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);

        const cart = cartId ? await Cart.findOne({ _id: cartId, projectId }) : await getOrCreateCart(projectId);
        if (!cart) return res.status(404).json({ message: 'Cart not found' });
        if (!cart.items.length) return res.status(400).json({ message: 'Cart is empty' });

        const totals = buildOrderTotals(cart.items);

        const order = await Order.create({
            projectId,
            items: cart.items,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            currency: cart.currency || 'USD',
            customer,
            paymentProvider: 'manual',
            paymentStatus: 'pending',
            fulfillmentStatus: 'pending',
        });

        cart.status = 'checked_out';
        await cart.save();

        res.status(201).json(order);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { projectId, orderId } = req.params;
        const { paymentStatus, fulfillmentStatus } = req.body;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);

        const order = await Order.findOne({ _id: orderId, projectId });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (paymentStatus) order.paymentStatus = paymentStatus;
        if (fulfillmentStatus) order.fulfillmentStatus = fulfillmentStatus;

        const saved = await order.save();
        res.json(saved);
    } catch (error: any) {
        res.status(error.status || 400).json({ message: error.message });
    }
};

// ============================================================================
// CHECKOUT
// ============================================================================

export const createStripeCheckout = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { cartId, successUrl, cancelUrl } = req.body;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);

        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(400).json({ message: 'STRIPE_SECRET_KEY is not configured' });
        }

        const cart = cartId ? await Cart.findOne({ _id: cartId, projectId }) : await getOrCreateCart(projectId);
        if (!cart || !cart.items.length) return res.status(400).json({ message: 'Cart is empty' });

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            success_url: successUrl || 'http://localhost:5173',
            cancel_url: cancelUrl || 'http://localhost:5173',
            line_items: cart.items.map((item: any) => ({
                quantity: item.quantity,
                price_data: {
                    currency: item.currency?.toLowerCase() || 'usd',
                    unit_amount: Math.round(item.price * 100),
                    product_data: {
                        name: item.name,
                        images: item.image ? [item.image] : [],
                    },
                },
            })),
        });

        res.json({ id: session.id, url: session.url });
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

export const createPayPalCheckout = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { cartId, returnUrl, cancelUrl } = req.body;
        // @ts-ignore
        await getProjectOrThrow(projectId, req.user._id);

        const clientId = process.env.PAYPAL_CLIENT_ID;
        const secret = process.env.PAYPAL_CLIENT_SECRET;
        if (!clientId || !secret) {
            return res.status(400).json({ message: 'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not configured' });
        }

        const cart = cartId ? await Cart.findOne({ _id: cartId, projectId }) : await getOrCreateCart(projectId);
        if (!cart || !cart.items.length) return res.status(400).json({ message: 'Cart is empty' });

        const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
        const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

        const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            return res.status(500).json({ message: tokenData.error_description || 'Failed to authenticate with PayPal' });
        }

        const total = cart.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
        const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        amount: {
                            currency_code: cart.currency || 'USD',
                            value: total.toFixed(2),
                        },
                        items: cart.items.map((item: any) => ({
                            name: item.name,
                            unit_amount: {
                                currency_code: item.currency || 'USD',
                                value: item.price.toFixed(2),
                            },
                            quantity: String(item.quantity),
                        })),
                    },
                ],
                application_context: {
                    return_url: returnUrl || 'http://localhost:5173',
                    cancel_url: cancelUrl || 'http://localhost:5173',
                },
            }),
        });

        const orderData = await orderResponse.json();
        if (!orderResponse.ok) {
            return res.status(500).json({ message: orderData.message || 'Failed to create PayPal order' });
        }

        const approvalLink = orderData.links?.find((link: any) => link.rel === 'approve');
        res.json({ id: orderData.id, url: approvalLink?.href });
    } catch (error: any) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
