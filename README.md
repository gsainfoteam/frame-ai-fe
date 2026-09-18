# Frame — 렛서 영상 스튜디오

Letsur Seedance 2.5로 영상을 만드는 로컬 작업 공간입니다. API 키는 브라우저 메모리에만 두고, 프로젝트·생성 기록은 이 브라우저에 저장합니다.

## 실행

```bash
bun install
bun run dev
```

브라우저에서 Vite 개발 서버를 엽니다. Letsur API는 개발 서버가 `/api`로 중계하므로 별도의 Python 프록시는 필요 없습니다.

```bash
bun run build
bun run preview
```

정적 호스팅만 하면 CORS로 API 호출이 막힐 수 있습니다. 그때는 자체 백엔드를 붙이면 됩니다.

## 사용 순서

1. 상단에서 렛서 API 키를 입력합니다. 키는 저장되지 않으며 새로고침하면 지워집니다.
2. 장면 설명과 길이, 해상도, 화면 비율을 설정합니다.
3. 필요하면 참조 이미지·영상·오디오를 업로드합니다. 인물 참조는 관리형 업로드를 사용하세요.
4. **영상 생성**을 누르면 유료 요청이 한 번 전송됩니다. 실패해도 자동 재전송하지 않습니다.
5. 작업 ID로 상태를 조회합니다. 링크가 만료되면 **링크 발급 / 갱신**을 사용합니다.

## 데이터

- 프로젝트·기록: `localStorage` 키 `frame.projects.v2` (기존 스튜디오와 호환)
- 이미지 원본: IndexedDB `frame-images`
- 서명 URL과 API 키는 저장하지 않습니다.

## 공식 문서

- [영상 생성](https://docs.platform.letsur.ai/ai-gateway/api-reference/endpoints/video-generations)
- [작업 조회](https://docs.platform.letsur.ai/ai-gateway/api-reference/endpoints/jobs)
- [참조 업로드](https://docs.platform.letsur.ai/ai-gateway/api-reference/endpoints/references)
- [모델 입력 조건](https://docs.platform.letsur.ai/ai-gateway/model-guides/seedance)
