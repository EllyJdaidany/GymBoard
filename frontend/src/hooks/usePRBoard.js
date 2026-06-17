import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { normalizeMemberEntries } from '../utils/names'

export function usePRBoard(refreshInterval = 300000, { enabled = true } = {}) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchBoard = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getPRBoard()
      setMembers(normalizeMemberEntries(data))
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }

    fetchBoard()

    const intervalId = setInterval(fetchBoard, refreshInterval)
    return () => clearInterval(intervalId)
  }, [fetchBoard, refreshInterval, enabled])

  return { members, loading, error, lastUpdated }
}
