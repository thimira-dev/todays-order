import { IsoCroissant } from './icons'

const STEAM_WISPS = [
  { left: '32%', delay: '0s' },
  { left: '50%', delay: '0.4s' },
  { left: '66%', delay: '0.8s' },
]

export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in-up flex min-h-[60vh] flex-col items-center justify-center gap-7"
    >
      <div className="relative flex flex-col items-center">
        {/* steam wisps */}
        <div className="absolute -top-4 flex w-full justify-center" aria-hidden="true">
          {STEAM_WISPS.map((wisp) => (
            <span
              key={wisp.left}
              className="animate-steam absolute h-3 w-1 rounded-full bg-gray-300"
              style={{ left: wisp.left, animationDelay: wisp.delay }}
            />
          ))}
        </div>
        <IsoCroissant className="animate-float h-16 w-16 drop-shadow-md" />
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-base font-semibold text-gray-900">Today&apos;s Order</p>
        <p className="text-sm text-gray-500">{message}</p>
        <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-dot-bounce h-1.5 w-1.5 rounded-full bg-amber-500"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
