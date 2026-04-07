import { useState, useCallback } from 'react';

// decodeFunction은 외부에서 주입받도록 설계하여 확장성을 높임
export const useJinary = (url, decodeFunction) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 성능 측정을 위한 메타데이터 상태
  const [meta, setMeta] = useState({
    protobufSize: 0,
    jsonSize: 0,
    rawHex: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/x-protobuf' },
      });

      if (!response.ok) {
        throw new Error(
          `서버 응답 오류: ${response.status} ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const binaryData = new Uint8Array(arrayBuffer);
      const protobufSize = binaryData.byteLength;

      // 주입받은 디코딩 함수 실행
      const decoded = decodeFunction(binaryData);

      // JSON 크기 비교 로직 (메타데이터용)
      const jsonSize = new TextEncoder().encode(
        JSON.stringify(decoded),
      ).byteLength;

      setData(decoded);
      setMeta({
        protobufSize,
        jsonSize,
        rawHex: Array.from(binaryData.slice(0, 50))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' '),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url, decodeFunction]);

  // 반환값: UI에 필요한 모든 상태와 fetch 함수
  return { data, loading, error, meta, fetchData };
};
