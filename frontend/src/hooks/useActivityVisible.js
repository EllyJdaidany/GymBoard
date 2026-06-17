import { useCallback, useEffect, useRef, useState } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel']

export function useActivityVisible({ enabled = true, idleMs = 3000 } = {}) {
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef(null)

  const registerActivity = useCallback(() => {
    if (!enabled) return

    setVisible(true)

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
    }

    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
    }, idleMs)
  }, [enabled, idleMs])

  useEffect(() => {
    if (!enabled) {
      setVisible(false)
      return undefined
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, registerActivity, { passive: true })
    }

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, registerActivity)
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [enabled, registerActivity])

  return { activityVisible: visible, registerActivity }
}
