import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Plus, Trash2, X, ShoppingCart, CreditCard, ClipboardList } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { createProduct, deleteProduct, getProducts, Product } from '../../services/productService';
import {
    addCartItem,
    clearCart,
    createOrder,
    createPayPalCheckout,
    createStripeCheckout,
    getCart,
    getOrders,
    removeCartItem,
    updateCartItem,
    Cart,
    Order,
} from '../../services/commerceService';

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) return err.message;
    return fallback;
};

export const EcommercePanel: React.FC = () => {
    const { currentProject } = useProject();
    const projectId = currentProject?._id || '';

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [activeTab, setActiveTab] = useState<'products' | 'cart' | 'checkout' | 'orders'>('products');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [description, setDescription] = useState('');
    const [cart, setCart] = useState<Cart | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');

    const selectedProduct = useMemo(
        () => products.find((product) => product._id === selectedProductId),
        [products, selectedProductId]
    );

    const loadProducts = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const data = await getProducts(projectId);
            setProducts(data);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load products'));
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const loadCart = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await getCart(projectId);
            setCart(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load cart'));
        }
    }, [projectId]);

    const loadOrders = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await getOrders(projectId);
            setOrders(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load orders'));
        }
    }, [projectId]);

    useEffect(() => {
        loadCart();
        loadOrders();
    }, [loadCart, loadOrders]);

    const handleCreate = async () => {
        if (!projectId || !name.trim() || !price) return;
        try {
            const created = await createProduct(projectId, {
                name: name.trim(),
                price: Number(price),
                currency,
                description: description.trim() || undefined,
                status: 'active',
            });
            setProducts([created, ...products]);
            setShowCreate(false);
            setName('');
            setPrice('');
            setDescription('');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create product'));
        }
    };

    const handleDelete = async (productId: string) => {
        if (!confirm('Delete this product?')) return;
        try {
            await deleteProduct(projectId, productId);
            setProducts(products.filter((p) => p._id !== productId));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to delete product'));
        }
    };

    const handleAddToCart = async () => {
        if (!projectId || !selectedProductId) return;
        try {
            const updated = await addCartItem(projectId, selectedProductId, Number(quantity || 1));
            setCart(updated);
            setQuantity('1');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to add to cart'));
        }
    };

    const handleUpdateCartItem = async (itemId: string, qty: number) => {
        if (!projectId) return;
        try {
            const updated = await updateCartItem(projectId, itemId, qty);
            setCart(updated);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update cart'));
        }
    };

    const handleRemoveCartItem = async (itemId: string) => {
        if (!projectId) return;
        try {
            const updated = await removeCartItem(projectId, itemId);
            setCart(updated);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to remove item'));
        }
    };

    const handleClearCart = async () => {
        if (!projectId) return;
        try {
            const updated = await clearCart(projectId);
            setCart(updated);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to clear cart'));
        }
    };

    const handleCreateOrder = async () => {
        if (!projectId || !cart?._id) return;
        try {
            const order = await createOrder(projectId, cart._id, {
                name: customerName.trim() || undefined,
                email: customerEmail.trim() || undefined,
            });
            setOrders([order, ...orders]);
            await loadCart();
            setCustomerName('');
            setCustomerEmail('');
            setActiveTab('orders');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to create order'));
        }
    };

    const handleStripeCheckout = async () => {
        if (!projectId || !cart?._id) return;
        try {
            const result = await createStripeCheckout(projectId, cart._id);
            if (result.url) {
                window.open(result.url, '_blank');
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to start Stripe checkout'));
        }
    };

    const handlePayPalCheckout = async () => {
        if (!projectId || !cart?._id) return;
        try {
            const result = await createPayPalCheckout(projectId, cart._id);
            if (result.url) {
                window.open(result.url, '_blank');
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to start PayPal checkout'));
        }
    };

    if (!projectId) {
        return <div className="p-4 text-slate-400 text-sm">Select a project to manage products.</div>;
    }

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package size={18} />
                    Products
                </h3>
                <button
                    onClick={() => setShowCreate(true)}
                    className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                    aria-label="Add product"
                >
                    <Plus size={16} />
                </button>
            </div>

            {error && (
                <div className="mb-3 p-2 bg-red-500/20 text-red-300 rounded text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-300">
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2 mb-4 text-xs">
                {([
                    { id: 'products', label: 'Products', icon: Package },
                    { id: 'cart', label: 'Cart', icon: ShoppingCart },
                    { id: 'checkout', label: 'Checkout', icon: CreditCard },
                    { id: 'orders', label: 'Orders', icon: ClipboardList },
                ] as const).map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1 rounded border transition-colors flex items-center gap-1 ${
                            activeTab === tab.id
                                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
                                : 'bg-[#0a0a1a] text-slate-400 border-[#2a2a4a] hover:text-white'
                        }`}
                    >
                        <tab.icon size={12} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading && products.length === 0 && (
                <div className="text-slate-400 text-sm">Loading products...</div>
            )}

            {!loading && products.length === 0 && (
                <div className="text-slate-400 text-sm">No products yet.</div>
            )}

            {activeTab === 'products' && (
                <div className="space-y-2">
                    {products.map((product) => (
                        <div
                            key={product._id}
                            className="flex items-center justify-between p-3 rounded-lg bg-[#141428] border border-[#2a2a4a]"
                        >
                            <div className="min-w-0">
                                <div className="font-medium truncate">{product.name}</div>
                                <div className="text-xs text-slate-400 truncate">
                                    {product.currency} {product.price}
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(product._id)}
                                className="text-red-400 hover:text-red-300 p-1"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'cart' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="col-span-2 bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                        >
                            <option value="">Select product</option>
                            {products.map((product) => (
                                <option key={product._id} value={product._id}>
                                    {product.name}
                                </option>
                            ))}
                        </select>
                        <input
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                            placeholder="Qty"
                        />
                    </div>
                    <button
                        onClick={handleAddToCart}
                        disabled={!selectedProductId}
                        className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-40"
                    >
                        Add to cart
                    </button>

                    <div className="border-t border-[#2a2a4a] pt-3">
                        {cart?.items?.length ? (
                            <div className="space-y-2">
                                {cart.items.map((item) => (
                                    <div key={item._id} className="flex items-center justify-between p-2 rounded bg-[#141428] border border-[#2a2a4a]">
                                        <div>
                                            <div className="text-sm text-slate-200">{item.name}</div>
                                            <div className="text-[11px] text-slate-400">
                                                {item.currency} {item.price} × {item.quantity}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                value={String(item.quantity)}
                                                onChange={(e) => handleUpdateCartItem(item._id, Number(e.target.value || 1))}
                                                className="w-12 bg-[#0a0a1a] border border-[#2a2a4a] rounded px-1 py-1 text-xs text-white"
                                            />
                                            <button
                                                onClick={() => handleRemoveCartItem(item._id)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="text-xs text-slate-400">Subtotal: {cart.currency} {cart.subtotal}</div>
                                <button
                                    onClick={handleClearCart}
                                    className="px-3 py-1 text-xs bg-[#0a0a1a] border border-[#2a2a4a] rounded text-slate-300"
                                >
                                    Clear cart
                                </button>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500">Cart is empty.</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'checkout' && (
                <div className="space-y-3">
                    <div className="text-xs text-slate-400">Cart total</div>
                    <div className="text-lg text-slate-200">
                        {cart?.currency || 'USD'} {cart?.subtotal || 0}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                            placeholder="Customer name"
                        />
                        <input
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            className="bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                            placeholder="Customer email"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleStripeCheckout}
                            disabled={!cart?.items?.length}
                            className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-40"
                        >
                            Stripe checkout
                        </button>
                        <button
                            onClick={handlePayPalCheckout}
                            disabled={!cart?.items?.length}
                            className="px-3 py-1 text-xs bg-[#0a0a1a] border border-[#2a2a4a] rounded text-slate-300 disabled:opacity-40"
                        >
                            PayPal checkout
                        </button>
                        <button
                            onClick={handleCreateOrder}
                            disabled={!cart?.items?.length}
                            className="px-3 py-1 text-xs bg-emerald-500 text-black rounded hover:bg-emerald-400 disabled:opacity-40"
                        >
                            Create order
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'orders' && (
                <div className="space-y-2">
                    {orders.length === 0 && <div className="text-xs text-slate-500">No orders yet.</div>}
                    {orders.map((order) => (
                        <div key={order._id} className="p-3 rounded-lg bg-[#141428] border border-[#2a2a4a]">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-200">Order {order._id.slice(0, 6)}</div>
                                <div className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                {order.currency} {order.total} · {order.paymentStatus} · {order.fulfillmentStatus}
                            </div>
                            <div className="mt-2 text-[11px] text-slate-300">
                                Items: {order.items.length}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="w-full max-w-md bg-[#101020] border border-[#2a2a4a] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">New Product</h4>
                            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="Product name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Price</label>
                                <input
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="99.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Currency</label>
                                <input
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-white"
                                    placeholder="USD"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#0a0a1a] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white h-16"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowCreate(false)}
                                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
