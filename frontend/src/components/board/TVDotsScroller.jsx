import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import WeightDisplay from '../shared/WeightDisplay'
import VerificationBadge, { GRID_BADGE_SLOT_CLASS } from '../shared/VerificationBadge'
import TVMeetLabel from './TVMeetLabel'
import { sortDotsEntriesByScore } from './boardUtils'

const SCROLLER_STYLES = {
  default: {
    sectionClass: 'flex min-h-0 flex-1 flex-col overflow-hidden px-8',
    gridClass: 'tv-dots-scroller-grid',
    rowClass: 'tv-dots-scroller-grid rounded-lg border border-catalyst-text/10 bg-catalyst-surface py-4',
    rowGap: 'gap-3',
    rankClass: 'font-pirulen text-3xl text-catalyst-accent',
    nameClass: 'truncate text-3xl font-semibold text-catalyst-text',
    meetClass: 'mt-1 text-base',
    headerClass: 'text-lg font-semibold uppercase tracking-wider text-catalyst-text/50',
    bodyweightValueClass: 'text-2xl font-semibold text-catalyst-accent',
    bodyweightUnitClass: 'text-lg text-catalyst-accent/80',
    totalValueClass: 'text-2xl text-catalyst-text/80',
    totalUnitClass: 'text-lg text-catalyst-text/60',
    dotsValueClass: 'text-3xl font-bold text-catalyst-text',
    dotsUnitClass: 'text-xl text-catalyst-text/80',
  },
  split: {
    sectionClass: 'flex h-[min(580px,72%)] max-h-[580px] min-h-0 w-full flex-col justify-center overflow-hidden pl-0 pr-3',
    gridClass: 'tv-dots-scroller-grid tv-dots-scroller-grid-compact',
    rowClass:
      'tv-dots-scroller-grid tv-dots-scroller-grid-compact overflow-visible rounded-lg border border-catalyst-text/10 bg-catalyst-surface py-2.5',
    rowGap: 'gap-2',
    rankClass: 'font-pirulen text-xl text-catalyst-accent',
    nameClass: 'min-w-0 text-lg font-semibold leading-tight text-catalyst-text',
    meetClass: 'mt-0.5 text-xs',
    headerClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/50',
    bodyweightValueClass: 'text-base font-semibold text-catalyst-accent',
    bodyweightUnitClass: 'text-xs text-catalyst-accent/80',
    totalValueClass: 'text-base text-catalyst-text/80',
    totalUnitClass: 'text-xs text-catalyst-text/60',
    dotsValueClass: 'text-lg font-bold text-catalyst-text',
    dotsUnitClass: 'text-sm text-catalyst-text/80',
  },
}

const SCROLL_SECONDS_PER_ROW = 3
const SCROLL_START_DELAY_S = 3
const BOTTOM_PAUSE_MS = 10000

function formatDotsScore(score) {
  if (score == null) return '—'
  return Number(score).toFixed(1)
}

function GridCell({ children, align = 'center' }) {
  const alignClass =
    align === 'start' ? 'justify-start text-left' : 'justify-center text-center'

  return (
    <div className={['flex h-full w-full min-w-0 items-center', alignClass].join(' ')}>
      {children}
    </div>
  )
}

function GridHeaderCell({ children, className }) {
  return (
    <GridCell>
      <span className={className}>{children}</span>
    </GridCell>
  )
}

function GridBadgeHeaderCell({ children, className }) {
  return (
    <GridCell>
      <div className="inline-flex items-center justify-center gap-2">
        <span className={GRID_BADGE_SLOT_CLASS} aria-hidden="true" />
        <span className={className}>{children}</span>
      </div>
    </GridCell>
  )
}

function DotsScrollerRow({ entry, rank, styles }) {
  const { member, dots_score, total_kg, bodyweight_kg, meet_name, achieved_date } = entry

  return (
    <div className={styles.rowClass}>
      <GridCell>
        <span className={styles.rankClass}>{rank}</span>
      </GridCell>
      <GridCell align="start">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className={styles.nameClass}>
            {member.first_name} {member.last_name}
          </span>
          <TVMeetLabel
            meetName={meet_name}
            achievedDate={achieved_date}
            className={styles.meetClass}
          />
        </div>
      </GridCell>
      <GridCell>
        <WeightDisplay
          kg={bodyweight_kg}
          valueClassName={styles.bodyweightValueClass}
          unitClassName={styles.bodyweightUnitClass}
        />
      </GridCell>
      <GridCell>
        <WeightDisplay
          kg={total_kg}
          valueClassName={styles.totalValueClass}
          unitClassName={styles.totalUnitClass}
        />
      </GridCell>
      <GridCell>
        <div className="flex items-center justify-center gap-2">
          <VerificationBadge meetVerified size="table" />
          <span className={styles.dotsValueClass}>{formatDotsScore(dots_score)}</span>
        </div>
      </GridCell>
    </div>
  )
}

export default function TVDotsScroller({
  entries,
  startRank = 4,
  onScrollComplete,
  layout = 'default',
}) {
  const sortedEntries = useMemo(() => sortDotsEntriesByScore(entries), [entries])
  const styles = SCROLLER_STYLES[layout] ?? SCROLLER_STYLES.default
  const viewportRef = useRef(null)
  const contentRef = useRef(null)
  const pauseTimerRef = useRef(null)
  const [scrollDistance, setScrollDistance] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [hasMeasured, setHasMeasured] = useState(false)

  const scrollDuration = Math.max(
    sortedEntries.length * SCROLL_SECONDS_PER_ROW,
    SCROLL_SECONDS_PER_ROW,
  )

  const finishScroll = useCallback(() => {
    pauseTimerRef.current = setTimeout(() => {
      onScrollComplete?.()
    }, BOTTOM_PAUSE_MS)
  }, [onScrollComplete])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const distance = Math.max(0, content.scrollHeight - viewport.clientHeight)
    setScrollDistance(distance)
    setIsScrolling(distance > 0)
    setHasMeasured(true)
  }, [sortedEntries])

  useLayoutEffect(() => {
    if (!hasMeasured || !sortedEntries.length || scrollDistance > 0) return undefined

    finishScroll()
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    }
  }, [hasMeasured, sortedEntries.length, scrollDistance, finishScroll])

  useLayoutEffect(
    () => () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    },
    [],
  )

  function handleAnimationEnd() {
    finishScroll()
  }

  if (!sortedEntries.length) {
    return null
  }

  return (
    <section className={styles.sectionClass}>
      <div className={`${styles.gridClass} mb-2`}>
        <GridHeaderCell className={styles.headerClass}>Rank</GridHeaderCell>
        <GridCell align="start">
          <span className={styles.headerClass}>Name</span>
        </GridCell>
        <GridHeaderCell className={styles.headerClass}>BW</GridHeaderCell>
        <GridHeaderCell className={styles.headerClass}>Total</GridHeaderCell>
        <GridBadgeHeaderCell className={styles.headerClass}>DOTS</GridBadgeHeaderCell>
      </div>

      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={contentRef}
          className={
            isScrolling
              ? `tv-scroll-once flex flex-col ${styles.rowGap}`
              : `flex flex-col ${styles.rowGap}`
          }
          style={
            isScrolling
              ? {
                  '--tv-scroll-distance': `-${scrollDistance}px`,
                  '--tv-scroll-duration': `${scrollDuration}s`,
                  '--tv-scroll-delay': `${SCROLL_START_DELAY_S}s`,
                }
              : undefined
          }
          onAnimationEnd={isScrolling ? handleAnimationEnd : undefined}
        >
          {sortedEntries.map((entry, index) => (
            <DotsScrollerRow
              key={entry.member.id}
              entry={entry}
              rank={startRank + index}
              styles={styles}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
