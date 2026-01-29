const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface CartItem {
    _id: string;
    productId: string;
    name: string;
    price: number;
    currency: string;
    image?: string;
    quantity: number;
}

export interface Cart {
    _id: string;
    projectId: string;
    status: 'open' | 'checked_out';
    items: CartItem[];
    subtotal: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
}

export interface Order {
    _id: string;
    projectId: string;
    items: CartItem[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    customer?: { name?: string; email?: string };
    paymentProvider: 'stripe' | 'paypal' | 'manual';
    paymentStatus: 'pending' | 'paid' | 'failed';
    fulfillmentStatus: 'pending' | 'fulfilled' | 'cancelled';
    externalId?: string;
    createdAt: string;
    updatedAt: string;
}

const getAuthHeaders = (): HeadersInit => {
    const userStr = localStorage.getItem('grapes_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const token = user?.token;

    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
    }
    return response.json();
};

// CART
export const getCart = async (projectId: string): Promise<Cart> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/cart`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const addCartItem = async (
    projectId: string,
    productId: string,
    quantity: number
): Promise<Cart> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/cart/items`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ productId, quantity }),
    });
    return handleResponse(response);
};

export const updateCartItem = async (
    projectId: string,
    itemId: string,
    quantity: number
): Promise<Cart> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/cart/items/${itemId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ quantity }),
    });
    return handleResponse(response);
};

export const removeCartItem = async (projectId: string, itemId: string): Promise<Cart> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const clearCart = async (projectId: string): Promise<Cart> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/cart/clear`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

// ORDERS
export const getOrders = async (projectId: string): Promise<Order[]> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/orders`, {
        headers: getAuthHeaders(),
    });
    return handleResponse(response);
};

export const createOrder = async (
    projectId: string,
    cartId?: string,
    customer?: { name?: string; email?: string }
): Promise<Order> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/orders`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ cartId, customer }),
    });
    return handleResponse(response);
};

export const updateOrderStatus = async (
    projectId: string,
    orderId: string,
    updates: { paymentStatus?: Order['paymentStatus']; fulfillmentStatus?: Order['fulfillmentStatus'] }
): Promise<Order> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/orders/${orderId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
    });
    return handleResponse(response);
};

// CHECKOUT
export const createStripeCheckout = async (
    projectId: string,
    cartId: string,
    successUrl?: string,
    cancelUrl?: string
): Promise<{ id: string; url?: string }> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/checkout/stripe`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ cartId, successUrl, cancelUrl }),
    });
    return handleResponse(response);
};

export const createPayPalCheckout = async (
    projectId: string,
    cartId: string,
    returnUrl?: string,
    cancelUrl?: string
): Promise<{ id: string; url?: string }> => {
    const response = await fetch(`${API_URL}/commerce/${projectId}/checkout/paypal`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ cartId, returnUrl, cancelUrl }),
    });
    return handleResponse(response);
};
