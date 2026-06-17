import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import WeightDisplay from '../shared/WeightDisplay'
import VerificationBadge, { GRID_BADGE_SLOT_CLASS } from '../shared/VerificationBadge'
import LiftCrown, {
  GRID_CROWN_SLOT_CLASS,
  LIFT_LEADER_UNIT_CLASS,
  LIFT_LEADER_VALUE_CLASS,
} from '../shared/LiftCrown'
import {
  getEquipmentIndicator,
  getMemberBodyweight,
  getMemberLifts,
  getMemberTotal,
  isClassLiftLeader,
  isGymOnlyMember,
  sortMembersByTotal,
} from './boardUtils'

const SCROLLER_STYLES = {
  default: {
    sectionClass: 'flex min-h-0 flex-1 flex-col overflow-hidden px-8',
    gridClass: 'tv-scroller-grid',
    rowClass: 'tv-scroller-grid rounded-lg border border-catalyst-text/10 bg-catalyst-surface py-4',
    rowGap: 'gap-3',
    rankClass: 'font-pirulen text-3xl text-catalyst-accent',
    nameClass: 'truncate text-3xl font-semibold text-catalyst-text',
    equipClass: 'shrink-0 font-pirulen text-sm text-catalyst-accent',
    headerClass: 'text-lg font-semibold uppercase tracking-wider text-catalyst-text/50',
    bodyweightValueClass: 'text-2xl font-semibold text-catalyst-accent',
    bodyweightUnitClass: 'text-lg text-catalyst-accent/80',
    liftValueClass: 'text-2xl text-catalyst-text/80',
    liftUnitClass: 'text-lg text-catalyst-text/60',
    totalValueClass: 'text-3xl font-bold text-catalyst-text',
    totalUnitClass: 'text-xl text-catalyst-text/80',
  },
  split: {
    sectionClass: 'flex h-[min(580px,72%)] max-h-[580px] min-h-0 w-full flex-col justify-center overflow-hidden pl-0 pr-3',
    gridClass: 'tv-scroller-grid tv-scroller-grid-compact',
    rowClass:
      'tv-scroller-grid tv-scroller-grid-compact overflow-visible rounded-lg border border-catalyst-text/10 bg-catalyst-surface py-2.5',
    rowGap: 'gap-2',
    rankClass: 'font-pirulen text-xl text-catalyst-accent',
    nameClass: 'min-w-0 text-lg font-semibold leading-tight text-catalyst-text',
    equipClass: 'mt-0.5 font-pirulen text-[10px] text-catalyst-accent',
    headerClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/50',
    bodyweightValueClass: 'text-base font-semibold text-catalyst-accent',
    bodyweightUnitClass: 'text-[10px] text-catalyst-accent/80',
    liftValueClass: 'text-base tabular-nums text-catalyst-text/80',
    liftUnitClass: 'text-[10px] text-catalyst-text/60',
    totalValueClass: 'text-lg font-bold tabular-nums text-catalyst-text',
    totalUnitClass: 'text-xs text-catalyst-text/80',
  },
}

const SCROLL_SECONDS_PER_ROW = 3
const SCROLL_START_DELAY_S = 3
const BOTTOM_PAUSE_MS = 10000

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

function GridLiftHeaderCell({ children, className }) {
  return (
    <GridCell>
      <div className="inline-flex items-center justify-center gap-1">
        <span className={GRID_CROWN_SLOT_CLASS} aria-hidden="true" />
        <span className={className}>{children}</span>
      </div>
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

function GridWeightCell({ children, showCrown = false, reserveCrownSpace = false }) {
  const crownSlot = showCrown ? (
    <LiftCrown />
  ) : reserveCrownSpace ? (
    <span className={GRID_CROWN_SLOT_CLASS} aria-hidden="true" />
  ) : null

  return (
    <GridCell>
      <div className="inline-flex items-center justify-center gap-1">
        {crownSlot}
        {children}
      </div>
    </GridCell>
  )
}

function GridLiftValue({
  kg,
  lift,
  memberId,
  liftLeaders,
  valueClassName,
  unitClassName,
  showUnit = true,
}) {
  const showCrown = isClassLiftLeader(liftLeaders, lift, memberId)
  const valueClass = [valueClassName, showCrown && LIFT_LEADER_VALUE_CLASS].filter(Boolean).join(' ')
  const unitClass = [unitClassName, showCrown && LIFT_LEADER_UNIT_CLASS].filter(Boolean).join(' ')

  return (
    <GridWeightCell showCrown={showCrown} reserveCrownSpace>
      <WeightDisplay
        kg={kg}
        valueClassName={valueClass}
        unitClassName={unitClass}
        showUnit={showUnit}
      />
    </GridWeightCell>
  )
}

function ScrollerRow({ memberEntry, rank, styles, liftLeaders }) {
  const { member } = memberEntry
  const { equipment, lifts } = getMemberLifts(memberEntry)
  const equipmentLabel = getEquipmentIndicator(equipment)
  const gymOnly = isGymOnlyMember(member)
  const meetVerified = !gymOnly && lifts.total?.is_meet_verified
  const bodyweight = getMemberBodyweight(memberEntry)

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
          <span className={styles.equipClass}>{equipmentLabel}</span>
        </div>
      </GridCell>
      <GridWeightCell>
        <WeightDisplay
          kg={bodyweight}
          valueClassName={styles.bodyweightValueClass}
          unitClassName={styles.bodyweightUnitClass}
        />
      </GridWeightCell>
      <GridLiftValue
        kg={lifts.squat?.weight_kg}
        lift="squat"
        memberId={member.id}
        liftLeaders={liftLeaders}
        valueClassName={styles.liftValueClass}
        unitClassName={styles.liftUnitClass}
        showUnit={styles.liftShowUnit !== false}
      />
      <GridLiftValue
        kg={lifts.bench?.weight_kg}
        lift="bench"
        memberId={member.id}
        liftLeaders={liftLeaders}
        valueClassName={styles.liftValueClass}
        unitClassName={styles.liftUnitClass}
        showUnit={styles.liftShowUnit !== false}
      />
      <GridLiftValue
        kg={lifts.deadlift?.weight_kg}
        lift="deadlift"
        memberId={member.id}
        liftLeaders={liftLeaders}
        valueClassName={styles.liftValueClass}
        unitClassName={styles.liftUnitClass}
        showUnit={styles.liftShowUnit !== false}
      />
      <GridWeightCell>
        <div className="inline-flex items-center justify-center gap-2">
          {lifts.total ? (
            <VerificationBadge meetVerified={meetVerified} size="table" />
          ) : (
            <span className={GRID_BADGE_SLOT_CLASS} aria-hidden="true" />
          )}
          <WeightDisplay
            kg={getMemberTotal(memberEntry)}
            valueClassName={styles.totalValueClass}
            unitClassName={styles.totalUnitClass}
          />
        </div>
      </GridWeightCell>
    </div>
  )
}

export default function TVScroller({
  members,
  startRank = 4,
  onScrollComplete,
  layout = 'default',
  liftLeaders,
}) {
  const sortedMembers = useMemo(() => sortMembersByTotal(members), [members])
  const styles = SCROLLER_STYLES[layout] ?? SCROLLER_STYLES.default
  const viewportRef = useRef(null)
  const contentRef = useRef(null)
  const pauseTimerRef = useRef(null)
  const [scrollDistance, setScrollDistance] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [hasMeasured, setHasMeasured] = useState(false)

  const scrollDuration = Math.max(sortedMembers.length * SCROLL_SECONDS_PER_ROW, SCROLL_SECONDS_PER_ROW)

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
  }, [sortedMembers])

  useLayoutEffect(() => {
    if (!hasMeasured || !sortedMembers.length || scrollDistance > 0) return undefined

    finishScroll()
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    }
  }, [hasMeasured, sortedMembers.length, scrollDistance, finishScroll])

  useLayoutEffect(
    () => () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    },
    [],
  )

  function handleAnimationEnd() {
    finishScroll()
  }

  if (!sortedMembers.length) {
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
        <GridLiftHeaderCell className={styles.headerClass}>Squat</GridLiftHeaderCell>
        <GridLiftHeaderCell className={styles.headerClass}>Bench</GridLiftHeaderCell>
        <GridLiftHeaderCell className={styles.headerClass}>Deadlift</GridLiftHeaderCell>
        <GridBadgeHeaderCell className={styles.headerClass}>Total</GridBadgeHeaderCell>
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
          {sortedMembers.map((memberEntry, index) => (
            <ScrollerRow
              key={memberEntry.member.id}
              memberEntry={memberEntry}
              rank={startRank + index}
              styles={styles}
              liftLeaders={liftLeaders}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
