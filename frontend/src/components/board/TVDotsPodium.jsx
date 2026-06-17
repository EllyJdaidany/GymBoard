import WeightDisplay from '../shared/WeightDisplay'
import VerificationBadge from '../shared/VerificationBadge'
import TVMeetLabel from './TVMeetLabel'
import { PODIUM_LAYOUTS } from './TVPodium'

function formatDotsScore(score) {
  if (score == null) return '—'
  return Number(score).toFixed(1)
}

function getPodiumNameClass(firstName, lastName, rank, maxClass) {
  const length = `${firstName} ${lastName}`.trim().length

  const tiers =
    rank === 1
      ? [
          { max: 14, class: maxClass },
          { max: 20, class: 'text-3xl' },
          { max: 28, class: 'text-2xl' },
          { max: 36, class: 'text-xl' },
          { max: Infinity, class: 'text-lg' },
        ]
      : [
          { max: 12, class: maxClass },
          { max: 18, class: 'text-2xl' },
          { max: 24, class: 'text-xl' },
          { max: 32, class: 'text-lg' },
          { max: Infinity, class: 'text-base' },
        ]

  return tiers.find((tier) => length <= tier.max)?.class ?? 'text-base'
}

function PodiumName({ member, rank, maxClass }) {
  const nameClass = getPodiumNameClass(member.first_name, member.last_name, rank, maxClass)

  return (
    <p
      className={`max-w-full font-bold leading-tight text-balance break-words text-catalyst-text ${nameClass}`}
    >
      {member.first_name} {member.last_name}
    </p>
  )
}

function getDotsCardWidths(rank, layout) {
  if (layout === 'centered') {
    return 'w-[22rem] shrink-0 min-w-[22rem] max-w-[22rem]'
  }
  if (rank === 1) {
    return 'w-full flex-[1.15] shrink-0 min-w-[17rem] max-w-[28rem]'
  }
  if (rank === 2) {
    return 'w-full flex-1 shrink-0 min-w-[17rem] max-w-[25rem]'
  }
  return 'w-full flex-1 shrink-0 min-w-[17rem] max-w-[25rem]'
}

function getDotsTypography(rank) {
  if (rank === 1) {
    return {
      dotsValueClass: 'text-5xl font-bold tabular-nums leading-none',
      dotsLabelClass: 'text-sm font-semibold uppercase tracking-wider text-catalyst-text/40',
    }
  }
  if (rank === 2) {
    return {
      dotsValueClass: 'text-4xl font-bold tabular-nums leading-none',
      dotsLabelClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/40',
    }
  }
  return {
    dotsValueClass: 'text-4xl font-bold tabular-nums leading-none',
    dotsLabelClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/40',
  }
}

function DotsPodiumCard({
  entry,
  rank,
  layout,
  cardMinHeight,
  glowClass = '',
  scoreColor,
  unitColor,
  nameClass,
  bodyweightValueClass,
  bodyweightUnitClass,
  totalValueClass,
  totalUnitClass,
  contentPush = '',
  statsPush = '',
  animate,
  cardRef,
}) {
  if (!entry) {
    return <div className={`${getDotsCardWidths(rank, layout)} ${cardMinHeight}`} />
  }

  const { member, dots_score, total_kg, bodyweight_kg, meet_name, achieved_date } = entry
  const { dotsValueClass, dotsLabelClass } = getDotsTypography(rank)
  const meetLabelClass =
    rank === 1 ? 'mt-2 text-sm leading-snug' : 'mt-1.5 text-xs leading-snug'

  return (
    <div
      ref={cardRef}
      className={['tv-podium-card-wrap', getDotsCardWidths(rank, layout), glowClass].filter(Boolean).join(' ')}
    >
      <article
        className={[
          'tv-podium-card-shell h-full w-full',
          cardMinHeight,
          'flex flex-col items-center rounded-2xl border bg-catalyst-surface px-10 py-6 text-center',
          contentPush,
          animate ? 'tv-podium-card' : '',
        ].join(' ')}
        style={{ '--podium-rank': rank }}
      >
        <div className="relative z-10 w-full min-w-0">
          <PodiumName member={member} rank={rank} maxClass={nameClass} />
          <TVMeetLabel meetName={meet_name} achievedDate={achieved_date} className={meetLabelClass} />
          <div className="pt-3">
            <WeightDisplay
              kg={bodyweight_kg}
              valueClassName={bodyweightValueClass}
              unitClassName={bodyweightUnitClass}
            />
          </div>
        </div>

        <div className={['relative z-10 mt-auto flex w-full flex-col items-center gap-4', statsPush].join(' ')}>
          <WeightDisplay
            kg={total_kg}
            valueClassName={totalValueClass}
            unitClassName={totalUnitClass}
          />

          <div className="flex w-full flex-col items-center gap-1.5">
            <div className="flex items-center justify-center gap-2.5">
              <VerificationBadge meetVerified size="lg" />
              <span className={`${dotsValueClass} ${scoreColor}`}>{formatDotsScore(dots_score)}</span>
            </div>
            <span className={`${dotsLabelClass} ${unitColor}`}>DOTS</span>
          </div>
        </div>
      </article>
    </div>
  )
}

export default function TVDotsPodium({
  entries,
  animate = false,
  layout = 'stacked',
  secondPlaceRef,
  firstPlaceRef,
}) {
  const sortedEntries = [...entries].sort((a, b) => (b.dots_score ?? 0) - (a.dots_score ?? 0))
  const byRank = {
    1: sortedEntries[0],
    2: sortedEntries[1],
    3: sortedEntries[2],
  }

  const config = PODIUM_LAYOUTS[layout] ?? PODIUM_LAYOUTS.stacked

  const renderPodiumCard = (slot) => {
    if (!byRank[slot.rank]) return null

    let cardRef
    if (slot.rank === 1) cardRef = firstPlaceRef
    else if (slot.rank === 2) cardRef = secondPlaceRef

    return (
      <DotsPodiumCard
        key={slot.rank}
        entry={byRank[slot.rank]}
        rank={slot.rank}
        layout={layout}
        animate={animate}
        cardRef={cardRef}
        cardMinHeight={slot.cardMinHeight}
        glowClass={slot.glowClass}
        scoreColor={slot.scoreColor}
        unitColor={slot.unitColor}
        nameClass={slot.nameClass}
        bodyweightValueClass={slot.bodyweightValueClass}
        bodyweightUnitClass={slot.bodyweightUnitClass}
        totalValueClass={slot.liftValueClass}
        totalUnitClass={slot.liftLabelClass}
        contentPush={slot.contentPush}
        statsPush={slot.statsPush}
      />
    )
  }

  if (layout === 'centered') {
    const slotsByColumn = {
      left: config.slots.find((slot) => slot.column === 'left'),
      center: config.slots.find((slot) => slot.column === 'center'),
      right: config.slots.find((slot) => slot.column === 'right'),
    }
    const activeCount = config.slots.filter((slot) => byRank[slot.rank]).length

    if (activeCount === 1 && slotsByColumn.center) {
      return (
        <section className="flex w-full justify-center overflow-visible px-2">
          {renderPodiumCard(slotsByColumn.center)}
        </section>
      )
    }

    return (
      <section className={config.sectionClass}>
        <div className="flex justify-end overflow-visible">
          {slotsByColumn.left ? renderPodiumCard(slotsByColumn.left) : null}
        </div>
        <div className="flex justify-center overflow-visible">
          {slotsByColumn.center ? renderPodiumCard(slotsByColumn.center) : null}
        </div>
        <div className="flex justify-start overflow-visible">
          {slotsByColumn.right ? renderPodiumCard(slotsByColumn.right) : null}
        </div>
      </section>
    )
  }

  const activeSlots = config.slots.filter((slot) => byRank[slot.rank])

  return (
    <section
      className={[
        config.sectionClass,
        activeSlots.length <= 2 ? 'max-w-5xl' : 'max-w-none',
      ].join(' ')}
    >
      {config.slots
        .filter((slot) => byRank[slot.rank])
        .map((slot) => renderPodiumCard(slot))}
    </section>
  )
}
