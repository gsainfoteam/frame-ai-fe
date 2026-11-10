# Frame — AI 영상 스튜디오

각 팀의 OpenRouter API 키로 영상을 만들고, 프로젝트별 장면·참조 이미지·생성 기록을 관리하는 브라우저 작업 공간입니다. 기본 연결 서비스는 **OpenRouter**이며, 기존 렛서 작업도 계속 사용할 수 있습니다.

- React + TypeScript + Vite, Tailwind CSS
- 브라우저에서 외부 영상 API를 직접 호출하며 자체 백엔드는 없습니다.
- API 키, 프로젝트, 작성 중인 장면과 생성 옵션은 같은 브라우저에서 자동 복원됩니다.
- 계정 간 동기화나 팀 공동 편집은 제공하지 않습니다.

## 사용 방법

앱의 **사용 가이드** 탭 또는 [사용 가이드 문서](docs/user-guide.md)를 확인하세요.

1. OpenRouter에서 크레딧을 준비하고 사용 한도를 지정한 API 키를 발급합니다.
2. 상단 **API 키 연결**에서 키를 입력합니다. 이 브라우저에 자동 저장됩니다.
3. 장면을 설명하고 영상 모델·길이·해상도·비율을 고릅니다.
4. 필요하면 참조 이미지를 선택하고 **브라우저에 보관**을 누릅니다.
5. 예상 비용을 확인한 뒤 **영상 생성**을 누릅니다.
6. 완료 후 결과를 재생하고 **파일 열기**에서 원본을 저장합니다.

새로고침해도 접수된 생성 요청을 다시 보내지 않습니다. 저장된 키가 있으면 대기·생성 중인 작업의 상태 조회를 재개합니다. 접수 응답을 받지 못한 요청은 OpenRouter Activity에서 먼저 확인하세요.

## 로컬 실행

```bash
bun install
bun run dev
```

OpenRouter는 환경 변수 없이 실행할 수 있습니다. 필요하면 `.env.example`을 `.env`로 복사해 API 주소를 변경하세요. API 키는 환경 변수가 아니라 앱에서 입력합니다. `VITE_*` 값은 브라우저 번들에 공개되므로 비밀 키를 넣지 마세요.

```bash
bun test
bun run lint
bun run build
bun run preview
```

`bun test`는 연결 정보의 복원·삭제, 프로젝트별 초안, 저장 장애, 백업의 키 제외를 검사합니다. 실제 영상 API를 호출하지 않습니다.

## 배포

`bun run build`로 생성한 `dist/`를 정적 호스팅에 배포합니다.

- 기본 OpenRouter 주소: `https://openrouter.ai/api/v1`
- 변경하려면 빌드 시 `VITE_OPENROUTER_API_BASE`를 설정합니다.
- `/help`, `/history` 등으로 직접 접속해도 `index.html`을 반환하는 SPA fallback이 필요합니다. Cloudflare Pages·Netlify용 `public/_redirects`가 포함되어 있습니다. 다른 호스팅은 동일한 rewrite를 설정하세요.
- 배포 주소의 HTTPS와 실제 브라우저에서 API 연결·이미지 입력·결과 재생을 확인하세요.
- 사이트 주소가 바뀌면 브라우저 저장소도 달라집니다. 이전 주소에서 기록과 이미지 원본을 각각 백업하고, 새 주소에서 복원한 뒤 API 키를 다시 입력하세요.

렛서는 개발 서버에서 기본 `/api` 프록시를 사용합니다. 정적 배포에서는 기본적으로 `https://gw.letsur.ai/v1`을 직접 호출하며, 필요 시 `VITE_LETSUR_API_BASE`를 지정합니다. Vite의 프록시와 마지막 프레임 다운로드 중계는 정적 호스팅에 배포되지 않습니다. 렛서 직접 호출이 CORS로 제한되거나 자동 프레임 다운로드가 실패하면 별도 중계 또는 UI의 파일 선택 방식을 사용해야 합니다.

## 저장하는 데이터

| 데이터 | 저장 위치 | 백업 |
| --- | --- | --- |
| 연결 서비스·서비스별 API 키 | localStorage `frame.connection.v1` | 제외 |
| 프로젝트·공통 설정·생성 기록 | localStorage `frame.projects.v2` | 생성 기록 → 전체 프로젝트 백업 |
| 프로젝트별 작성 중인 장면·생성 옵션·현재 작업 ID | localStorage `frame.draft.v1:<projectId>` | 미포함; 필요하면 설정 JSON 저장 |
| 보관 완료한 이미지 원본 | IndexedDB `frame-images` | 이미지 보관함 → 이미지 원본 백업 |
| 결과 재생 URL·전송 중 상태 | 페이지 메모리 | 제외 |
| 생성 영상 원본 | 외부 서비스의 보관기간 내 제공 | 직접 다운로드 |

기존 `frame.projects.v2`, `frame.history.v1`, `frame.gateway` 데이터를 읽습니다. 기존 연결 서비스 선택은 유지하고, 처음 방문한 브라우저만 OpenRouter를 기본으로 사용합니다.

API 키는 사용자의 요청에 따라 **암호화되지 않은 브라우저 저장소**에 저장합니다. 같은 브라우저 프로필에 접근하는 사람이나 페이지에서 실행되는 스크립트가 읽을 수 있습니다. 공용 기기에서는 **API 연결 → 저장된 키 지우기**를 사용하세요. 키는 프로젝트 백업과 문의용 정보에 넣지 않습니다. 생성 입력과 참조 자료는 선택한 외부 서비스로 전송됩니다.

브라우저 저장 권한·용량 문제는 화면 상단에 표시합니다. 비공개 창 종료, 사이트 데이터 삭제 또는 브라우저 정리에 따른 삭제를 방지할 수는 없으므로 필요한 기록과 원본은 백업하세요.

## 코드 구조

- `src/features`: 생성·기록·보관함·사용 가이드 화면
- `src/api`: OpenRouter·렛서 API 어댑터
- `src/domain`: 입력 검증, 모델 지원 범위, 비용과 백업 처리
- `src/stores`: 세션·프로젝트·작성 중인 작업 상태
- `src/storage`: 브라우저 저장과 복원
- `vite/letsur-plugin.ts`: 로컬 렛서 프레임 다운로드 중계

## 외부 문서

- [OpenRouter API 키](https://openrouter.ai/settings/keys)
- [OpenRouter 영상 생성](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [OpenRouter Activity](https://openrouter.ai/activity)
- [렛서 영상 생성](https://docs.platform.letsur.ai/ai-gateway/api-reference/endpoints/video-generations)

모델 지원 범위와 단가는 외부 서비스에 따라 달라질 수 있습니다. 예상 비용은 참고값이며 실제 사용량은 완료한 작업에서 확인합니다.
