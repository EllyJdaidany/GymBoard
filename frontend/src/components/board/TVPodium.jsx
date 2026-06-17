import WeightDisplay from '../shared/WeightDisplay'
import VerificationBadge from '../shared/VerificationBadge'
import LiftCrown, {
  CROWN_OVERLAY_CLASS,
  CROWN_VALUE_SLOT_CLASS,
  LIFT_LEADER_LABEL_CLASS,
  LIFT_LEADER_VALUE_CLASS,
} from '../shared/LiftCrown'
import {
  getEquipmentIndicator,
  getMemberBodyweight,
  getMemberLifts,
  getMemberTotal,
  isClassLiftLeader,
  isGymOnlyMember,
} from './boardUtils'

function LiftStat({ label, weightKg, valueClassName, labelClassName, showCrown = false }) {
  const valueClass = [valueClassName, showCrown && LIFT_LEADER_VALUE_CLASS].filter(Boolean).join(' ')
  const labelClass = [labelClassName, showCrown && LIFT_LEADER_LABEL_CLASS].filter(Boolean).join(' ')

  return (
    <div className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <div className={CROWN_VALUE_SLOT_CLASS}>
        {showCrown ? <LiftCrown className={CROWN_OVERLAY_CLASS} /> : null}
        <span className={`tabular-nums ${valueClass}`}>
          {weightKg != null ? `${Number(weightKg).toFixed(1)}` : '—'}
        </span>
      </div>
      <span className={labelClass}>{label}</span>
    </div>
  )
}

const PODIUM_CARD_WIDTH = 'w-80'
const PODIUM_CARD_WIDTH_SPLIT = 'w-full min-w-0 flex-1 shrink-0'
const PODIUM_CARD_WIDTH_CENTERED = 'w-[22rem] shrink-0 min-w-[22rem] max-w-[22rem]'

export const PODIUM_LAYOUTS = {
  stacked: {
    sectionClass: 'flex items-end justify-center gap-4 px-8',
    slots: [
      {
        rank: 2,
        cardWidth: PODIUM_CARD_WIDTH,
        cardMinHeight: 'min-h-[15rem]',
        contentPush: '',
        statsPush: '',
        liftsToTotalGap: 'gap-4',
        scoreColor: 'text-[#C8CCD6]',
        unitColor: 'text-[#9AA3B2]',
        nameClass: 'text-3xl',
        equipClass: 'text-lg',
        bodyweightValueClass: 'text-lg font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-sm text-catalyst-accent/80',
        liftValueClass: 'text-xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-4xl font-bold',
        totalUnitClass: 'text-xl',
      },
      {
        rank: 1,
        cardWidth: PODIUM_CARD_WIDTH,
        cardMinHeight: 'min-h-[20rem]',
        contentPush: 'pt-5',
        statsPush: 'pt-8',
        liftsToTotalGap: 'gap-5',
        scoreColor: 'text-amber-400',
        unitColor: 'text-amber-300/90',
        nameClass: 'text-4xl',
        equipClass: 'text-xl',
        bodyweightValueClass: 'text-2xl font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-lg text-catalyst-accent/80',
        liftValueClass: 'text-2xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-sm font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-5xl font-bold',
        totalUnitClass: 'text-2xl',
      },
      {
        rank: 3,
        cardWidth: PODIUM_CARD_WIDTH,
        cardMinHeight: 'min-h-[10rem]',
        contentPush: '',
        statsPush: '',
        liftsToTotalGap: 'gap-4',
        scoreColor: 'text-orange-400',
        unitColor: 'text-orange-300/90',
        nameClass: 'text-3xl',
        equipClass: 'text-lg',
        bodyweightValueClass: 'text-base font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-sm text-catalyst-accent/80',
        liftValueClass: 'text-xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-4xl font-bold',
        totalUnitClass: 'text-xl',
      },
    ],
  },
  split: {
    sectionClass: 'flex w-full max-w-full items-end justify-start gap-8 overflow-visible py-6 pl-0 pr-1',
    slots: [
      {
        rank: 2,
        cardWidth: `${PODIUM_CARD_WIDTH_SPLIT} min-w-[17rem] max-w-[24rem]`,
        cardMinHeight: 'min-h-[22rem]',
        glowClass: 'tv-podium-rank-2',
        contentPush: '',
        statsPush: 'pt-2',
        liftsToTotalGap: 'gap-5',
        scoreColor: 'text-[#D4DCE8]',
        unitColor: 'text-[#A8B2C3]',
        nameClass: 'text-3xl',
        equipClass: 'text-lg',
        bodyweightValueClass: 'text-xl font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-base text-catalyst-accent/80',
        liftValueClass: 'text-2xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-4xl font-bold',
        totalUnitClass: 'text-xl',
      },
      {
        rank: 1,
        cardWidth: `${PODIUM_CARD_WIDTH_SPLIT} min-w-[14rem] max-w-[26rem] flex-[1.12]`,
        cardMinHeight: 'min-h-[30rem]',
        glowClass: 'tv-podium-rank-1',
        contentPush: 'pt-4',
        statsPush: 'pt-6',
        liftsToTotalGap: 'gap-6',
        scoreColor: 'text-amber-400',
        unitColor: 'text-amber-300/90',
        nameClass: 'text-4xl',
        equipClass: 'text-xl',
        bodyweightValueClass: 'text-2xl font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-lg text-catalyst-accent/80',
        liftValueClass: 'text-2xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-sm font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-5xl font-bold',
        totalUnitClass: 'text-2xl',
      },
      {
        rank: 3,
        cardWidth: `${PODIUM_CARD_WIDTH_SPLIT} min-w-[17rem] max-w-[24rem]`,
        cardMinHeight: 'min-h-[18rem]',
        glowClass: 'tv-podium-rank-3',
        contentPush: '',
        statsPush: 'pt-2',
        liftsToTotalGap: 'gap-5',
        scoreColor: 'text-[#D4956A]',
        unitColor: 'text-[#B87A52]',
        nameClass: 'text-3xl',
        equipClass: 'text-lg',
        bodyweightValueClass: 'text-lg font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-sm text-catalyst-accent/80',
        liftValueClass: 'text-xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-4xl font-bold',
        totalUnitClass: 'text-xl',
      },
    ],
  },
  centered: {
    sectionClass:
      'mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-10 overflow-visible px-2',
    slots: [
      {
        rank: 2,
        column: 'left',
        cardWidth: PODIUM_CARD_WIDTH_CENTERED,
        cardMinHeight: 'min-h-[22rem]',
        glowClass: 'tv-podium-rank-2',
        contentPush: '',
        statsPush: 'pt-2',
        liftsToTotalGap: 'gap-5',
        liftsRowGap: 'gap-5',
        scoreColor: 'text-[#D4DCE8]',
        unitColor: 'text-[#A8B2C3]',
        nameClass: 'text-3xl',
        equipClass: 'text-lg',
        bodyweightValueClass: 'text-xl font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-base text-catalyst-accent/80',
        liftValueClass: 'text-2xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-4xl font-bold',
        totalUnitClass: 'text-xl',
      },
      {
        rank: 1,
        column: 'center',
        cardWidth: PODIUM_CARD_WIDTH_CENTERED,
        cardMinHeight: 'min-h-[30rem]',
        glowClass: 'tv-podium-rank-1',
        contentPush: 'pt-4',
        statsPush: 'pt-6',
        liftsToTotalGap: 'gap-6',
        liftsRowGap: 'gap-5',
        scoreColor: 'text-amber-400',
        unitColor: 'text-amber-300/90',
        nameClass: 'text-4xl',
        equipClass: 'text-xl',
        bodyweightValueClass: 'text-2xl font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-lg text-catalyst-accent/80',
        liftValueClass: 'text-2xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-sm font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-5xl font-bold',
        totalUnitClass: 'text-2xl',
      },
      {
        rank: 3,
        column: 'right',
        cardWidth: PODIUM_CARD_WIDTH_CENTERED,
        cardMinHeight: 'min-h-[18rem]',
        glowClass: 'tv-podium-rank-3',
        contentPush: '',
        statsPush: 'pt-2',
        liftsToTotalGap: 'gap-5',
        liftsRowGap: 'gap-5',
        scoreColor: 'text-[#D4956A]',
        unitColor: 'text-[#B87A52]',
        nameClass: 'text-3xl',
        equipClass: 'text-lg',
        bodyweightValueClass: 'text-lg font-semibold text-catalyst-accent',
        bodyweightUnitClass: 'text-sm text-catalyst-accent/80',
        liftValueClass: 'text-xl font-semibold text-catalyst-text',
        liftLabelClass: 'text-xs font-semibold uppercase tracking-wider text-catalyst-text/40',
        totalValueClass: 'text-4xl font-bold',
        totalUnitClass: 'text-xl',
      },
    ],
  },
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

function PodiumCard({
  memberEntry,
  rank,
  cardWidth,
  cardMinHeight,
  glowClass = '',
  scoreColor,
  unitColor,
  nameClass,
  equipClass,
  bodyweightValueClass,
  bodyweightUnitClass,
  liftValueClass,
  liftLabelClass,
  totalValueClass,
  totalUnitClass,
  contentPush = '',
  statsPush = '',
  liftsToTotalGap = 'gap-4',
  liftsRowGap = 'gap-5',
  animate,
  cardRef,
  liftLeaders,
}) {
  if (!memberEntry) {
    return <div className={`${cardWidth} ${cardMinHeight}`} />
  }

  const { member } = memberEntry
  const { equipment, lifts } = getMemberLifts(memberEntry)
  const equipmentLabel = getEquipmentIndicator(equipment)
  const total = getMemberTotal(memberEntry)
  const gymOnly = isGymOnlyMember(member)
  const meetVerified = !gymOnly && lifts.total?.is_meet_verified
  const bodyweight = getMemberBodyweight(memberEntry)

  return (
    <div
      ref={cardRef}
      className={['tv-podium-card-wrap', cardWidth, glowClass].filter(Boolean).join(' ')}
    >
      <article
        className={[
          'tv-podium-card-shell h-full w-full',
          cardMinHeight,
          'flex flex-col items-center rounded-2xl border bg-catalyst-surface px-8 py-6 text-center',
          contentPush,
          animate ? 'tv-podium-card' : '',
        ].join(' ')}
        style={{ '--podium-rank': rank }}
      >
      <div className="relative z-10 w-full min-w-0">
        <PodiumName member={member} rank={rank} maxClass={nameClass} />
        <p className={`mt-2 font-pirulen text-catalyst-text/50 ${equipClass}`}>{equipmentLabel}</p>
        <div className="pt-3">
          <WeightDisplay
            kg={bodyweight}
            valueClassName={bodyweightValueClass}
            unitClassName={bodyweightUnitClass}
          />
        </div>
      </div>

      <div
        className={[
          'relative z-10 mt-auto flex w-full flex-col items-center',
          statsPush,
          liftsToTotalGap,
        ].join(' ')}
      >
        <div className={['flex w-full max-w-full justify-center', liftsRowGap].join(' ')}>
          <LiftStat
            label="S"
            weightKg={lifts.squat?.weight_kg}
            valueClassName={liftValueClass}
            labelClassName={liftLabelClass}
            showCrown={isClassLiftLeader(liftLeaders, 'squat', member.id)}
          />
          <LiftStat
            label="B"
            weightKg={lifts.bench?.weight_kg}
            valueClassName={liftValueClass}
            labelClassName={liftLabelClass}
            showCrown={isClassLiftLeader(liftLeaders, 'bench', member.id)}
          />
          <LiftStat
            label="D"
            weightKg={lifts.deadlift?.weight_kg}
            valueClassName={liftValueClass}
            labelClassName={liftLabelClass}
            showCrown={isClassLiftLeader(liftLeaders, 'deadlift', member.id)}
          />
        </div>

        <div className="flex items-center justify-center gap-3">
          {lifts.total ? <VerificationBadge meetVerified={meetVerified} size="lg" /> : null}
          <WeightDisplay
            kg={total}
            valueClassName={`${totalValueClass} ${scoreColor}`}
            unitClassName={`${totalUnitClass} ${unitColor}`}
          />
        </div>
      </div>
    </article>
    </div>
  )
}

export default function TVPodium({
  members,
  animate = false,
  layout = 'stacked',
  secondPlaceRef,
  firstPlaceRef,
  liftLeaders,
}) {
  const byRank = {
    1: members[0],
    2: members[1],
    3: members[2],
  }

  const config = PODIUM_LAYOUTS[layout] ?? PODIUM_LAYOUTS.stacked

  const renderPodiumCard = (slot) => {
    if (!byRank[slot.rank]) return null

    let cardRef
    if (slot.rank === 1) cardRef = firstPlaceRef
    else if (slot.rank === 2) cardRef = secondPlaceRef

    return (
      <PodiumCard
        key={slot.rank}
        memberEntry={byRank[slot.rank]}
        animate={animate}
        cardRef={cardRef}
        liftLeaders={liftLeaders}
        {...slot}
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
