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

## 1) 빌드

```bash
./gradlew clean bootJar
```

빌드 결과물은 `build/libs/Jinary-Backend-0.0.1-SNAPSHOT.jar` 형태로 생성됩니다.

## 2) 서버에 배포

권장 배치 예시는 아래와 같습니다.

- 애플리케이션: `/opt/jinary/backend/app.jar`
- Nginx 설정: `/etc/nginx/sites-available/jinary-backend.conf`
- SSL 인증서: `/etc/letsencrypt/live/api.example.com/`

예시:

```bash
sudo mkdir -p /opt/jinary/backend
sudo cp build/libs/Jinary-Backend-0.0.1-SNAPSHOT.jar /opt/jinary/backend/app.jar
```

## 3) systemd로 앱 실행

`deploy/systemd/jinary-backend.service`를 `/etc/systemd/system/jinary-backend.service`로 복사한 뒤:

```bash
sudo systemctl daemon-reload
sudo systemctl enable jinary-backend
sudo systemctl start jinary-backend
sudo systemctl status jinary-backend
```

## 4) Nginx reverse proxy

`deploy/nginx/jinary-backend.conf`의 `server_name api.example.com`을 실제 도메인으로 바꾸고,
`/etc/nginx/sites-available/`에 넣은 다음 활성화합니다.

```bash
sudo ln -s /etc/nginx/sites-available/jinary-backend.conf /etc/nginx/sites-enabled/jinary-backend.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 5) HTTPS 발급

Let's Encrypt + Certbot을 사용합니다.

```bash
sudo certbot --nginx -d api.example.com
```

발급이 끝나면 Nginx가 80에서 443으로 리다이렉트하고, 443에서 백엔드로 프록시합니다.

## 6) 프론트 테스트 시 주의점

- 엔드포인트는 `https://api.example.com/test/binary` 입니다.
- 응답 타입은 `application/x-protobuf` 입니다.
- 프론트에서는 `fetch(...).arrayBuffer()` 또는 axios의 `responseType: 'arraybuffer'`를 써야 합니다.

## 7) 바뀌는 부분

배포 전에는 아래 두 곳만 실제 값으로 바꾸면 됩니다.

- `deploy/nginx/jinary-backend.conf`
- `deploy/systemd/jinary-backend.service`의 `User`와 `WorkingDirectory`
