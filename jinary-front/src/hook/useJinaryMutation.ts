import { useState, useCallback } from 'react';
import { jinary, JinaryMeta, JinaryResponse } from '../core/jinary';

interface UseJinaryMutationConfig {
  schema: string;
  baseURL: string;
}

export const useJinaryMutation = <TInput extends object, TOutput>(
  url: string,
  config: UseJinaryMutationConfig,
) => {
  const { schema, baseURL } = config;
  const [data, setData] = useState<TOutput | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<JinaryMeta>({
    protobufSize: 0,
    jsonSize: 0,
    rawHex: '',
  });

  const mutate = useCallback(
    async (input: TInput): Promise<JinaryResponse<TOutput>> => {
      setLoading(true);
      setError(null);

      try {
        const result = await jinary.post<TOutput>(url, input, {
          schema,
          baseURL,
        });
        setData(result.data);
        setMeta(result.meta);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [url, schema, baseURL],
  );

  return { mutate, data, loading, error, meta };
};
