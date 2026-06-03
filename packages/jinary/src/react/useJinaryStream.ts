import { useState, useCallback, useEffect, useRef } from 'react';
import { jinary } from '..';

interface UseJinaryStreamConfig {
  schema: string;
  baseURL: string;
}

interface UseJinaryStreamOptions {
  autoStart?: boolean;
}

export const useJinaryStream = <T>(
  url: string,
  config: UseJinaryStreamConfig,
  options: UseJinaryStreamOptions = {},
) => {
  const { schema, baseURL } = config;
  const [chunks, setChunks] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 진행 중인 스트림의 AbortController. unmount/재시작 시 취소용.
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    // 이미 진행 중이면 먼저 중단
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setChunks([]);
    setError(null);
    setLoading(true);

    try {
      for await (const chunk of jinary.stream<T>(
        url,
        { schema, baseURL },
        { signal: controller.signal },
      )) {
        if (controller.signal.aborted) break;
        setChunks((prev) => [...prev, chunk]);
      }
    } catch (err) {
      // 사용자 의도 cancel은 에러로 노출하지 않음
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  }, [url, schema, baseURL]);

  useEffect(() => {
    if (options.autoStart) {
      start();
    }
    // unmount 또는 deps 변경 시 진행 중인 스트림 자동 중단
    return () => {
      stop();
    };
  }, [options.autoStart, start, stop]);

  return { chunks, loading, error, start, stop };
};
