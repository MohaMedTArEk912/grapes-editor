import { Router } from 'express';
import {
    getCart,
    addCartItem,
    updateCartItem,
    removeCartItem,
    clearCart,
    getOrders,
    createOrder,
    updateOrderStatus,
    createStripeCheckout,
    createPayPalCheckout,
} from '../controllers/commerce.controller';

const router = Router();

// Cart
router.get('/:projectId/cart', getCart);
router.post('/:projectId/cart/items', addCartItem);
router.put('/:projectId/cart/items/:itemId', updateCartItem);
router.delete('/:projectId/cart/items/:itemId', removeCartItem);
router.post('/:projectId/cart/clear', clearCart);

// Orders
router.get('/:projectId/orders', getOrders);
router.post('/:projectId/orders', createOrder);
router.put('/:projectId/orders/:orderId', updateOrderStatus);

// Checkout
router.post('/:projectId/checkout/stripe', createStripeCheckout);
router.post('/:projectId/checkout/paypal', createPayPalCheckout);

export default router;
