import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { normalizeDotsEntries } from '../utils/names'

export function useDotsLeaderboard(refreshInterval = 300000, { enabled = true, sex } = {}) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getDotsLeaderboard(sex ? { sex } : {})
      setEntries(normalizeDotsEntries(data))
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [sex])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }

    fetchLeaderboard()

    const intervalId = setInterval(fetchLeaderboard, refreshInterval)
    return () => clearInterval(intervalId)
  }, [fetchLeaderboard, refreshInterval, enabled])

  return { entries, loading, error, lastUpdated }
}

export function useDotsLeaderboardBySex(refreshInterval = 300000, { enabled = true } = {}) {
  const [bySex, setBySex] = useState({ male: [], female: [] })
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  const fetchLeaderboards = useCallback(async () => {
    try {
      setLoading(true)
      const [male, female] = await Promise.all([
        api.getDotsLeaderboard({ sex: 'male' }),
        api.getDotsLeaderboard({ sex: 'female' }),
      ])
      setBySex({
        male: normalizeDotsEntries(male),
        female: normalizeDotsEntries(female),
      })
      setError(null)
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

    fetchLeaderboards()

    const intervalId = setInterval(fetchLeaderboards, refreshInterval)
    return () => clearInterval(intervalId)
  }, [fetchLeaderboards, refreshInterval, enabled])

  return { bySex, loading, error }
}
