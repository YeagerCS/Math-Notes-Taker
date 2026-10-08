import { session } from '../auth/session';
import type { NewPageBackground, Notebook, NotebookInput, NotebookSummary, Page, Stroke } from './types';

// Default: API on port 3000 of whatever host served the page (works for localhost and LAN devices).
// In production VITE_API_URL is set at build time (https://api.malisi.ch).
const API_URL = (import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:3000`).replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown> | null;
  constructor(status: number, message: string, body: Record<string, unknown> | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  // JSON bodies are strings; binary uploads (Blob) carry their own type.
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  else if (init.body instanceof Blob) headers.set('Content-Type', init.body.type);
  const token = session.token();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // Expired/invalid token anywhere except the login call itself → back to the login screen.
    if (res.status === 401 && path !== '/auth/login') session.clear();
    throw new ApiError(res.status, body?.message ?? body?.error ?? res.statusText, body);
  }
  return res;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init);
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  login: (password: string) =>
    request<{ token: string; expiresAt: string }>('/auth/login', { method: 'POST', body: json({ password }) }),

  listNotebooks: () => request<NotebookSummary[]>('/notebooks'),
  getNotebook: (id: string) => request<Notebook>(`/notebooks/${id}`),
  createNotebook: (input: NotebookInput) =>
    request<NotebookSummary>('/notebooks', { method: 'POST', body: json(input) }),
  updateNotebook: (id: string, input: Partial<NotebookInput>) =>
    request<NotebookSummary>(`/notebooks/${id}`, { method: 'PATCH', body: json(input) }),
  deleteNotebook: (id: string) => request<void>(`/notebooks/${id}`, { method: 'DELETE' }),

  /** Adds a page at `position` (default: the end), optionally with a background image. */
  addPage: (notebookId: string, options: { position?: number; background?: NewPageBackground } = {}) => {
    const query = new URLSearchParams();
    if (options.position !== undefined) query.set('position', String(options.position));
    if (options.background) {
      query.set('width', String(options.background.width));
      query.set('height', String(options.background.height));
    }
    const suffix = query.size ? `?${query}` : '';
    return request<Page>(`/notebooks/${notebookId}/pages${suffix}`, { method: 'POST', body: options.background?.blob });
  },
  /** Reorders a page to the given 0-based position. */
  movePage: (pageId: string, position: number) =>
    request<{ id: string; position: number }>(`/pages/${pageId}`, { method: 'PATCH', body: json({ position }) }),
  getPageBackground: (pageId: string) => send(`/pages/${pageId}/background`).then((res) => res.blob()),
  savePage: (pageId: string, strokes: Stroke[]) =>
    request<void>(`/pages/${pageId}`, { method: 'PUT', body: json({ strokes }) }),
  deletePage: (pageId: string) => request<void>(`/pages/${pageId}`, { method: 'DELETE' }),
};
