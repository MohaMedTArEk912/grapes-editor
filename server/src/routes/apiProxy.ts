import { Router } from 'express';

const router = Router();

// POST /api/proxy — Forward an HTTP request to avoid CORS
router.post('/', async (req, res) => {
    const start = Date.now();
    try {
        const { method = 'GET', url, headers = {}, body, params } = req.body;

        if (!url) {
            res.status(400).json({ error: 'URL is required' });
            return;
        }

        // Build the full URL with query params
        const targetUrl = new URL(url);
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== '') {
                    targetUrl.searchParams.set(key, String(value));
                }
            });
        }

        // Prepare fetch options
        const fetchOptions: RequestInit = {
            method: method.toUpperCase(),
            headers: { ...headers },
        };

        // Add body for non-GET requests
        if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD' && body) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            // Set Content-Type if not already set
            const headerKeys = Object.keys(headers).map(k => k.toLowerCase());
            if (!headerKeys.includes('content-type')) {
                (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
            }
        }

        // Execute the request
        const response = await fetch(targetUrl.toString(), fetchOptions);
        const duration = Date.now() - start;

        // Read response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        // Read response body as text
        let responseBody = '';
        try {
            responseBody = await response.text();
        } catch {
            responseBody = '[Could not read response body]';
        }

        res.json({
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
            duration_ms: duration,
            url: targetUrl.toString(),
        });
    } catch (error: any) {
        const duration = Date.now() - start;
        console.error('Proxy request failed:', error.message);
        res.json({
            status: 0,
            statusText: 'Network Error',
            headers: {},
            body: error.message || 'Request failed',
            duration_ms: duration,
            url: req.body?.url || '',
            error: true,
        });
    }
});

export default router;
