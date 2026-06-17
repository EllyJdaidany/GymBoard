function BarbellIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="8.1" y="11.35" width="7.8" height="1.3" rx="0.15" />
      <rect x="8.1" y="10.75" width="0.55" height="2.5" />
      <rect x="15.35" y="10.75" width="0.55" height="2.5" />
      <rect x="6.15" y="9.65" width="1.35" height="4.7" />
      <rect x="4.55" y="10.45" width="1" height="3.1" />
      <rect x="3.25" y="11" width="0.75" height="2" />
      <rect x="2.35" y="11.35" width="0.55" height="1.3" />
      <rect x="16.5" y="9.65" width="1.35" height="4.7" />
      <rect x="18.45" y="10.45" width="1" height="3.1" />
      <rect x="20" y="11" width="0.75" height="2" />
      <rect x="21.1" y="11.35" width="0.55" height="1.3" />
    </svg>
  )
}

const BADGE_SIZES = {
  md: 'h-6 w-6',
  table: 'h-8 w-8',
  lg: 'h-10 w-10',
}

export const GRID_BADGE_SLOT_CLASS = `inline-block shrink-0 ${BADGE_SIZES.table}`

export default function VerificationBadge({ meetVerified, size = 'md' }) {
  const iconClass = BADGE_SIZES[size] ?? BADGE_SIZES.md

  if (meetVerified) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center" title="Meet verified">
        <img
          src="/meet-verified-badge.png"
          alt=""
          aria-hidden="true"
          className={`${iconClass} object-contain`}
        />
      </span>
    )
  }

  return (
    <span className="inline-flex shrink-0 items-center justify-center" title="Gym PR">
      <BarbellIcon className={`${iconClass} text-orange-500`} />
    </span>
  )
}
