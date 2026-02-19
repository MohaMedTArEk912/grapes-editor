
import { httpApi } from './useHttpApi';

// Re-export shared types
export * from '../types/api';

/**
 * Web-only API hook.
 * Previously switched between Tauri and HTTP, now exclusively uses HTTP.
 */
export function useApi() {
    return httpApi;
}

export const api = httpApi;
export default useApi;

