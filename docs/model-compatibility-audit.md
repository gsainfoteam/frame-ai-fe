# OpenRouter 영상 입력 호환성 점검

확인일: 2026-11-10. HeyGen의 고정 오디오를 무음으로 보내던 문제를 계기로, 다른 모델의 입력 오류 가능성을 점검했습니다.

## 범위와 확인 방법

- 인증이 필요 없는 [`GET /api/v1/videos/models`](https://openrouter.ai/api/v1/videos/models) 33개 항목을 조회했습니다. 길이·해상도가 있는 29개가 현재 Frame의 선택 대상입니다.
- 편집·업스케일·아바타용 4개(`black-forest-labs/flux-video-edit`, `black-forest-labs/flux-video-upscale`, `runway/aleph-2`, `heygen/avatar-iv`)는 기존 필터로 제외됩니다.
- 29개 모델의 기본 요청 구성, 개별 옵션 검사, 오디오·시드 지원 여부와 전송 필드를 자동 테스트했습니다. 목록의 필요한 필드만 `tests/fixtures/openrouter-video-models-2026-11-10.json`에 보관했습니다. 테스트는 네트워크를 사용하지 않습니다.
- 조합 조건은 아래 공급사 공식 문서와 대조했습니다. **유료 생성 요청은 보내지 않았으며, 모든 옵션 조합의 실제 성공을 보장하는 검증은 아닙니다.**

## 발견한 검증 누락과 반영 내용

기존 검사는 길이·해상도 각각의 목록 포함 여부와 공통 참조 상한(30/10/10)을 확인했습니다. 목록에 없는 조합 조건은 별도 검사가 필요합니다.

| 대상 | 기존에 통과하던 입력 | 반영한 검사 | 근거 |
| --- | --- | --- | --- |
| Hailuo 2.3 | 1080p + 10초 | 1080p는 6초. 현재 목록의 유일한 해상도가 1080p이므로 해상도 생략 시에도 적용 | [MiniMax I2V](https://platform.minimax.io/docs/api-reference/video-generation-i2v), [T2V](https://platform.minimax.io/docs/api-reference/video-generation-t2v) |
| Seedance 2.0 / Fast / Mini | 이미지 10개 이상, 영상·오디오 4개 이상, 오디오만 참조 | 이미지 9개·영상 3개·오디오 3개 상한, 오디오에 일반 이미지 또는 영상 필요 | [Seedance 2.0 series](https://docs.byteplus.com/en/docs/ModelArk/seedance-2-0) |
| Veo 3.1 | 일반 참조 이미지 4개, 일반 참조 + 4/6초 | 일반 이미지 최대 3개, 일반 참조 시 8초 | [Google 참조 입력](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-references) |
| Veo 3.1 Fast | 일반 참조 이미지 4개 | 일반 이미지 최대 3개. 표준 모델의 8초 조건은 근거 없이 Fast에 확대하지 않음 | [Google 참조 입력](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-references) |
| Veo 3.1 Lite / Seedance 1.5 Pro | 일반 참조 이미지 | 첫·끝 프레임 역할로 입력하도록 안내·검사 | [Veo 지원 범위](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate), [Seedance API](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api?redirect=1) |

정확한 모델 ID에만 적용합니다. Seedance 2.5의 30/10/10 상한·오디오 단독 참조는 유지하며, 아직 확인하지 않은 미래 버전에 제한을 자동 상속하지 않습니다. 기본 길이는 생략하고 공급사의 기본값을 사용합니다. 저장한 설정·생성 기록을 다시 사용할 때도 공통 `validatePayload`를 거쳐 검사합니다.

화면에는 짧은 안내와 가이드 링크를 표시하고, Hailuo 1080p와 Veo 3.1 일반 참조에서 사용할 수 없는 길이 칩을 비활성화합니다. 기존 저장값을 임의로 변경하지 않으므로 잘못된 값이 남아 있으면 생성 전 오류 안내에 따라 수정해야 합니다.

Veo 3.1 일반 참조에서 길이를 기본으로 두면 예상 비용도 필수 길이인 8초를 적용합니다. 기존의 목록 최솟값(4초)으로 계산해 비용을 낮게 표시하던 문제를 수정했습니다.

## 전체 목록의 공통 요청 검사

| 공급사 | 선택 대상 수 | 확인 범위 |
| --- | ---: | --- |
| Alibaba | 6 | Wan 2.6/2.7/3.0/3.0 Prime, HappyHorse 1.0/1.1의 목록 필드와 기본 요청 |
| Google | 5 | Gemini Omni 1.1/1.2 Flash의 기본 요청, Veo 3.1/ Fast/Lite의 기본 요청 및 위 참조 조건 |
| ByteDance | 5 | Seedance 1.5 Pro/2.0/2.0 Fast/2.0 Mini/2.5의 기본 요청 및 위 참조 조건 |
| xAI | 3 | Grok Imagine Video/1.5/1.5 Lite의 기본 요청, 오디오 설정 미지원 시 필드 생략 |
| MiniMax | 3 | Hailuo 2.3/3/3 Max의 기본 요청, 2.3의 길이·해상도 조합 |
| Kuaivgi | 3 | Kling v3.0 Pro/Std, Video O1의 목록 필드와 기본 요청 |
| HeyGen | 1 | Video 1의 오디오 항상 포함 회귀 검사 |
| Black Forest Labs | 1 | Flux 3 Video의 목록 필드와 기본 요청 |
| Runway | 1 | Gen-4.5의 목록 필드와 기본 요청 |
| TBC | 1 | Mischief 1의 목록 필드와 기본 요청 |

## 남은 불확실성

- **OpenRouter 경로와 공급사 직접 API의 차이:** 최신 모델의 설명에 영상·오디오 입력이 있어도 OpenRouter의 동일 필드로 전달된다는 보장은 없습니다. Frame의 기존 영상·오디오 참조 지원 범위를 임의로 확대하지 않았습니다. [OpenRouter 영상 생성 문서](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)를 기준으로 유지합니다.
- **파일 조건:** 원격 URL의 실제 MIME, 픽셀 크기, 영상·오디오 길이, URL 만료·인증 문제는 정적 요청 검사만으로 확정할 수 없습니다. 현재 공통 파일 경고도 모든 모델의 개별 조건을 포괄하지 않습니다. 여러 로컬 이미지의 base64 합산 본문 크기로 인한 413 가능성도 남습니다.
- **콘텐츠 심사·계정 권한:** 인물 정책, 지역·계정별 사용 가능 여부, 크레딧·키 한도 등은 별도입니다. 기존 인물 정책 안내와 서버 응답 진단을 사용합니다.
- **목록 갱신:** 공개 목록이 조합 조건 전체를 제공하지 않으므로, 새 모델이 추가되어도 기본 요청 테스트 통과만으로 모든 참조 방식·옵션 조합의 호환성을 단정하지 않습니다.

실제 오류가 추가로 보고되면 모델 ID, HTTP 상태, 공급사 오류 문구와 실패한 옵션 조합을 기록해 해당 모델의 회귀 테스트를 보강합니다. API 키·프롬프트·이미지 URL은 포함하지 않습니다.
