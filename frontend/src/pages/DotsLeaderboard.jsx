import { Link } from 'react-router-dom'
import Loading from '../components/shared/Loading'
import { useDotsLeaderboard } from '../hooks/useDotsLeaderboard'

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

function formatDate(value) {
  if (!value) return '—'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDots(score) {
  if (score == null) return '—'
  return Number(score).toFixed(1)
}

function formatWeight(kg) {
  if (kg == null) return '—'
  return Number(kg).toFixed(1)
}

const RANK_STYLES = {
  1: {
    row: 'border-amber-400/40 bg-gradient-to-r from-amber-400/10 to-transparent',
    rank: 'text-amber-400',
    dots: 'text-amber-300',
  },
  2: {
    row: 'border-[#C8CCD6]/30 bg-gradient-to-r from-[#C8CCD6]/10 to-transparent',
    rank: 'text-[#C8CCD6]',
    dots: 'text-[#C8CCD6]',
  },
  3: {
    row: 'border-orange-400/30 bg-gradient-to-r from-orange-400/10 to-transparent',
    rank: 'text-orange-400',
    dots: 'text-orange-300',
  },
}

function LeaderboardRow({ entry }) {
  const { member, rank, dots_score, total_kg, bodyweight_kg, achieved_date, meet_name } = entry
  const styles = RANK_STYLES[rank] ?? {
    row: 'border-catalyst-text/10 bg-catalyst-surface/40',
    rank: 'text-catalyst-accent',
    dots: 'text-catalyst-text',
  }
  const name = `${member.first_name} ${member.last_name}`

  return (
    <article
      className={[
        'grid grid-cols-[3.5rem_minmax(0,1.4fr)_6rem_6rem_6rem_minmax(0,1fr)] items-center gap-4',
        'rounded-xl border px-5 py-4 transition-colors',
        styles.row,
      ].join(' ')}
    >
      <span className={`font-pirulen text-2xl tabular-nums ${styles.rank}`}>{rank}</span>

      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-catalyst-text">{name}</p>
        {meet_name ? (
          <p className="truncate text-sm text-catalyst-text/50">{meet_name}</p>
        ) : null}
      </div>

      <div className="text-right">
        <p className={`text-2xl font-bold tabular-nums ${styles.dots}`}>
          {formatDots(dots_score)}
        </p>
        <p className="text-xs uppercase tracking-wider text-catalyst-text/40">DOTS</p>
      </div>

      <div className="text-right">
        <p className="text-lg font-semibold tabular-nums text-catalyst-text">
          {formatWeight(total_kg)}
          <span className="ml-1 text-sm font-normal text-catalyst-text/50">kg</span>
        </p>
        <p className="text-xs uppercase tracking-wider text-catalyst-text/40">Total</p>
      </div>

      <div className="text-right">
        <p className="text-lg font-semibold tabular-nums text-catalyst-accent">
          {formatWeight(bodyweight_kg)}
          <span className="ml-1 text-sm font-normal text-catalyst-accent/70">kg</span>
        </p>
        <p className="text-xs uppercase tracking-wider text-catalyst-text/40">BW</p>
      </div>

      <p className="text-right text-sm text-catalyst-text/60">{formatDate(achieved_date)}</p>
    </article>
  )
}

export default function DotsLeaderboard() {
  const { entries, loading, error, lastUpdated } = useDotsLeaderboard()

  return (
    <div className="min-h-screen bg-catalyst-base text-catalyst-text">
      <header className="border-b border-catalyst-text/10 bg-catalyst-base">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/catalyst-logo.png"
              alt="Catalyst Strength"
              className="h-14 w-14 object-contain"
            />
            <div>
              <h1 className="font-pirulen text-3xl font-bold tracking-tight text-catalyst-text sm:text-4xl">
                DOTS Leaderboard
              </h1>
              <p className="mt-1 text-sm text-catalyst-text/60">
                Top 10 lifters by IPF DOTS score
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <nav className="flex items-center gap-4 text-sm">
              <Link
                to="/"
                className="text-catalyst-text/60 transition-colors hover:text-catalyst-accent"
              >
                PR Board
              </Link>
              <Link
                to="/tv"
                className="text-catalyst-text/60 transition-colors hover:text-catalyst-accent"
              >
                TV Display
              </Link>
              <span className="font-medium text-catalyst-accent">DOTS</span>
            </nav>
            <p className="text-sm text-catalyst-text/60">
              Last updated{' '}
              <span className="font-medium text-catalyst-text">
                {formatLastUpdated(lastUpdated)}
              </span>
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading && !entries.length ? (
          <Loading label="Loading DOTS leaderboard..." className="text-catalyst-text/60" />
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
            Failed to load DOTS leaderboard.
          </p>
        ) : null}

        {!error && entries.length > 0 ? (
          <div className="space-y-3">
            <div
              className={[
                'hidden grid-cols-[3.5rem_minmax(0,1.4fr)_6rem_6rem_6rem_minmax(0,1fr)]',
                'items-center gap-4 px-5 pb-2 text-xs font-semibold uppercase tracking-wider',
                'text-catalyst-text/40 sm:grid',
              ].join(' ')}
            >
              <span>Rank</span>
              <span>Lifter</span>
              <span className="text-right">Score</span>
              <span className="text-right">Total</span>
              <span className="text-right">Bodyweight</span>
              <span className="text-right">Date</span>
            </div>

            {entries.map((entry) => (
              <LeaderboardRow key={entry.member.id} entry={entry} />
            ))}
          </div>
        ) : null}

        {!loading && !error && entries.length === 0 ? (
          <p className="text-center text-catalyst-text/60">
            No DOTS scores yet. Scores appear after linked members sync OPL meet results.
          </p>
        ) : null}
      </main>
    </div>
  )
}
