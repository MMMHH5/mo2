import axios from 'axios';

// Base URL used for file preview URLs across the app.
// The NestJS backend has NO global "/api" prefix, so strip a trailing "/api"
// defensively even if it was baked in at build time from an older variable.
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');

// Extract a human-readable message from any thrown error (axios, Error, unknown)
export function getErrorMessage(err: unknown): string {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string } | undefined;
        return data?.message || err.message || 'An error occurred.';
    }
    if (err instanceof Error) {
        return err.message || 'An error occurred.';
    }
    return 'An error occurred.';
}

// Create a centralized Axios instance
export const api = axios.create({
    baseURL: API_BASE_URL, // Our NestJS Backend
    headers: {
        'Content-Type': 'application/json',
    },
});

const TOKEN_KEY = 'laxalab_token';
const REFRESH_KEY = 'laxalab_refresh';
const USER_KEY = 'laxalab_user';

// Interceptor to inject the JWT token automatically
api.interceptors.request.use(
    (config) => {
        // We fetch the token from localStorage
        const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function storeTokens(access: string, refresh?: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

function clearAuth() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
}

async function tryRefresh(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { headers: { 'Content-Type': 'application/json' } });
        const access = res.data?.access_token;
        if (access) {
            storeTokens(access, res.data?.refresh_token);
            return access;
        }
    } catch {
        // fall through
    }
    clearAuth();
    if (typeof window !== 'undefined') {
        window.location.replace('/login');
    }
    return null;
}

// Interceptor to catch 401 Unauthorized and attempt a token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error?.config;
        if (error?.response?.status !== 401 || !original || original._retried) {
            return Promise.reject(error);
        }
        if (original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh') || original.url?.includes('/auth/2fa/verify-login') || original.url?.includes('/auth/change-password')) {
            return Promise.reject(error);
        }

        original._retried = true;
        if (isRefreshing) {
            // Queue the request until the in-flight refresh completes
            return new Promise((resolve, reject) => {
                pendingQueue.push((token) => {
                    if (token) {
                        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${token}` };
                        resolve(api(original));
                    } else {
                        reject(error);
                    }
                });
            });
        }

        isRefreshing = true;
        const fresh = await tryRefresh();
        isRefreshing = false;
        pendingQueue.forEach((cb) => cb(fresh));
        pendingQueue = [];

        if (fresh) {
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${fresh}` };
            return api(original);
        }
        return Promise.reject(error);
    }
);

// --- Authenticated downloads / previews ------------------------------------
// The backend serves receipts/CVs through role-gated endpoints (e.g.
// GET /enrollments/:id/receipt, GET /instructor-applications/:id/cv) that
// require a JWT and set Content-Disposition. These helpers fetch the file AS A
// BLOB (so the Authorization header follows the request) instead of pointing a
// plain <a href> at the previously public /uploads/... path.

function blobFilename(res: { headers: Record<string, unknown> }, fallback: string): string {
    const cd = res.headers?.['content-disposition'];
    if (typeof cd === 'string') {
        const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
        if (m && m[1]) return m[1];
    }
    return fallback || 'file';
}

// Fetch a protected file as a blob and return a temporary object URL + name.
// Caller is responsible for revoking the URL with URL.revokeObjectURL(url).
export async function fetchProtectedFile(path: string): Promise<{ url: string; name: string }> {
    const res = await api.get(path, { responseType: 'blob' });
    const name = blobFilename(res, (path.split('/').pop() || 'file'));
    return { url: URL.createObjectURL(res.data as Blob), name };
}

// Download a protected file to disk (triggers the browser save dialog).
export async function downloadProtectedFile(path: string) {
    const { url, name } = await fetchProtectedFile(path);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
