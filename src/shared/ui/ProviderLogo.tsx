import { useState } from 'react'
import { modelParts, type ModelSpec } from '@/domain/models'
import { cn } from '@/shared/lib/cn'

// 모델 표시 이름은 바뀔 수 있으므로 OpenRouter 모델 ID의 공급사 부분을 우선합니다.
const logos: Record<string, string> = {
  bytedance: 'bytedance-color.svg',
  'bytedance-seed': 'bytedance-color.svg',
  google: 'google-color.svg',
  alibaba: 'alibaba-color.svg',
  qwen: 'alibaba-color.svg',
  kwaivgi: 'kling-color.svg',
  kling: 'kling-color.svg',
  minimax: 'minimax-color.svg',
  runway: 'runway.svg',
  openai: 'openai.svg',
  'x-ai': 'xai.svg',
  xai: 'xai.svg',
  spacexai: 'xai.svg',
  'black-forest-labs': 'bfl.svg',
  heygen: 'heygen.png',
}

/** 로고는 앱과 함께 제공하며, 새 공급사나 이미지 오류에는 이름 첫 글자를 표시합니다. */
export function ProviderLogo({ spec, className }: { spec: ModelSpec; className?: string }) {
  const { provider } = modelParts(spec)
  const providerId = spec.id.split('/')[0].toLowerCase()
  const file = logos[providerId] ?? logos[provider.toLowerCase()]
  const [failedFile, setFailedFile] = useState<string>()
  return (
    <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-sm font-semibold text-muted', className)}>
      {file && failedFile !== file ? (
        <img src={`/providers/${file}`} alt="" width={24} height={24} className="size-6 object-contain" onError={() => setFailedFile(file)} />
      ) : (
        <span>{(provider === '기타' ? providerId : provider).slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  )
}
