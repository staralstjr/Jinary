# Jinary Backend

Jinary는 스프링부트 개발자가 평소처럼 DTO를 사용하면서도, 실제 HTTP 바디는 Protobuf 바이너리로 주고받을 수 있게 만드는 실험용 라이브러리입니다.

이 저장소는 지금 다음 구조로 나뉘어 있습니다.

- [jinary-core](/Users/ralph/BackEnd/Jinary/Jinary-Backend/jinary-core)
- [jinary-spring-boot-starter](/Users/ralph/BackEnd/Jinary/Jinary-Backend/jinary-spring-boot-starter)
- [demo](/Users/ralph/BackEnd/Jinary/Jinary-Backend/demo)

## 핵심 아이디어

- 개발자는 `.proto` 파일을 직접 작성하지 않습니다.
- 컨트롤러에서는 JSON DTO를 다루듯 `UserPayload` 같은 자바 객체를 그대로 사용합니다.
- `jinary-core`가 DTO 구조를 보고 내부적으로 Protobuf 스키마를 만들고 바이너리로 직렬화합니다.
- `jinary-spring-boot-starter`가 스프링 MVC에 컨버터를 자동 등록합니다.
- 클라이언트는 `application/x-jinary` 또는 `application/x-protobuf` 형태의 바이너리를 주고받을 수 있습니다.

예제 DTO는 [UserPayload.java](/Users/ralph/BackEnd/Jinary/Jinary-Backend/demo/src/main/java/jinary/jinarybackend/dto/UserPayload.java:1) 입니다.

```java
public record UserPayload(
        Integer id,
        String name,
        String email
) {
}
```

## Demo 엔드포인트

예제 컨트롤러는 [TestController.java](/Users/ralph/BackEnd/Jinary/Jinary-Backend/demo/src/main/java/jinary/jinarybackend/controller/TestController.java:1)에 있습니다.

### 1. JSON 객체를 그대로 반환

엔드포인트:

```http
GET /test/json
Accept: application/json
```

의미:

- 스프링이 일반적인 JSON 직렬화를 수행합니다.
- Jinary를 쓰지 않은 기본 비교용 API입니다.

기대 응답:

```json
{
  "id": 202417051,
  "name": "Sanghwa",
  "email": "test@skhu.ac.kr"
}
```

### 2. 같은 DTO를 바이너리로 반환

엔드포인트:

```http
GET /test/binary
Accept: application/x-jinary
```

컨트롤러 메소드:

```java
@Jinary
@GetMapping(value = "/test/binary", produces = JinaryMediaTypes.APPLICATION_JINARY)
public UserPayload getBinaryData() {
    return new UserPayload(202417051, "Sanghwa", "test@skhu.ac.kr");
}
```

의미:

- 코드에서는 `UserPayload`를 반환하지만 실제 응답은 Protobuf 기반 바이너리입니다.
- JSON API와 같은 데이터를 다른 포맷으로 내려주는 비교용 API입니다.

### 3. 바이너리 요청을 DTO로 자동 역직렬화 후 JSON으로 응답

엔드포인트:

```http
POST /test/json-from-binary
Content-Type: application/x-jinary
Accept: application/json
```

컨트롤러 메소드:

```java
@Jinary
@PostMapping(
        value = "/test/json-from-binary",
        consumes = JinaryMediaTypes.APPLICATION_JINARY,
        produces = MediaType.APPLICATION_JSON_VALUE
)
public UserPayload jsonFromBinary(@RequestBody UserPayload request) {
    return request;
}
```

의미:

- 클라이언트는 `UserPayload`에 해당하는 Protobuf 바이너리를 보냅니다.
- 컨트롤러는 `@RequestBody UserPayload request`로 바로 받습니다.
- 즉, 개발자는 바이너리 파싱 코드를 직접 작성하지 않아도 됩니다.
- 반환은 `UserPayload`이므로 최종 응답은 JSON으로 나갑니다.

이 메소드는 "바이너리 입력 + DTO 처리 + JSON 출력" 흐름을 보여줍니다.

### 4. 바이너리 raw bytes를 직접 받아 JSON 문자열로 변환

엔드포인트:

```http
POST /test/json-from-raw-binary
Content-Type: application/x-jinary
Accept: application/json
```

컨트롤러 메소드:

```java
@PostMapping(
        value = "/test/json-from-raw-binary",
        consumes = JinaryMediaTypes.APPLICATION_JINARY,
        produces = MediaType.APPLICATION_JSON_VALUE
)
public ResponseEntity<byte[]> jsonFromRawBinary(@RequestBody byte[] payload) {
    return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .body(jinaryCodec.toJson(payload, UserPayload.class).getBytes(StandardCharsets.UTF_8));
}
```

의미:

- 컨트롤러가 바이너리 `byte[]` 자체를 직접 받습니다.
- `jinaryCodec.toJson(payload, UserPayload.class)`를 사용해 해당 바이너리를 JSON으로 변환합니다.
- 결과적으로 "바이너리 데이터를 받아서 자동으로 JSON으로 직렬화해주는 메소드" 예제입니다.

이 방식은 다음 상황에 유용합니다.

- DTO 자동 바인딩 대신 raw payload를 직접 받고 싶은 경우
- 디버깅용 변환 API가 필요한 경우
- 게이트웨이/프록시처럼 바이너리를 받아 JSON으로 바꿔 전달해야 하는 경우

## 테스트 코드

4개 메서드를 검증하는 통합 테스트는 [JinaryHttpMessageConverterTest.java](/Users/ralph/BackEnd/Jinary/Jinary-Backend/demo/src/test/java/jinary/jinarybackend/JinaryHttpMessageConverterTest.java:1)에 있습니다.

테스트는 Spring Boot를 랜덤 포트로 띄운 뒤, JDK `HttpClient`로 실제 HTTP 요청을 보내는 방식입니다. 즉, 단순 메서드 호출 테스트가 아니라 컨트롤러, 메시지 컨버터, 직렬화 흐름까지 함께 검증합니다.

각 테스트가 검증하는 내용은 다음과 같습니다.

- `returnsJsonPayloadFromDto()`
  `GET /test/json` 호출 후 JSON 응답 본문과 `Content-Type`이 올바른지 확인합니다.
- `returnsBinaryPayloadFromDto()`
  `GET /test/binary` 호출 후 `application/x-jinary` 응답을 받고, 다시 `JinaryCodec`으로 decode 해서 원래 DTO와 같은지 확인합니다.
- `convertsBinaryRequestBodyBackToJsonDto()`
  테스트 코드에서 `UserPayload`를 바이너리로 encode 한 뒤 `POST /test/json-from-binary`로 보내고, 응답 JSON이 입력 데이터와 같은지 확인합니다.
- `convertsRawBinaryRequestBodyToJsonString()`
  테스트 코드에서 만든 바이너리를 `POST /test/json-from-raw-binary`로 보내고, raw bytes가 JSON 문자열로 변환되어 내려오는지 확인합니다.

## 테스트 실행 방법

전체 테스트 실행:

```bash
./gradlew test
```

`demo` 모듈 테스트만 실행:

```bash
./gradlew :demo:test
```

Jinary 컨트롤러 테스트만 실행:

```bash
./gradlew :demo:test --tests jinary.jinarybackend.JinaryHttpMessageConverterTest
```

개별 메서드별 테스트 실행:

```bash
./gradlew :demo:test --tests jinary.jinarybackend.JinaryHttpMessageConverterTest.returnsJsonPayloadFromDto
./gradlew :demo:test --tests jinary.jinarybackend.JinaryHttpMessageConverterTest.returnsBinaryPayloadFromDto
./gradlew :demo:test --tests jinary.jinarybackend.JinaryHttpMessageConverterTest.convertsBinaryRequestBodyBackToJsonDto
./gradlew :demo:test --tests jinary.jinarybackend.JinaryHttpMessageConverterTest.convertsRawBinaryRequestBodyToJsonString
```

성공 기준:

- 모든 테스트가 `BUILD SUCCESSFUL`로 끝나야 합니다.
- `returnsJsonPayloadFromDto()`는 JSON 경로가 정상 동작함을 의미합니다.
- `returnsBinaryPayloadFromDto()`는 DTO -> 바이너리 직렬화가 정상임을 의미합니다.
- `convertsBinaryRequestBodyBackToJsonDto()`는 바이너리 -> DTO 자동 역직렬화가 정상임을 의미합니다.
- `convertsRawBinaryRequestBodyToJsonString()`는 raw bytes -> JSON 변환 경로가 정상임을 의미합니다.

## 수동 확인 방법

애플리케이션 실행:

```bash
./gradlew :demo:bootRun
```

JSON 응답 수동 확인:

```bash
curl -i http://localhost:8080/test/json
```

바이너리 응답 수동 확인:

```bash
curl -i -H "Accept: application/x-jinary" http://localhost:8080/test/binary --output response.bin
```

`/test/json-from-binary`와 `/test/json-from-raw-binary`는 요청 바디가 Jinary 바이너리여야 하므로, 수동 확인보다는 현재 테스트 코드처럼 `JinaryCodec`으로 바이너리를 생성해서 보내는 방식이 가장 정확합니다.

## 모듈 역할

- `jinary-core`
  `@Jinary`, 스키마 생성, 바이너리 인코딩/디코딩 같은 순수 로직을 담당합니다.
- `jinary-spring-boot-starter`
  스프링 부트 자동 설정과 `HttpMessageConverter` 등록을 담당합니다.
- `demo`
  실제 사용 예제와 테스트를 담고 있는 샘플 애플리케이션입니다.

## 로컬 배포와 사용

두 라이브러리 모듈은 `maven-publish`가 설정돼 있어서 로컬 Maven 저장소로 배포할 수 있습니다.

```bash
./gradlew publishToMavenLocal
```

배포되면 다른 프로젝트에서 아래처럼 사용할 수 있습니다.

```gradle
repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    implementation "jinary:jinary-spring-boot-starter:0.0.1-SNAPSHOT"
}
```

starter가 `jinary-core`를 transitively 포함하므로, 소비자는 보통 starter만 추가하면 됩니다.

컨트롤러에서는 그대로 `@Jinary`를 import해서 사용할 수 있습니다.

```java
import jinary.jinarybackend.jinary.Jinary;
```
