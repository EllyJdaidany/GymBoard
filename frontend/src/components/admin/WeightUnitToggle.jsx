export default function WeightUnitToggle({ unit, onChange, disabled = false }) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1"
      role="group"
      aria-label="Weight unit"
    >
      {['kg', 'lbs'].map((option) => {
        const isActive = unit === option
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={[
              'rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
              isActive
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200',
              disabled ? 'opacity-60' : '',
            ].join(' ')}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
