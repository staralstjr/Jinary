import { useState, useCallback } from 'react';
import { jinary, JinaryMeta, JinaryResponse } from '../core/jinary';

// encodeFunction은 외부에서 주입받아 확장성을 높임 (useJinary의 decodeFunction과 대칭)
export const useJinaryMutation = <TInput, TOutput>(
  url: string,
  encodeFunction: (input: TInput) => Uint8Array,
) => {
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
        const binary = encodeFunction(input);
        const result = await jinary.post<TOutput>(url, binary);
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
    [url, encodeFunction],
  );

  return { mutate, data, loading, error, meta };
};
