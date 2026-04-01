# Production Deployment

이 구성은 `Spring Boot app -> Nginx -> HTTPS` 형태로 배포할 때 쓰는 기준입니다.

## 변경 기록

### 2026-03-25

- 배포용 기본 골격을 추가했다.
- `Dockerfile`을 넣어서 로컬 또는 CI에서 `jar`를 쉽게 만들 수 있게 했다.
- Nginx reverse proxy 설정 예시를 추가했다.
- systemd 서비스 파일 예시를 추가해서 서버에서 앱을 자동 재시작할 수 있게 했다.
- Spring Boot가 프록시 뒤에서 동작할 때 필요한 forwarded header 설정을 넣었다.
- CORS 설정에 `OPTIONS`와 전체 헤더를 허용해 프론트 프리플라이트 요청이 막히지 않도록 보강했다.
- 팀 공유용으로 도메인 + HTTPS + 프론트 테스트 흐름을 한 번에 볼 수 있게 정리했다.

### 이후 기록용

- 날짜를 적고, 그날 바꾼 파일과 목적을 한 줄씩 남겨두면 된다.
- 예: `2026-03-26 - Nginx 도메인 실제 값 반영, Certbot 인증서 발급 완료`
- 예: `2026-03-27 - 프론트에서 protobuf 파싱 코드 추가`

## 바뀌는 부분

배포 전에는 아래 두 곳만 실제 값으로 바꾸면 됩니다.

- `deploy/nginx/jinary-backend.conf`
- `deploy/systemd/jinary-backend.service`의 `User`와 `WorkingDirectory`
