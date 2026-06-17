import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import MemberCard from '../components/board/MemberCard'
import { sortMembersByTotal } from '../components/board/boardUtils'
import Loading from '../components/shared/Loading'
import { useBoardData } from '../hooks/useBoardData'

function formatLastUpdated(date) {
  if (!date) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function Board() {
  const { members, loading, error, lastUpdated } = useBoardData()

  const sortedMembers = useMemo(() => sortMembersByTotal(members), [members])

  return (
    <div className="min-h-screen bg-catalyst-base text-catalyst-text">
      <header className="border-b border-catalyst-text/10 bg-catalyst-base">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/catalyst-logo.png"
              alt="Catalyst Strength"
              className="h-14 w-14 object-contain"
            />
            <div>
              <h1 className="font-pirulen text-3xl font-bold tracking-tight text-catalyst-text sm:text-4xl">
                Catalyst Strength
              </h1>
              <p className="mt-1 text-sm text-catalyst-text/60">PR Board</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <nav className="flex items-center gap-4 text-sm">
              <span className="font-medium text-catalyst-accent">PR Board</span>
              <Link
                to="/leaderboard/dots"
                className="text-catalyst-text/60 transition-colors hover:text-catalyst-accent"
              >
                DOTS
              </Link>
              <Link
                to="/tv"
                className="text-catalyst-text/60 transition-colors hover:text-catalyst-accent"
              >
                TV Display
              </Link>
            </nav>
            <p className="text-sm text-catalyst-text/60">
              Last updated{' '}
              <span className="font-medium text-catalyst-text">{formatLastUpdated(lastUpdated)}</span>
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading && !members.length ? (
          <Loading label="Loading PR board..." className="text-catalyst-text/60" />
        ) : null}
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
            Failed to load PR board.
          </p>
        ) : null}

        {!error ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {sortedMembers.map((memberEntry) => (
              <MemberCard key={memberEntry.member.id} memberEntry={memberEntry} />
            ))}
          </div>
        ) : null}

        {!loading && !error && sortedMembers.length === 0 ? (
          <p className="text-center text-catalyst-text/60">No members on the board yet.</p>
        ) : null}
      </main>
    </div>
  )
}
