import React, { useState } from 'react';
import { useJinary, useJinaryMutation, useJinaryStream } from 'jinary/react';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const SCHEMA_CONFIG = { schema: 'UserPayload', baseURL: BACKEND_URL };

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  // Math.log()로 단위를 결정합니다
  // 예: 1500 → log(1500)/log(1024) ≈ 1.05 → floor → 1 → "KB"
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function App() {
  const { data, loading, error, meta, fetchData } = useJinary(
    BACKEND_URL + '/test/binary',
    SCHEMA_CONFIG,
  );

  const {
    mutate: postUser,
    data: postReceived,
    loading: postLoading,
    error: postError,
    meta: postMeta,
  } = useJinaryMutation(
    BACKEND_URL + '/test/json-from-binary',
    SCHEMA_CONFIG,
  );
  const [postSent, setPostSent] = useState(null);

  const {
    chunks: streamChunks,
    loading: streamLoading,
    error: streamError,
    start: startStream,
    stop: stopStream,
  } = useJinaryStream(
    BACKEND_URL + '/test/stream/users',
    SCHEMA_CONFIG,
  );

  const streamStatus = streamError
    ? '에러'
    : streamLoading
    ? '수신 중'
    : streamChunks.length > 0
    ? '완료'
    : '대기';

  async function handlePostTest() {
    const payload = {
      id: 202417051,
      name: 'Sanghwa',
      email: 'test@skhu.ac.kr',
    };
    setPostSent(payload);
    try {
      await postUser(payload);
    } catch {
      // 에러 상태는 훅 내부에서 관리됨
    }
  }
  
  const savedPercent = meta.jsonSize > 0                                                                             
    ? ((1 - meta.protobufSize / meta.jsonSize) * 100).toFixed(1)
    : '0';

  return (
    <div
      style={{
        padding: '40px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>
        Jinary PoC - 바이너리 통신 데모
      </h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        백엔드({BACKEND_URL})에서 Protobuf 바이너리를 받아 디코딩합니다.
      </p>

      <button
        onClick={fetchData}
        disabled={loading}
        style={{
          padding: '14px 32px',
          fontSize: '16px',
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? '#ccc' : '#aa3bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 'bold',
          width: '100%',
          marginBottom: '24px',
        }}
      >
        {loading ? '요청 중...' : '백엔드에서 바이너리 데이터 받기'}
      </button>

      {error && (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            background: '#fff5f5',
            border: '1px solid #ff6b6b',
            color: '#c92a2a',
            marginBottom: '24px',
          }}
        >
          {error}
        </div>
      )}
      {data && (
        <div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div
              style={{
                flex: 1,
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #ff6b6b',
                background: '#fff5f5',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  color: '#ff6b6b',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                JSON
              </div>
              <div
                style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}
              >
                {formatBytes(meta.jsonSize)}
              </div>
              <div
                style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}
              >
                {meta.jsonSize.toLocaleString()} bytes
              </div>
            </div>

            <div
              style={{
                flex: 1,
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #51cf66',
                background: '#f0fff4',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  color: '#51cf66',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                Protobuf
              </div>
              <div
                style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}
              >
                {formatBytes(meta.protobufSize)}
              </div>
              <div
                style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}
              >
                {meta.protobufSize.toLocaleString()} bytes
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #aa3bff, #7c3aed)',
              color: 'white',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Protobuf가 JSON보다
            </div>
            <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
              {savedPercent}% 작음
            </div>
            <div style={{ fontSize: '13px', opacity: 0.8 }}>
              단일 객체 기준 |{' '}
              {formatBytes(meta.jsonSize - meta.protobufSize)} 절감
            </div>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              background: '#1e1e2e',
              color: '#a6e3a1',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                color: '#cdd6f4',
                marginBottom: '12px',
                fontWeight: 'bold',
              }}
            >
              Protobuf 바이너리 미리보기 (처음 50바이트, 16진수)
            </div>
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                wordBreak: 'break-all',
                lineHeight: '1.8',
                display: 'block',
                background: 'transparent',
                padding: 0,
                color: '#a6e3a1',
                borderRadius: 0,
              }}
            >
              {meta.rawHex}
            </code>
          </div>
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              background: '#fafafa',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '12px',
                color: '#333',
              }}
            >
              디코딩 검증
            </div>
            <div
              style={{
                padding: '12px',
                marginBottom: '8px',
                borderRadius: '8px',
                background: 'white',
                border: '1px solid #eee',
                textAlign: 'left',
                fontSize: '14px',
              }}
            >
              <strong>{data.name}</strong>
              <span style={{ color: '#999', marginLeft: '8px' }}>
                {data.id} | {data.email}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              백엔드 바이너리 → Protobuf 디코딩 → JS 객체 복원 성공
            </div>
          </div>
        </div>
      )}
      <div                                                                                                                                                                              
          style={{                                                                                                                                                                        
            marginTop: '40px',                                                                                                                                                          
            padding: '20px',                                                                                                                                                              
            borderRadius: '12px',                                                                                                                                                       
            border: '2px solid #aa3bff',      
            background: '#faf5ff',        
          }}
        >                                                                                                                                                                                 
          <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>
            Round-trip 테스트 (프론트 → 백엔드)                                                                                                                                           
          </h2>                                                                                                                                                                           
          <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>
            JS 객체 → 바이너리 인코딩 → POST → 백엔드가 자바 객체로 자동 디코딩 → JSON 응답                                                                                               
          </p>                                                                                                                                                                            

          <button                                                                                                                                                                         
            onClick={handlePostTest}                                                                                                                                                      
            disabled={postLoading}
            style={{                                                                                                                                                                      
              padding: '12px 24px',                                                                                                                                                     
              background: postLoading ? '#ccc' : '#aa3bff',
              color: 'white',                                                                                                                                                             
              border: 'none',                 
              borderRadius: '8px',                                                                                                                                                        
              cursor: postLoading ? 'wait' : 'pointer',                                                                                                                                 
              fontWeight: 'bold',                                                                                                                                                         
            }}                                
          >                                                                                                                                                                               
            {postLoading ? '전송 중...' : '바이너리로 POST 보내기'}                                                                                                                     
          </button>                                                                                                                                                                       

          {postError && (                                                                                                                                                                 
            <div style={{ marginTop: '16px', color: '#c92a2a' }}>                                                                                                                       
              에러: {postError}                                                                                                                                                           
            </div>                        
          )}                                                                                                                                                                              

          {postReceived && (
            <div style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
              <div>
                <strong>보낸 객체:</strong>
                <pre style={{ background: '#1e1e2e', color: '#a6e3a1', padding: '12px', borderRadius: '6px' }}>
                  {JSON.stringify(postSent, null, 2)}
                </pre>
              </div>
              <div>
                <strong>백엔드가 돌려준 JSON:</strong>
                <pre style={{ background: '#1e1e2e', color: '#a6e3a1', padding: '12px', borderRadius: '6px' }}>
                  {JSON.stringify(postReceived, null, 2)}
                </pre>
              </div>
              <div style={{ fontSize: '14px', color: '#444' }}>
                업로드 바이너리 크기: <strong>{postMeta.protobufSize} bytes</strong>
                {' / '}
                같은 데이터의 JSON 크기: <strong>{postMeta.jsonSize} bytes</strong>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: '40px',
            padding: '20px',
            borderRadius: '12px',
            border: '2px solid #51cf66',
            background: '#f0fff4',
          }}
        >
          <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>
            스트리밍 데모 (서버 → 클라)
          </h2>
          <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>
            length-delimited protobuf 청크를 받아 즉시 디코딩 → 리스트에 누적 표시
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={startStream}
              disabled={streamLoading}
              style={{
                padding: '12px 24px',
                background: streamLoading ? '#ccc' : '#51cf66',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: streamLoading ? 'wait' : 'pointer',
                fontWeight: 'bold',
              }}
            >
              {streamLoading ? '수신 중...' : '스트림 시작'}
            </button>
            <button
              onClick={stopStream}
              disabled={!streamLoading}
              style={{
                padding: '12px 24px',
                background: !streamLoading ? '#ccc' : '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: !streamLoading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
              }}
            >
              중단
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            <div>
              받은 항목 수: <strong>{streamChunks.length}</strong>
            </div>
            <div>
              상태: <strong>{streamStatus}</strong>
            </div>
          </div>

          {streamError && (
            <div style={{ color: '#c92a2a', marginBottom: '16px' }}>
              에러: {streamError}
            </div>
          )}

          {streamChunks.length > 0 && (
            <ol
              style={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '16px 16px 16px 32px',
                margin: 0,
              }}
            >
              {streamChunks.map((u, i) => (
                <li
                  key={`${u.id}-${i}`}
                  style={{ marginBottom: '6px', fontSize: '14px' }}
                >
                  <strong>{u.name}</strong>
                  <span style={{ color: '#999', marginLeft: '8px' }}>
                    id: {u.id} | {u.email}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
    </div>
  );

}

export default App;
