/**
 * Qwen Health Check Utility
 * Checks if the local Qwen server is running and healthy
 */

const QWEN_URL = process.env.QWEN_URL || 'http://localhost:8000';
const QWEN_TIMEOUT = parseInt(process.env.QWEN_TIMEOUT || '5000', 10);

export async function checkQwenHealth(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), QWEN_TIMEOUT);

        const response = await fetch(`${QWEN_URL}/health`, {
            method: 'GET',
            signal: controller.signal,
        });

        clearTimeout(timeout);
        return response.ok;
    } catch (error) {
        return false;
    }
}

export async function waitForQwenHealth(maxAttempts: number = 30, delayMs: number = 1000): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
        if (await checkQwenHealth()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
}

export function getQwenUrl(): string {
    return QWEN_URL;
}
