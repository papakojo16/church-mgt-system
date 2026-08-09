import {
  queueWrite,
  getPendingWrites,
  getPendingCount,
  removePendingWrite,
} from '../offline/db.js';

const TOKEN_KEY = 'mtolivet_token';
const USER_KEY = 'mtolivet_user';

// Subscribers (e.g. AuthContext) notified whenever the queued-write count changes.
const listeners = new Set();

export function onPendingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyPending() {
  getPendingCount().then((n) => listeners.forEach((fn) => fn(n)));
}

// Modules holding cached server data (e.g. the public landing content) register
// a reset callback so a successful mutation invalidates their cache.
const cacheInvalidators = new Set();

export function onContentMutated(fn) {
  cacheInvalidators.add(fn);
  return () => cacheInvalidators.delete(fn);
}

function invalidateCaches() {
  cacheInvalidators.forEach((fn) => {
    try {
      fn();
    } catch {
      // A failing invalidator must never break the request that triggered it.
    }
  });
}

// Auth token lives in localStorage so it survives reloads.
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// The logged-in user object is cached in localStorage and restored on startup.
export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Only mutating requests are candidates for offline queuing; GETs must not be queued.
const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE']);

export async function request(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const cfg = { method, headers };
  if (body !== undefined && method !== 'GET') cfg.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(path, cfg);
  } catch (err) {
    // Network is unreachable.
    // Offline-first: queue mutating writes to IndexedDB and tell subscribers,
    // so the change is stored locally and replayed to the server later via /api/sync.
    if (WRITE_METHODS.has(method) && opts.queue) {
      const op = opts.op || (method === 'POST' ? 'create' : method === 'PUT' ? 'update' : 'delete');
      await queueWrite({ entity: opts.entity, op, payload: { ...(body || {}) } });
      notifyPending();
      return { queued: true, offline: true };
    }
    throw new ApiError(0, 'Network error. You appear to be offline.');
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = (data && (data.detail || data.error)) || res.statusText || `Error ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  // A successful mutation changes server state, so any cached data (e.g. the
  // public church content reused by the About pages) is now stale.
  if (WRITE_METHODS.has(method)) invalidateCaches();
  return data;
}

// HTTP helpers; mutating calls default to queueing (offline-first) unless opts.queue is false.
export const api = {
  get: (path) => request('GET', path, undefined),
  post: (path, body, opts = {}) => request('POST', path, body, { queue: true, op: 'create', ...opts }),
  put: (path, body, opts = {}) => request('PUT', path, body, { queue: true, op: 'update', ...opts }),
  del: (path, opts = {}) => request('DELETE', path, undefined, { queue: true, op: 'delete', ...opts }),
};

// Replay all queued offline writes in a single batch to /api/sync, dropping each
// successfully-applied entry from IndexedDB and reporting successes/failures.
export async function syncPendingWrites() {
  const writes = await getPendingWrites();
  if (!writes.length) return { synced: 0, failed: 0, offline: false };
  const operations = writes.map((w) => ({ entity: w.entity, op: w.op, payload: w.payload }));
  const res = await request('POST', '/api/sync', { operations }, { queue: false });
  const results = res.results || [];
  let synced = 0;
  let failed = 0;
  writes.forEach((w, i) => {
    const r = results[i];
    if (r && r.success) {
      synced += 1;
      removePendingWrite(w.id).catch(() => {});
    } else {
      failed += 1;
    }
  });
  notifyPending();
  return { synced, failed };
}

export async function pendingCount() {
  return getPendingCount();
}
