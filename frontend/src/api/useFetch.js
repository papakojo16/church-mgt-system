import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './client.js';

// Generic data-fetching hook: runs `fn` whenever `deps` change and tracks
// data/error/loading state, exposing `reload` for manual refetch.
export function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // Ref holds the latest fetcher so `run` never depends on a stale closure.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Request failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    run().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: run };
}

export { ApiError };
