# Jinary Streaming Protocol (v1)

> **Status:** 구현 합의됨
> **백엔드 구현 완료:** 2026-06-02 (commit `5aa6bc3`)
> **프론트 구현:** 진행 중 (`front-streamingWork` 브랜치)

---

## 1. 동기

기존 `@Jinary` 어노테이션은 "객체 하나 ↔ 바이너리 하나" 모델이라, 수 MB 이상 데이터를 메모리에 통째로 올려야 함. AI 시대 대용량 시나리오(벡터, 로그 스트림, 멀티미디어)에서 비효율적.

**목표:** 백엔드가 메시지를 청크 단위로 흘려보내고, 프론트는 도착 즉시 디코딩해서 소비.

---

## 2. Wire Format

**Length-delimited Protobuf** (protobuf 표준 포맷).

```
┌──────────┬─────────────┬──────────┬─────────────┬─────┐
│ varint N │ message[N]  │ varint M │ message[M]  │ ... │
└──────────┴─────────────┴──────────┴─────────────┴─────┘
```

- 각 메시지 앞에 varint로 인코딩한 바이트 길이 prefix
- 메시지 자체는 일반 protobuf binary
- 스트림 종료는 HTTP body close (별도 sentinel 없음)

**구현 도구:**
- 백엔드 (Java): `message.writeDelimitedTo(outputStream)` → `JinaryCodec.writeDelimited`
- 프론트 (protobufjs): `MessageType.decodeDelimited(reader)`

→ 양쪽 표준 라이브러리가 이미 지원.

---

## 3. HTTP 규약

### 3.1 다운로드 스트리밍 (서버 → 클라이언트) — **v1 범위**

| 항목 | 값 |
|------|----|
| Method | `GET` |
| Request Header | `Accept: application/x-jinary-stream` |
| Response `Content-Type` | `application/x-jinary-stream` |
| Response `Transfer-Encoding` | `chunked` (서버 자동) |
| Body | length-delimited protobuf 연속 |

### 3.2 업로드 스트리밍 (클라이언트 → 서버) — **v1 범위 밖**

브라우저 `fetch` request body로 ReadableStream 넘기는 게 Chromium만 안정 지원. v1은 다운로드만, 업로드는 v2 이후 검토.

---

## 4. 엔드포인트 컨벤션

**URL은 백엔드가 자유롭게 정함.** 단일/스트림 구분은:

- **백엔드:** 어노테이션이 결정 (`@Jinary` vs `@JinaryStream`)
- **프론트:** 호출 메서드가 결정 (`jinary.get()` vs `jinary.stream()`)
- 같은 URL에 두 모드를 동시 노출하지 않음

---

## 5. 백엔드 구현 (확정)

### 5.1 어노테이션

```java
@JinaryStream
@GetMapping(value = "/users/stream", produces = JinaryMediaTypes.APPLICATION_JINARY_STREAM)
public Stream<User> streamUsers() {
    return userRepository.streamAll();
}
```

### 5.2 지원 반환 타입

- `java.util.stream.Stream<T>`
- `java.util.Iterator<T>`
- `java.lang.Iterable<T>`

(WebFlux `Flux<T>`는 v1에서 도입하지 않음 — Spring MVC 환경에서 위 세 가지로 충분)

### 5.3 처리 흐름 (`JinaryStreamingHttpMessageConverter`)

1. 반환 타입 확인 → 내부적으로 `Iterator<T>`로 변환
2. `Content-Type: application/x-jinary-stream` 응답 헤더
3. 각 요소 T를 protobuf로 직렬화 후 `writeDelimitedTo(outputStream)`
4. 매 청크마다 `flush()` (백엔드가 버퍼링 안 함)
5. iterator 소진 후 stream close

### 5.4 스키마 노출

기존 `/jinary/schema/{typeName}` 엔드포인트 그대로 재사용. 스트리밍 전용 처리 불필요.

### 5.5 데모 엔드포인트

```
GET http://localhost:8080/test/stream/users
```

UserPayload 3개(Sanghwa, Ralph, Proto)를 length-delimited로 송출.

---

## 6. 종료 및 에러 처리 (v1)

| 상황 | 동작 |
|------|------|
| 정상 종료 | HTTP body close → 프론트는 `getReader().read()`가 `done: true` 반환 |
| 시작 전 에러 (스키마 못 찾음 등) | HTTP 4xx/5xx 상태 코드 |
| 시작 후 mid-stream 에러 | 연결 끊김. 프론트는 "스트림 도중 종료" 에러로 처리 |

**v2 검토 사항:** mid-stream에서 구조화된 에러(어떤 타입의 에러인지) 전달. 후보 — HTTP Trailers, 응답 스트림 내 에러 wrapper 메시지.

---

## 7. 프론트 API (확정)

### 7.1 코어 — async iterator

```typescript
// 기본 사용
for await (const user of jinary.stream<User>(url, { schema: 'User' })) {
    console.log(user);
    await db.insert(user);  // 매 청크마다 await 가능 → backpressure 자연스레 적용
}

// 외부 중단 / timeout
const controller = new AbortController();
for await (const chunk of jinary.stream<User>(url, { schema: 'User' }, {
    signal: controller.signal,
    timeout: 30000,
})) {
    // ...
}
controller.abort();
```

### 7.2 React 훅 — 누적 배열

```typescript
const { chunks, done, error, progress, start, stop } = useJinaryStream<User>(url, {
    schema: 'User',
});

// chunks: User[] (지금까지 받은 것 누적)
// done: boolean (스트림 완료 여부)
// progress: { receivedBytes, receivedCount }
// start/stop: 수동 제어 (autoStart 옵션 추가 예정)

return (
    <ul>
        {chunks.map((u) => (
            <li key={u.id}>{u.name}</li>
        ))}
        {!done && !error && <li>loading...</li>}
    </ul>
);
```

---

## 8. 합의 결과 (이전 미해결 항목)

| 항목 | 결정 |
|------|------|
| MIME 타입 이름 | `application/x-jinary-stream` 확정 |
| 백엔드 반환 타입 | `Stream<T>` / `Iterator<T>` / `Iterable<T>` (Flux 도입 안 함) |
| mid-stream 에러 시그널 | **v2 검토 항목으로 유지** |
| 데모 엔드포인트 | `/test/stream/users` (구현 완료) |
| 프론트 코어 API 모양 | async iterator (`for await...of`) |
| 프론트 훅 API 모양 | 누적 배열 (`chunks: T[]`) |

---

## 9. 다음 액션

1. ✅ **정상화** — `@JinaryStream` + `/test/stream/users` 구현 (commit `5aa6bc3`)
2. 🔄 **권민석** — 프론트 `jinary.stream()` + `useJinaryStream` 구현 (진행 중)
3. ⏭ 양쪽 완료 후 통합 테스트 → v0.1.0 publish
