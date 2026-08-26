import { useCallback, useEffect, useState } from 'react';
import api from '../api/client.js';

/**
 * Fetches an endpoint and exposes { data, error, loading, reload }.
 * Pass `null` as the endpoint to skip the request.
 */
export function useApi(endpoint, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(endpoint));

  const load = useCallback(async () => {
    if (!endpoint) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await api.get(endpoint));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export default useApi;
