import { api, onContentMutated } from './client.js';

// Cache layer for the public landing-page data.
let cached = null;
let inflight = null;

// Any successful mutation anywhere in the app invalidates this cache so the
// public About/Landing pages never show stale content within a session.
onContentMutated(() => {
  cached = null;
  inflight = null;
});

// Returns public church data. Serves the cached copy (or the in-flight request) so
// repeated callers share one fetch; `force` bypasses the cache (used by the splash retry).
export function getPublicData({ force = false } = {}) {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight && !force) return inflight;
  // Stable URL (no cache-busting param) so the browser HTTP cache / service
  // worker can serve repeat visits instantly; /api/public is bounded fresh by a
  // short max-age server-side.
  inflight = api
    .get('/api/public')
    .then((d) => {
      cached = d;
      inflight = null;
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
