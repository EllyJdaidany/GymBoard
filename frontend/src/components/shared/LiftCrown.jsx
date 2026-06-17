const CROWN_SRC = '/crown.png'

export const CROWN_OVERLAY_CLASS =
  'pointer-events-none absolute top-0 left-1/2 -translate-x-1/2'

export const CROWN_VALUE_SLOT_CLASS =
  'relative flex w-full items-end justify-center pt-[31.25px]'

export const GRID_CROWN_SLOT_CLASS = 'inline-block h-[31.25px] w-[31.25px] shrink-0'

export default function LiftCrown({ className = '' }) {
  return (
    <img
      src={CROWN_SRC}
      alt=""
      aria-hidden="true"
      className={['h-[31.25px] w-[31.25px] shrink-0 object-contain', className].filter(Boolean).join(' ')}
    />
  )
}
