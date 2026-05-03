# front-jinaryPost — 개발 로그

> 작업 기간: 2026.05.03 — 05.04
> 브랜치: `front-jinaryPost`
> 배경: 백엔드 정상화 형이 `@Jinary` 어노테이션 PR(#13)을 머지한 직후 시작.
> 프론트에서 바이너리 POST가 가능한지, 그리고 백엔드의 어노테이션이
> 의도대로 동작하는지를 양쪽에서 검증하는 게 이번 브랜치의 목표.

---

## 1. 들어가기 전 — 무엇을 증명하고 싶었나

지금까지의 데모는 "백엔드 → 프론트" 한 방향뿐이었다. 양방향이 되어야
"바이너리 통신 라이브러리"라고 부를 수 있고, 백엔드의 `@Jinary`가 정말
**자바 객체처럼 받지만 와이어는 바이너리**인지를 눈으로 검증해야
다음 단계(자동 스키마 협상)로 갈 명분이 생긴다.

발표 관점에서도, 그래프 한 축을 더 그릴 수 있게 된다 — 지금까지는
**다운로드** 절감률만 보여줬는데, **업로드** 방향까지 측정할 수 있게 됨.

## 2. 첫 갈래 — 빠른 round-trip vs 진짜 인코더

처음 떠오른 두 가지 길:

| 옵션 | 작업량 | 결과 |
|---|---|---|
| (A) round-trip 검증 | 작음 | GET 응답 바이너리를 그대로 POST로 되쏘기. 백엔드 검증용 |
| (B) 진짜 인코더 | 큼 | JS 객체 → 바이너리 변환 자체를 프론트가 수행 |

처음엔 (A)가 빨라서 끌렸지만, 결국 (A)는 **버려질 코드**다. 프론트 입장에선
검증 도구일 뿐이고 라이브러리가 갖춰야 할 인코더는 어차피 만들어야 한다.
(B)로 가기로 결정.

## 3. 백엔드 와이어 포맷 확인

(B)로 가려면 백엔드가 어떤 포맷으로 직렬화하는지부터 알아야 한다.
`Jinary-Backend/.../jinary/JinaryCodec.java`와 `JinarySchemaGenerator.java`를
한 번 훑었다.

핵심 발견:
- `DynamicMessage.toByteArray()` — **표준 protobuf**.
- 스키마는 `JinarySchemaGenerator`가 자바 클래스 reflection으로 자동 생성.
- 필드 번호는 자바 record 선언 순서대로 1, 2, 3...

→ 즉 프론트 인코더는 **표준 protobuf 인코더면 충분**. 이미 깔려있는
`protobufjs`로 바로 갈 수 있다는 결론. 별도 라이브러리 도입 불필요.

> ⚠️ 알아둘 함정: 백엔드가 record 필드 순서를 바꾸면 와이어가 깨진다.
> 이건 향후 백엔드 SDK가 풀어야 할 숙제. 일단은 양쪽이 약속으로 유지.

## 4. Step 1 — `UserPayload.proto` + 번들 생성

백엔드 자동 생성 스키마와 1:1 매칭되는 .proto 파일을 손으로 정의:

```proto
syntax = "proto3";

message UserPayload {
  int32  id    = 1;
  string name  = 2;
  string email = 3;
}
```

기존 `proto:gen` 스크립트 컨벤션을 따라 `package.json`에
`proto:gen:payload` 한 줄 추가:

```json
"proto:gen:payload": "npx pbjs --es6 src/proto/user_payload.js src/proto/user_payload.proto"
```

### 함정 — 첫 import 실패

처음에 `import { UserPayload } from '...'` 으로 가져오려다 export 이름
mismatch로 실패. 생성된 번들 파일을 직접 열어봤더니 클래스 형태가 아니라
standalone 함수로 export 되어 있었다:

```js
export function encodeUserPayload(message) { ... }
export function decodeUserPayload(binary)  { ... }
```

→ 결국 import 이름 정정. **생성기가 만든 파일이라도 한 번씩은 열어봐야
한다는 교훈**.

## 5. Step 2 — `core/jinary.ts`에 `post()` 추가

기존 `get()`과 대칭 구조로 작성. 헤더 두 개가 핵심:
- `Content-Type: application/x-jinary` — 백엔드 `JinaryMediaTypes.APPLICATION_JINARY`와 매칭
- `Accept: application/json` — `jsonFromBinary` 엔드포인트의 `produces`

```ts
async function post<T>(
    url: string,
    binary: Uint8Array,
): Promise<JinaryResponse<T>> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-jinary',
            Accept: 'application/json',
        },
        body: binary as BodyInit,
    });
    if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as T;

    const protobufSize = binary.byteLength;
    const jsonSize = new TextEncoder().encode(JSON.stringify(json)).byteLength;

    return {
        data: json,
        meta: {
            protobufSize,
            jsonSize,
            rawHex: Array.from(binary.slice(0, 50))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join(' '),
        },
    };
}
```

`meta.protobufSize`는 우리가 보낸 바이너리, `meta.jsonSize`는 같은
데이터를 JSON으로 보냈을 때의 크기 — 발표용 절감률 계산에 그대로 사용 가능.

### TS 5.7 타입 마찰

`body: binary` 한 줄에서 컴파일 에러. TS 5.7부터 `Uint8Array`가 generic
(`Uint8Array<ArrayBufferLike>`)으로 바뀌면서 DOM의 `BodyInit`과 좁은
의미에서 맞지 않게 됨. 런타임에선 정상이라 `as BodyInit` 캐스트로 우회.
대안으로 `new Blob([binary])` 도 가능하지만 굳이 한 단계 더 거칠 이유는 없다.

## 6. Step 3 — App.jsx 통합 + GET 엔드포인트 마이그레이션

원래는 POST 데모만 추가할 계획이었는데, 백엔드의 `/test/binary`
응답이 `UserList`에서 단일 `UserPayload`로 바뀐 걸 깜빡 — 기존 GET
데모가 이미 깨져있었다. 이 브랜치에서 같이 정리하기로 결정.

### 변경 사항 요약

1. **import 정리**
   - `decodeUserList` (기존 `user_proto_bundle.js`) 제거
   - `encodeUserPayload`, `decodeUserPayload` 추가
   - `useState`, `jinary` (코어 직접 사용) 추가

2. **GET 호출 마이그레이션**
   ```diff
   - useJinary(BACKEND_URL, decodeUserList)
   + useJinary(BACKEND_URL + '/test/binary', decodeUserPayload)
   ```

3. **렌더링 부분 — `data.users[*]` → 단일 객체**
   - `{data.users.length}명 기준` → `단일 객체 기준`
   - `data.users.slice(0,3).map(...)` → 단일 user 표시

4. **POST 데모 영역 신설** — 별도 카드 컴포넌트로 분리.
   ```js
   const binary = encodeUserPayload(payload);
   const result = await jinary.post(URL, binary);
   ```
   `보낸 객체`와 `백엔드가 돌려준 JSON`을 나란히 표시 → 무손실 round-trip을
   눈으로 확인할 수 있도록.

## 7. 디버깅 일지

도중에 막혔던 지점들. 각각 짧게.

### 406 Not Acceptable

GET 버튼 누르자마자 406. 코어 `get()`의 `Accept` 헤더가 옛날
`application/x-protobuf`로 박혀있던 게 원인. 백엔드 새 엔드포인트는
`produces = "application/x-jinary"`라서 거절한 것. 헤더 한 줄 교체로 해결.

### .env 마이그레이션

기존 `VITE_BACKEND_URL`이 도메인 + path까지 다 박혀있었음
(`https://jinary.duckdns.org/test/binary`). 백엔드 도메인 비용이
나가서 로컬로 회귀하면서 URL 구조도 origin만 남기고 코드 쪽에서
path를 붙이도록 정리:

```diff
- VITE_BACKEND_URL=https://jinary.duckdns.org/test/binary
+ VITE_BACKEND_URL=http://localhost:8080
```

부수 효과로 GET 버튼이 잠깐 404 → useJinary 호출에 path 붙여서 해결.
`.env` 변경은 dev 서버 재시작 필요한 점에서 한 번 헷갈렸음.

### 트래킹된 `.DS_Store` 충돌

`git pull` 시 로컬 `.DS_Store`가 수정되어 있어서 충돌. 트래킹된 채로
유지되고 있는 게 근본 원인. `git checkout -- .DS_Store`로 우선 통과.
백엔드 폴더 쪽 `.DS_Store`까지 같이 정리하려면 백엔드 형이랑 합의 필요.

## 8. 결과

- ✅ 양방향 바이너리 통신 동작 (GET/POST 모두 정상)
- ✅ 백엔드 `@Jinary` 자동 디코딩 검증 — 보낸 객체와 받은 JSON 일치
- ✅ 업로드 방향 사이즈 비교까지 데모에 포함
- ✅ 프론트 인코더 흐름 확보 — 다음 작업(자동 스키마 협상)의 기반

## 9. 남은 것 / 다음 브랜치 후보

- 인코더가 아직 손으로 .proto를 들고 있다 → **자동 스키마 협상** (M06)
- `useJinary` 훅이 GET만 지원 → **POST용 mutation 훅** 신설
- 코어/훅을 별도 패키지로 분리해서 npm 배포 준비 (M08)

발표 자료(중간 발표 v15장 deck)에서는 Roadmap 슬라이드의 M05~M08이
이번 브랜치 이후 작업과 대응. 다음 마일스톤 정의 시 본 로그 참고.
