import { useLayoutEffect, useState } from 'react'

export const TV_DESIGN_WIDTH = 1920
export const TV_DESIGN_HEIGHT = 1080

export function useTvViewportScale() {
  const [layout, setLayout] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })

  useLayoutEffect(() => {
    const updateLayout = () => {
      const scale = Math.min(
        window.innerWidth / TV_DESIGN_WIDTH,
        window.innerHeight / TV_DESIGN_HEIGHT,
      )
      const offsetX = (window.innerWidth - TV_DESIGN_WIDTH * scale) / 2
      const offsetY = (window.innerHeight - TV_DESIGN_HEIGHT * scale) / 2

      setLayout({ scale, offsetX, offsetY })
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  return {
    ...layout,
    width: TV_DESIGN_WIDTH,
    height: TV_DESIGN_HEIGHT,
  }
}
