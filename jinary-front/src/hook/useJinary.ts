import { useState, useCallback, useEffect } from 'react';
import { jinary, JinaryMeta } from '../core/jinary';

interface UseJinaryOptions {
  autoFetch?: boolean;
}

interface UseJinarySchemaConfig {
  schema: string;
  baseURL: string;
}

export const useJinary = <T>(
  url: string,
  config: UseJinarySchemaConfig,
  options: UseJinaryOptions = {},
) => {
  const { schema, baseURL } = config;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<JinaryMeta>({
    protobufSize: 0,
    jsonSize: 0,
    rawHex: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await jinary.get<T>(url, { schema, baseURL });
      setData(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [url, schema, baseURL]);

  useEffect(() => {
    if (options.autoFetch) {
      fetchData();
    }
  }, [options.autoFetch, fetchData]);

  return { data, loading, error, meta, fetchData };
};
