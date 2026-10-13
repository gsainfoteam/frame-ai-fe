# Frame — 렛서 영상 스튜디오

Letsur Seedance 2.5로 영상을 만드는 로컬 작업 공간입니다. API 키는 브라우저 메모리에만 두고, 프로젝트·생성 기록은 이 브라우저에 저장합니다.

## 실행

```bash
bun install
cp .env.example .env
bun run dev
```

브라우저에서 Vite 개발 서버를 엽니다. `VITE_LETSUR_API_BASE`가 `/api`이면 개발 서버가 `https://gw.letsur.ai/v1`로 중계합니다.

게이트웨이를 브라우저에서 직접 호출하려면 `.env`에서 값을 바꿉니다.

```
VITE_LETSUR_API_BASE=https://gw.letsur.ai/v1
```

```bash
bun run build
bun run preview
```

정적 호스팅만 하면 CORS로 API 호출이 막힐 수 있습니다. 그때는 자체 백엔드를 붙이면 됩니다. Cloudflare Pages에서는 빌드 환경 변수로 `VITE_LETSUR_API_BASE`를 넣습니다.

## 사용 순서

1. 상단에서 렛서 API 키를 입력합니다. 키는 저장되지 않으며 새로고침하면 지워집니다.
2. 장면 설명과 길이, 해상도, 화면 비율을 설정합니다.
3. 필요하면 참조 이미지·영상·오디오를 업로드합니다. 인물 참조는 관리형 업로드를 사용하세요.
4. 생성 방식을 고릅니다.
   - **바로 생성**: 지정한 해상도로 한 번 생성합니다.
   - **480p 시안 먼저**: 시안을 1~4개 만들어 **시안 비교** 탭에서 나란히 보고, 고른 시안만 **1080p로 확정**합니다. 시안과 확정은 각각 과금되며, 확정할 때는 프롬프트·길이·비율을 바꿀 수 없습니다. 영상 입력에는 쓸 수 없습니다.
5. 생성 버튼 아래의 예상 비용을 확인하고 요청합니다. 실패해도 자동 재전송하지 않습니다.
6. 상태는 10~30초 간격으로 자동 조회하고, 20분이 지나면 조회만 멈춥니다(생성 실패가 아님). 링크가 만료되면 **링크 갱신**을 사용합니다.
7. 오류가 나면 **문의용 정보 복사**로 작업 ID·요청 시각·모델·오류 코드·요청 본문(API 키 제외)을 렛서에 전달할 수 있습니다.

예상 비용은 가이드 단가표(2026-09-28 기준)로 계산한 참고값입니다. 실제 청구액은 완료된 작업의 사용량으로 표시합니다.

## 데이터

- 프로젝트·기록: `localStorage` 키 `frame.projects.v2` (기존 스튜디오와 호환)
- 이미지 원본: IndexedDB `frame-images`
- 서명 URL과 API 키는 저장하지 않습니다.

## 공식 문서

- [영상 생성](https://docs.platform.letsur.ai/ai-gateway/api-reference/endpoints/video-generations)
- [작업 조회](https://docs.platform.letsur.ai/ai-gateway/api-reference/endpoints/jobs)
- [참조 업로드](https://docs.platform.letsur.ai/ai-gateway/api-reference/endpoints/references)
- [모델 입력 조건](https://docs.platform.letsur.ai/ai-gateway/model-guides/seedance)
