import { api, onContentMutated } from './client.js';

// Cache layer for the public landing-page data.
let cached = null;
let inflight = null;
// True after any successful mutation: the next fetch must bypass the browser
// HTTP cache (max-age=60) so newly created/edited public content (e.g. events)
// appears immediately instead of being served from the stale cached response.
let needsFresh = false;

// Any successful mutation anywhere in the app invalidates this cache so the
// public About/Landing pages never show stale content within a session.
onContentMutated(() => {
  cached = null;
  inflight = null;
  needsFresh = true;
});

// Returns public church data. Serves the cached copy (or the in-flight request) so
// repeated callers share one fetch; `force` bypasses the cache (used by the splash retry).
export function getPublicData({ force = false } = {}) {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight && !force) return inflight;
  // Stable URL (no cache-busting param) so the browser HTTP cache / service
  // worker can serve repeat visits instantly; /api/public is bounded fresh by a
  // short max-age server-side. Right after a mutation, bypass that HTTP cache.
  const fresh = force || needsFresh;
  inflight = api
    .get('/api/public', fresh ? { cache: 'no-store' } : {})
    .then((d) => {
      cached = d;
      inflight = null;
      needsFresh = false;
      return d;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

export function clearPublicData() {
  cached = null;
  inflight = null;
}

// Kick off the public-content fetch at app startup (fired from main.jsx) so the
// About/Landing pages render instantly later — even for users who skip the
// landing page and go straight to the dashboard.
export function preloadPublicData() {
  getPublicData().catch(() => {});
}
