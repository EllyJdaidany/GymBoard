import { useTvViewportScale } from '../../hooks/useTvViewportScale'

export default function TVBoardCanvas({ children, className = '' }) {
  const { scale, offsetX, offsetY, width, height } = useTvViewportScale()

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-catalyst-base">
      <div
        className={['relative overflow-visible text-catalyst-text', className].join(' ')}
        style={{
          width,
          height,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  )
}
