import { cn } from '@/shared/lib/cn'

/**
 * 팀 마스코트가 필름 조각 뒤에서 빼꼼 내다보는 브랜드 마크.
 * 마스코트 외곽선은 팀 로고 원본에서 추출한 좌표이며, 32x32 좌표계를 씁니다.
 * public/favicon.svg가 같은 도형을 쓰므로 모양을 바꿀 때 둘을 함께 맞춰주세요.
 */
const HEAD =
  'M2.55 16.83C2.71 15.82 2.95 14.81 3.23 13.83C3.51 12.85 3.84 11.87 4.23 10.92C4.62 9.97 5.07 9.03 5.58 8.14C6.09 7.25 6.72 6.43 7.31 5.59C7.9 4.75 8.42 3.69 9.12 3.1C9.82 2.51 10.63 2.07 11.52 2.07C12.4 2.07 13.44 2.93 14.43 3.11C15.42 3.29 16.49 3.31 17.49 3.14C18.49 2.98 19.52 2.14 20.41 2.12C21.3 2.1 22.13 2.46 22.83 3.03C23.53 3.6 24.05 4.69 24.64 5.53C25.23 6.37 25.86 7.18 26.38 8.07C26.89 8.96 27.34 9.9 27.73 10.85C28.13 11.8 28.46 12.79 28.75 13.77C29.04 14.75 29.29 15.76 29.45 16.76C29.61 17.77 29.72 18.78 29.73 19.8C29.74 20.82 29.7 21.87 29.5 22.87C29.3 23.87 29.07 24.93 28.56 25.79C28.05 26.64 27.27 27.42 26.45 28C25.63 28.58 24.62 28.96 23.65 29.28C22.68 29.6 21.66 29.76 20.65 29.91C19.64 30.06 18.61 30.14 17.58 30.19C16.55 30.24 15.51 30.24 14.48 30.19C13.46 30.14 12.44 30.06 11.43 29.91C10.42 29.76 9.39 29.62 8.42 29.31C7.45 29 6.43 28.63 5.61 28.06C4.79 27.48 4 26.71 3.48 25.86C2.96 25.01 2.72 23.95 2.52 22.95C2.32 21.95 2.29 20.9 2.3 19.88C2.3 18.86 2.39 17.84 2.55 16.83Z'

export function LogoMark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      className={cn('shrink-0 text-accent', className)}
    >
      {/* 머리: 필름 조각에 가려지도록 아래쪽 절반을 먼저 그립니다. */}
      <g transform="translate(4.48 4.91) scale(.72)">
        <path d={HEAD} fill="#fff" stroke="currentColor" strokeWidth="3.9" strokeLinejoin="round" />
        <circle cx="10.61" cy="11.96" r="1.8" fill="currentColor" />
        <circle cx="20.98" cy="11.96" r="1.8" fill="currentColor" />
        <path
          d="M13.5 14.6c1.2 0 2-.7 2.3-3.1.3 2.4 1.1 3.1 2.3 3.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {/* 필름 조각: 좌우 퍼포레이션과 재생 버튼 */}
      <rect x="2.4" y="18.4" width="27.2" height="10.2" rx="2.8" fill="currentColor" />
      <g fill="#fff">
        <rect x="4" y="19.9" width="2.4" height="2.1" rx=".6" />
        <rect x="4" y="25" width="2.4" height="2.1" rx=".6" />
        <rect x="25.6" y="19.9" width="2.4" height="2.1" rx=".6" />
        <rect x="25.6" y="25" width="2.4" height="2.1" rx=".6" />
        <path d="M13.9 20.7 19 23.5l-5.1 2.8z" />
      </g>
    </svg>
  )
}

/** 마크 + 워드마크. 헤더와 같은 브랜드 자리에서 씁니다. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[17px] font-semibold tracking-[-0.02em]">frame</span>
        <span className="mt-0.5 text-2xs font-medium text-muted">영상 스튜디오</span>
      </span>
    </span>
  )
}
