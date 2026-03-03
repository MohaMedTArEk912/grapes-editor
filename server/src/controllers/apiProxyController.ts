import type { Request, Response } from 'express';

export async function proxyRequest(req: Request, res: Response) {
    const start = Date.now();
    try {
        const { method = 'GET', url, headers = {}, body, params } = req.body;

        if (!url) { res.status(400).json({ error: 'URL is required' }); return; }

        const targetUrl = new URL(url);
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== '') {
                    targetUrl.searchParams.set(key, String(value));
                }
            });
        }

        const fetchOptions: RequestInit = {
            method: method.toUpperCase(),
            headers: { ...headers },
        };

        if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD' && body) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            const headerKeys = Object.keys(headers).map(k => k.toLowerCase());
            if (!headerKeys.includes('content-type')) {
                (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
            }
        }

        const response = await fetch(targetUrl.toString(), fetchOptions);
        const duration = Date.now() - start;

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => { responseHeaders[key] = value; });

        let responseBody = '';
        try { responseBody = await response.text(); } catch { responseBody = '[Could not read response body]'; }

        res.json({
            status: response.status, statusText: response.statusText,
            headers: responseHeaders, body: responseBody,
            duration_ms: duration, url: targetUrl.toString(),
        });
    } catch (error: any) {
        const duration = Date.now() - start;
        console.error('Proxy request failed:', error.message);
        res.json({
            status: 0, statusText: 'Network Error',
            headers: {}, body: error.message || 'Request failed',
            duration_ms: duration, url: req.body?.url || '', error: true,
        });
    }
}
