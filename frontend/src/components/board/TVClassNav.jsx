import { useActivityVisible } from '../../hooks/useActivityVisible'

function ChevronIcon({ direction }) {
  const path =
    direction === 'left'
      ? 'M15 6l-6 6 6 6'
      : 'M9 6l6 6-6 6'

  return (
    <svg
      aria-hidden="true"
      className="h-10 w-10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  )
}

const NAV_BUTTON_CLASS = [
  'flex h-20 w-20 items-center justify-center rounded-full',
  'border border-catalyst-text/15 bg-catalyst-surface/70 text-catalyst-accent backdrop-blur-sm',
  'transition-[opacity,colors] duration-300',
  'hover:border-catalyst-accent/40 hover:bg-catalyst-surface hover:text-catalyst-text',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-catalyst-accent',
  'disabled:pointer-events-none disabled:opacity-30',
].join(' ')

const NAV_VISIBILITY_CLASS = {
  shown: 'pointer-events-auto opacity-100',
  hidden: 'pointer-events-none opacity-0',
}

export default function TVClassNav({ visible, disabled, onPrevious, onNext, idleHideMs = 3000 }) {
  const { activityVisible, registerActivity } = useActivityVisible({
    enabled: visible,
    idleMs: idleHideMs,
  })

  if (!visible) return null

  const visibilityClass = activityVisible ? NAV_VISIBILITY_CLASS.shown : NAV_VISIBILITY_CLASS.hidden

  return (
    <>
      <button
        type="button"
        aria-label="Previous weight class"
        className={`absolute left-6 top-1/2 z-30 -translate-y-1/2 ${NAV_BUTTON_CLASS} ${visibilityClass}`}
        disabled={disabled}
        onClick={onPrevious}
        onFocus={registerActivity}
        onMouseEnter={registerActivity}
      >
        <ChevronIcon direction="left" />
      </button>

      <button
        type="button"
        aria-label="Next weight class"
        className={`absolute right-6 top-1/2 z-30 -translate-y-1/2 ${NAV_BUTTON_CLASS} ${visibilityClass}`}
        disabled={disabled}
        onClick={onNext}
        onFocus={registerActivity}
        onMouseEnter={registerActivity}
      >
        <ChevronIcon direction="right" />
      </button>
    </>
  )
}
