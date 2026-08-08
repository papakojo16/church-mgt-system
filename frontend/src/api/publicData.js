import { api } from './client.js';

// Cache layer for the public landing-page data.
let cached = null;
let inflight = null;

// Returns public church data. Serves the cached copy (or the in-flight request) so
// repeated callers share one fetch; `force` bypasses the cache (used by the splash retry).
export function getPublicData({ force = false } = {}) {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight && !force) return inflight;
  // Cache-busting query param keeps the splash data fresh on reload.
  inflight = api
    .get(`/api/public?t=${Date.now()}`)
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
