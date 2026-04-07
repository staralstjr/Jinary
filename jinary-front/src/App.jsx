import React, { useState } from 'react';
// ─── Protobuf 번들에서 인코딩/디코딩 함수를 가져옵니다 ───
// encodeUserList: JS 객체 → Uint8Array(바이너리)로 변환
// decodeUserList: Uint8Array(바이너리) → JS 객체로 복원
import { encodeUserList, decodeUserList } from './proto/user_proto_bundle.js';

// ──────────────────────────────────────────────────────────
// 샘플 유저 데이터를 생성하는 함수
// ──────────────────────────────────────────────────────────
// count 만큼의 가짜 유저 데이터를 배열로 만들어 반환합니다.
// 데이터 양을 조절하면서 JSON vs Protobuf 크기 차이를 비교할 수 있습니다.
function generateSampleUsers(count) {
  const users = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      id: `user-${String(i).padStart(4, '0')}`,
      name: `테스트유저_${i}`,
      email: `user${i}@jinary.dev`,
      age: 20 + (i % 40), // 20~59 사이의 나이
    });
  }
  return users;
}

// ──────────────────────────────────────────────────────────
// 바이트 수를 사람이 읽기 쉬운 단위로 변환하는 유틸 함수
// ──────────────────────────────────────────────────────────
// 예: 1024 → "1.00 KB", 1048576 → "1.00 MB"
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  // Math.log()로 단위를 결정합니다
  // 예: 1500 → log(1500)/log(1024) ≈ 1.05 → floor → 1 → "KB"
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function App() {
  // ─── React 상태(State) 정의 ─────────────────────────────
  // userCount: 생성할 유저 수 (슬라이더로 조절)
  const [userCount, setUserCount] = useState(100);
  // result: 인코딩/디코딩 결과를 담는 객체
  const [result, setResult] = useState(null);

  // ──────────────────────────────────────────────────────────
  // 핵심 함수: JSON vs Protobuf 비교 실행
  // ──────────────────────────────────────────────────────────
  const runComparison = () => {
    // 1) 샘플 데이터 생성
    const users = generateSampleUsers(userCount);

    // ─── JSON 직렬화 ───────────────────────────────────────
    // JSON.stringify(): JS 객체 → JSON 문자열로 변환
    // TextEncoder: 문자열 → UTF-8 바이트 배열(Uint8Array)로 변환
    // → 이렇게 해야 실제 네트워크로 전송될 때의 바이트 크기를 정확히 측정할 수 있습니다.
    const jsonString = JSON.stringify({ users });
    const jsonBytes = new TextEncoder().encode(jsonString);
    const jsonSize = jsonBytes.byteLength; // JSON의 실제 바이트 크기

    // ─── Protobuf 인코딩 ──────────────────────────────────
    // encodeUserList(): { users: [...] } 객체를 바이너리(Uint8Array)로 변환
    // Protobuf는 필드 이름 대신 "필드 번호"를 사용하고,
    // 숫자를 가변 길이 인코딩(Varint)으로 압축하기 때문에
    // JSON보다 훨씬 작은 크기로 동일한 데이터를 표현합니다.
    const protobufBinary = encodeUserList({ users });
    const protobufSize = protobufBinary.byteLength; // Protobuf의 실제 바이트 크기

    // ─── Protobuf 디코딩 (검증용) ─────────────────────────
    // 인코딩한 바이너리를 다시 디코딩해서 원본 데이터와 같은지 확인합니다.
    // 이것이 실제로 백엔드에서 받은 바이너리를 프론트에서 복원하는 과정과 동일합니다.
    const decoded = decodeUserList(protobufBinary);

    // ─── 결과 저장 ────────────────────────────────────────
    // 절감률 계산: (JSON 크기 - Protobuf 크기) / JSON 크기 × 100
    const savedPercent = ((1 - protobufSize / jsonSize) * 100).toFixed(1);

    setResult({
      userCount,
      jsonSize,
      protobufSize,
      savedPercent,
      // 디코딩 결과에서 처음 3개 유저만 미리보기로 보여줍니다.
      decodedPreview: decoded.users.slice(0, 3),
      // 인코딩된 바이너리의 처음 50바이트를 16진수로 보여줍니다.
      // 이렇게 하면 실제로 바이너리 데이터가 어떻게 생겼는지 눈으로 확인할 수 있어요.
      rawHex: Array.from(protobufBinary.slice(0, 50))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' '),
    });
  };

  // ──────────────────────────────────────────────────────────
  // 화면 렌더링 (JSX)
  // ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        padding: '40px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      {/* ─── 헤더 영역 ─── */}
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>
        Jinary PoC - 바이너리 통신 데모
      </h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        백엔드 없이 프론트엔드에서 JSON vs Protobuf 크기를 직접 비교합니다.
      </p>

      <div
        style={{
          background: '#f8f9fa',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #e0e0e0',
        }}
      >
        <label
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            display: 'block',
            marginBottom: '12px',
          }}
        >
          생성할 유저 수:{' '}
          <span style={{ color: '#aa3bff' }}>{userCount}명</span>
        </label>

        <input
          type="range"
          min="10"
          max="5000"
          step="10"
          value={userCount}
          onChange={(e) => setUserCount(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />

        {/* 슬라이더 아래에 범위 표시 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#999',
          }}
        >
          <span>10명</span>
          <span>5,000명</span>
        </div>
      </div>

      {/* ─── 비교 실행 버튼 ─── */}
      <button
        onClick={runComparison}
        style={{
          padding: '14px 32px',
          fontSize: '16px',
          cursor: 'pointer',
          background: '#aa3bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 'bold',
          width: '100%',
          marginBottom: '32px',
        }}
      >
        JSON vs Protobuf 비교 실행
      </button>
      {result && (
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
                {formatBytes(result.jsonSize)}
              </div>
              <div
                style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}
              >
                {result.jsonSize.toLocaleString()} bytes
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
                {formatBytes(result.protobufSize)}
              </div>
              <div
                style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}
              >
                {result.protobufSize.toLocaleString()} bytes
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
              {result.savedPercent}% 작음
            </div>
            <div style={{ fontSize: '13px', opacity: 0.8 }}>
              {result.userCount}명 기준 |{' '}
              {formatBytes(result.jsonSize - result.protobufSize)} 절감
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
              {result.rawHex}
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
              디코딩 검증 (처음 3명)
            </div>
            {result.decodedPreview.map((user, i) => (
              <div
                key={i}
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
                <strong>{user.name}</strong>
                <span style={{ color: '#999', marginLeft: '8px' }}>
                  {user.id} | {user.email} | {user.age}세
                </span>
              </div>
            ))}
            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              바이너리 → 디코딩 → JS 객체 복원 성공
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
