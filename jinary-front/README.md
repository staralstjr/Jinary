# [03.16]

🔍 명령어 해부하기

```
npx pbjs -t static-module -w commonjs -o src/proto/user_proto_bundle.js src/proto/user.proto
```

### npx pbjs (명령어 실행):

Node.js에게 protobufjs 패키지 안에 있는 pbjs라는 번역기(변환 도구)를 실행시키는 명령어

### -t static-module (Target, 변환 타겟):

가볍고 빠른 정적 자바스크립트 모듈(Static Module) 형태로 번역

.proto 파일을 실행 중에 무겁게 해석하지 않고, 미리 자바스크립트 코드로 다 만들어서 속도를 극대화하는 옵션

### -w commonjs (Wrapper, 모듈 포장 방식):

변환된 코드를 CommonJS 방식으로 만듦 (참고로 Vite 환경에서는 이 부분을 -w es6로 바꿔주면 최신 import/export 문법으로 만들어짐)

### -o src/proto/user_proto_bundle.js (Output, 결과물 위치):

변환이 다 끝나면, 결과물을 이 경로에 새로운 js 파일로 저장.

### src/proto/user.proto (Input, 원본 파일 위치):

백엔드에서 변환 할 파일을 가리킴

--> package.json에 단축키 생성했습니다.

```
npm run proto:gen
```
