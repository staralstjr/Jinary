import React, { useState, useEffect } from 'react';
import * as ProtoBundle from './proto/user_proto_bundle.js';

function App() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/x-protobuf',
          // 백엔드로부터 protobuf 데이터를 받는다는 것을 알려줍니다.
        },
      });

      if (!response.ok) {
        throw new Error(`백엔드 서버 에러: ${response.status}`);
      }

      // 핵심: 데이터를 텍스트(.json())가 아닌 로우 레벨 바이너리데이터인 ArrayBuffer로 받습니다.
      const arrayBuffer = await response.arrayBuffer();

      // 받은 ArrayBuffer를 Protobuf 메시지로 디코딩합니다.
      decodeProtobuf(arrayBuffer);
    } catch (err) {
      console.error('데이터 불러오기 실패:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const decodeProtobuf = (buffer) => {
    try {
      // import한 프로토 번들에서 네가 디코딩할 메시지 타입을 찾습니다.
      //    가상의 패키지명(awesome.package)과 메시지명(UserResponse)을 사용했으니,
      //    네 실제 `.proto` 파일의 패키지명과 메시지명으로 바꿔줘!
      const UserResponse = ProtoBundle.awesome.package.UserResponse;

      // 받은 ArrayBuffer를 Uint8Array로 감싸서 decode 함수에 전달합니다.
      const uint8Array = new Uint8Array(buffer);

      // 디코딩이 완료 되었고 이제 0과 1의 데이터를 프론트가 알아볼 수 있는 JS 객체로 만듭니다.
      const decodedMessage = UserResponse.decode(uint8Array);

      // 디코딩된 메시지를 상태에 저장합니다.
      // 주의: protobufjs의 decoded 객체는 가끔 순수 JS 객체가 아닐 수 있으니,
      // `.toObject()`를 사용하여 안전하게 변환합니다.
      const userObj = UserResponse.toObject(decodedMessage, {
        longs: String, // Long 타입 값을 문자열로 변환 (안전함)
        enums: String, // Enum 값을 문자열로 변환 (보기 편함)
        bytes: String, // Bytes 타입을 Base64 문자열로 변환 (이미지/오디오 처리 시 유용)
        // ... 필요한 다른 옵션들을 추가할 수 있습니다.
      });

      setUserData(userObj);
      console.log('성공적으로 디코딩된 유저 객체:', userObj);
    } catch (err) {
      console.error('Protobuf 디코딩 실패:', err);
      setError(
        '데이터 해독에 실패했습니다. `.proto` 스키마가 일치하는지 확인하세요.',
      );
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Binio (비니오) PoC 테스트 대시보드</h1>
      <button
        onClick={fetchUserData}
        disabled={loading}
        style={{ padding: '10px 20px', cursor: 'pointer' }}
      >
        {loading ? '불러오는 중...' : '데이터 다시 불러오기'}
      </button>

      <div
        style={{
          marginTop: '20px',
          border: '1px solid #ccc',
          padding: '15px',
          borderRadius: '8px',
        }}
      >
        <h2>백엔드 응답 결과</h2>

        {loading && <p>데이터를 로딩 중입니다...</p>}
        {error && <p style={{ color: 'red' }}>에러: {error}</p>}

        {!loading && !error && userData && (
          <div>
            <p>
              <strong>유저 ID:</strong> {userData.id}
            </p>
            <p>
              <strong>유저 이름:</strong> {userData.name}
            </p>
            <p>
              <strong>유저 이메일:</strong> {userData.email}
            </p>
          </div>
        )}

        {!loading && !error && !userData && (
          <p>버튼을 눌러 데이터를 불러오세요.</p>
        )}
      </div>
    </div>
  );
}

export default App;
