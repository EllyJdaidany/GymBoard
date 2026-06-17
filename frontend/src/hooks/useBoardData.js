import { useSearchParams } from 'react-router-dom'
import { mockPRBoard } from '../mocks/prBoardMock'
import { normalizeMemberEntries } from '../utils/names'
import { usePRBoard } from './usePRBoard'

export function resolveUseMock(searchParams) {
  const mockParam = searchParams.get('mock')
  if (mockParam === 'true') return true
  if (mockParam === 'false') return false
  return import.meta.env.DEV
}

export function useBoardData(refreshInterval = 300000) {
  const [searchParams] = useSearchParams()
  const useMock = resolveUseMock(searchParams)
  const { members, loading, error, lastUpdated } = usePRBoard(refreshInterval, {
    enabled: !useMock,
  })

  return {
    members: useMock ? normalizeMemberEntries(mockPRBoard) : members,
    loading: useMock ? false : loading,
    error: useMock ? null : error,
    lastUpdated: useMock ? new Date() : lastUpdated,
    useMock,
  }
}
