import {
  adjustBucketForBodyweight,
  formatBucketLabel,
  getBucketById,
  getMemberRuleset,
  getRulesetFromFederation,
  parseMemberWeightClass,
  resolveBucketId,
  resolveMeetBucketIdWithFallback,
} from '../../config/weightClassBuckets'

const LIFTS = ['squat', 'bench', 'deadlift', 'total']

function normalizeEquipment(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'raw') return 'classic raw'
  return normalized
}

export function getEquipmentIndicator(equipment) {
  return normalizeEquipment(equipment) === 'equipped' ? 'EQ' : 'RAW'
}

function selectLiftEntry(entries, equipment) {
  if (!entries?.length) return null

  const normalized = normalizeEquipment(equipment)
  const matches = entries.filter(
    (entry) => normalizeEquipment(entry.equipment) === normalized,
  )
  if (!matches.length) return null

  return [...matches].sort((a, b) => b.weight_kg - a.weight_kg)[0]
}

export function getEntryBucketId(entry, member, memberEntry = null) {
  const sex = getMemberSex(member, memberEntry)
  if (!sex) return entry?.canonical_bucket_id ?? null

  const ruleset =
    entry?.meet_ruleset ??
    (entry?.federation ? getRulesetFromFederation(entry.federation) : null) ??
    getMemberRuleset(member)

  let bucketId = entry?.canonical_bucket_id
  if (!bucketId) {
    const classToken = entry?.meet_weight_class_kg ?? entry?.weight_class_kg
    if (classToken == null) return null
    bucketId = resolveMeetBucketIdWithFallback(
      sex,
      ruleset,
      classToken,
      entry?.bodyweight_kg,
    ).bucketId
    return bucketId
  }

  return adjustBucketForBodyweight(bucketId, ruleset, entry?.bodyweight_kg, sex)
}

export function getMemberBucketIds(memberEntry) {
  const bucketIds = new Set()

  for (const lift of LIFTS) {
    for (const entry of memberEntry.best_lifts?.[lift] ?? []) {
      const bucketId = getEntryBucketId(entry, memberEntry.member, memberEntry)
      if (bucketId) bucketIds.add(bucketId)
    }
  }

  return [...bucketIds]
}

export function scopeMemberEntryToBucket(memberEntry, bucketId) {
  const { member, best_lifts: bestLifts } = memberEntry

  return {
    member,
    bucketId,
    best_lifts: Object.fromEntries(
      LIFTS.map((lift) => [
        lift,
        (bestLifts?.[lift] ?? []).filter(
          (entry) => getEntryBucketId(entry, member, memberEntry) === bucketId,
        ),
      ]),
    ),
  }
}

function memberEntryHasBucketLifts(memberEntry) {
  return LIFTS.some((lift) => {
    const entries = memberEntry.best_lifts?.[lift] ?? []
    return entries.some((entry) => entry?.weight_kg != null)
  })
}

export function getPrimaryEquipment(memberEntry) {
  const totals = memberEntry.best_lifts?.total ?? []
  if (!totals.length) return 'classic raw'

  const best = [...totals].sort((a, b) => b.weight_kg - a.weight_kg)[0]
  return normalizeEquipment(best.equipment)
}

export function getMemberLifts(memberEntry) {
  const equipment = getPrimaryEquipment(memberEntry)
  const { best_lifts: bestLifts } = memberEntry
  return {
    equipment,
    lifts: Object.fromEntries(
      LIFTS.map((lift) => [lift, selectLiftEntry(bestLifts?.[lift], equipment)]),
    ),
  }
}

const CLASS_LIFT_TYPES = ['squat', 'bench', 'deadlift']

export function getClassLiftLeaders(members) {
  const leaderState = Object.fromEntries(
    CLASS_LIFT_TYPES.map((lift) => [lift, { max: Number.NEGATIVE_INFINITY, ids: new Set() }]),
  )

  for (const memberEntry of members) {
    const { lifts } = getMemberLifts(memberEntry)
    const memberId = memberEntry.member.id

    for (const lift of CLASS_LIFT_TYPES) {
      const weight = lifts[lift]?.weight_kg
      if (weight == null) continue

      const state = leaderState[lift]
      if (weight > state.max) {
        state.max = weight
        state.ids = new Set([memberId])
      } else if (weight === state.max) {
        state.ids.add(memberId)
      }
    }
  }

  return Object.fromEntries(
    CLASS_LIFT_TYPES.map((lift) => [lift, leaderState[lift].ids]),
  )
}

export function isClassLiftLeader(liftLeaders, lift, memberId) {
  return liftLeaders?.[lift]?.has(memberId) ?? false
}

function getBestTotalWeight(memberEntry) {
  const totals = memberEntry.best_lifts?.total ?? []
  if (!totals.length) return 0
  return Math.max(...totals.map((entry) => entry.weight_kg))
}

export function getMemberTotal(memberEntry) {
  const { lifts } = getMemberLifts(memberEntry)
  return lifts.total?.weight_kg ?? getBestTotalWeight(memberEntry)
}

export function getMemberTotalMeetBodyweight(memberEntry) {
  const { lifts } = getMemberLifts(memberEntry)
  if (hasMeetBodyweight(lifts.total)) {
    return lifts.total.bodyweight_kg
  }
  return null
}

export function getWeightClass(member) {
  const value = member.weight_class?.trim()
  return value || 'Open'
}

export function getMemberBucket(member) {
  const sex = getMemberSex(member)
  if (!sex) return null

  const ruleset = getMemberRuleset(member)
  const classToken = parseMemberWeightClass(member)
  const bucketId = resolveBucketId(sex, ruleset, classToken)
  if (!bucketId) return null

  const bucket = getBucketById(bucketId)
  if (!bucket) return null

  return {
    id: bucketId,
    sex,
    display: bucket.display,
    sortOrder: bucket.sortOrder,
    ruleset,
    weightClass: classToken,
    label: formatBucketLabel(sex, bucket),
  }
}

const SEX_SORT_ORDER = {
  female: 0,
  male: 1,
  mx: 2,
}

export function normalizeSex(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (['f', 'female', 'women', 'woman'].includes(normalized)) return 'female'
  if (['m', 'male', 'men', 'man'].includes(normalized)) return 'male'
  if (['mx', 'non-binary', 'nonbinary', 'nb'].includes(normalized)) return 'mx'
  return null
}

export function inferSexFromBucketId(bucketId) {
  if (!bucketId) return null
  const key = String(bucketId).trim().toLowerCase()
  if (key.startsWith('f-')) return 'female'
  if (key.startsWith('m-')) return 'male'
  return null
}

export function getMemberSex(member, memberEntry = null) {
  let bucketSex = null
  if (memberEntry?.best_lifts) {
    const bucketSexes = new Set()
    for (const lift of ['squat', 'bench', 'deadlift', 'total']) {
      for (const entry of memberEntry.best_lifts[lift] ?? []) {
        const fromBucket = inferSexFromBucketId(entry.canonical_bucket_id)
        if (fromBucket) bucketSexes.add(fromBucket)
      }
    }
    if (bucketSexes.size === 1) {
      bucketSex = [...bucketSexes][0]
    }
  }

  const fromProfile = normalizeSex(member.sex ?? member.gender)
  if (bucketSex && fromProfile && bucketSex !== fromProfile) {
    return bucketSex
  }
  if (fromProfile) return fromProfile
  if (bucketSex) return bucketSex

  return null
}

export function formatLeaderboardLabel(sex, label) {
  return label
}

export function formatTVGenderLabel(sex) {
  const labels = {
    female: 'WOMENS',
    male: 'MENS',
    mx: 'MX',
  }
  return labels[sex] ?? 'OPEN'
}

export function formatTVWeightClassLabel(weightClass) {
  return String(weightClass ?? 'Open').toUpperCase()
}

export function getLeaderboardKey(bucketId, sex) {
  return `${sex}|${bucketId}`
}

export const SECONDARY_BUCKET_PODIUM_RANK = 3

export function getMemberPrimaryBucketId(memberEntry) {
  let bestTotal = -1
  let primaryBucketId = null

  for (const totalEntry of memberEntry.best_lifts?.total ?? []) {
    const weight = totalEntry?.weight_kg
    if (weight == null || weight <= bestTotal) continue

    const bucketId = getEntryBucketId(totalEntry, memberEntry.member, memberEntry)
    if (!bucketId) continue

    bestTotal = weight
    primaryBucketId = bucketId
  }

  return primaryBucketId
}

export function shouldShowMemberInBucket(bucketId, rankInBucket, primaryBucketId) {
  if (!primaryBucketId) return true
  if (bucketId === primaryBucketId) return true
  return rankInBucket <= SECONDARY_BUCKET_PODIUM_RANK
}

export function groupMembersByLeaderboard(members) {
  const groups = {}

  for (const entry of members) {
    const bucketIds = getMemberBucketIds(entry)

    for (const bucketId of bucketIds) {
      const bucket = getBucketById(bucketId)
      const sex = getMemberSex(entry.member, entry) ?? inferSexFromBucketId(bucketId)
      if (!bucket || !sex || !bucket.sex.includes(sex)) continue

      const scopedEntry = scopeMemberEntryToBucket(entry, bucketId)
      if (!memberEntryHasBucketLifts(scopedEntry)) continue

      if (!groups[bucketId]) {
        groups[bucketId] = {
          key: getLeaderboardKey(bucketId, sex),
          bucketId,
          sex,
          weightClass: bucket.display,
          label: formatBucketLabel(sex, bucket),
          sortOrder: bucket.sortOrder,
          members: [],
        }
      }

      groups[bucketId].members.push(scopedEntry)
    }
  }

  return groups
}

export function getLeaderboardPages(members) {
  const groups = groupMembersByLeaderboard(members)

  const primaryBucketByMemberId = new Map(
    members
      .map((entry) => [entry.member.id, getMemberPrimaryBucketId(entry)])
      .filter(([, bucketId]) => bucketId),
  )

  const rankByBucket = Object.fromEntries(
    Object.entries(groups).map(([bucketId, group]) => {
      const sorted = sortMembersByTotal(group.members)
      return [
        bucketId,
        new Map(sorted.map((memberEntry, index) => [memberEntry.member.id, index + 1])),
      ]
    }),
  )

  return Object.values(groups)
    .map((page) => ({
      ...page,
      members: page.members.filter((scopedEntry) => {
        const memberId = scopedEntry.member.id
        const primaryBucketId = primaryBucketByMemberId.get(memberId)
        const rank = rankByBucket[page.bucketId]?.get(memberId) ?? Number.POSITIVE_INFINITY
        return shouldShowMemberInBucket(page.bucketId, rank, primaryBucketId)
      }),
    }))
    .filter((page) => page.members.length > 0)
    .sort(compareLeaderboardPages)
}

export const DOTS_TV_WEIGHT_CLASS_LABEL = 'Highest DOTS'

export function sortDotsEntriesByScore(entries) {
  return [...entries].sort((a, b) => {
    const dotsDiff = (b.dots_score ?? 0) - (a.dots_score ?? 0)
    if (dotsDiff !== 0) return dotsDiff

    const lastNameDiff = a.member.last_name.localeCompare(b.member.last_name)
    if (lastNameDiff !== 0) return lastNameDiff

    return a.member.first_name.localeCompare(b.member.first_name)
  })
}

export function buildTvBoardPages(weightClassPages, dotsBySex = {}) {
  const dotsSexOrder = ['male', 'female']
  const result = []
  const pagesBySex = new Map()

  for (const page of weightClassPages) {
    if (!pagesBySex.has(page.sex)) {
      pagesBySex.set(page.sex, [])
    }
    pagesBySex.get(page.sex).push(page)
  }

  const allSexes = [
    ...new Set([...dotsSexOrder, ...weightClassPages.map((page) => page.sex)]),
  ]

  for (const sex of allSexes) {
    result.push(...(pagesBySex.get(sex) ?? []))

    const dotsEntries = sortDotsEntriesByScore(dotsBySex[sex] ?? [])
    if (dotsEntries.length) {
      result.push({
        key: `dots|${sex}`,
        pageType: 'dots',
        sex,
        weightClass: DOTS_TV_WEIGHT_CLASS_LABEL,
        entries: dotsEntries,
      })
    }
  }

  return result
}

function compareLeaderboardPages(a, b) {
  const sexDiff = (SEX_SORT_ORDER[a.sex] ?? 99) - (SEX_SORT_ORDER[b.sex] ?? 99)
  if (sexDiff !== 0) return sexDiff
  return a.sortOrder - b.sortOrder
}

export function groupMembersByWeightClass(members) {
  return members.reduce((groups, entry) => {
    const weightClass = getWeightClass(entry.member)
    if (!groups[weightClass]) {
      groups[weightClass] = []
    }
    groups[weightClass].push(entry)
    return groups
  }, {})
}

export function sortWeightClassNames(classes) {
  return [...classes].sort((a, b) => {
    const numA = Number.parseFloat(a)
    const numB = Number.parseFloat(b)
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB
    if (a === 'Open') return 1
    if (b === 'Open') return -1
    return a.localeCompare(b)
  })
}

export function sortMembersByTotal(members) {
  return [...members].sort((a, b) => {
    const totalDiff = getMemberTotal(b) - getMemberTotal(a)
    if (totalDiff !== 0) return totalDiff

    const bodyweightA = getMemberTotalMeetBodyweight(a)
    const bodyweightB = getMemberTotalMeetBodyweight(b)
    if (bodyweightA != null && bodyweightB != null && bodyweightA !== bodyweightB) {
      return bodyweightA - bodyweightB
    }
    if (bodyweightA != null && bodyweightB == null) return -1
    if (bodyweightA == null && bodyweightB != null) return 1

    const lastNameDiff = a.member.last_name.localeCompare(b.member.last_name)
    if (lastNameDiff !== 0) return lastNameDiff

    return a.member.first_name.localeCompare(b.member.first_name)
  })
}

export function getMostRecentMeet(memberEntry) {
  const { equipment } = getMemberLifts(memberEntry)
  const meets = LIFTS.flatMap((lift) => {
    const entry = selectLiftEntry(memberEntry.best_lifts?.[lift], equipment)
    if (!entry?.meet_name || !entry?.achieved_date) return []
    return [{ meetName: entry.meet_name, date: entry.achieved_date }]
  })

  if (!meets.length) return null

  return meets.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
}

export function formatWeight(kg) {
  if (kg == null) return '—'
  return `${Number(kg).toFixed(1)} kg`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTvMeetLine(meetName, achievedDate) {
  if (!meetName) return ''

  if (!achievedDate) return meetName

  const parsed = new Date(`${achievedDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return meetName

  const formatted = parsed.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })

  return `${meetName} · ${formatted}`
}

export function isOplLinked(member) {
  return member.opl_match_status && member.opl_match_status !== 'no_profile'
}

export function isGymOnlyMember(member) {
  return member.opl_match_status === 'no_profile'
}

function hasMeetBodyweight(entry) {
  return entry?.is_meet_verified && entry?.bodyweight_kg != null
}

export function getMemberBodyweight(memberEntry) {
  const { lifts } = getMemberLifts(memberEntry)

  if (hasMeetBodyweight(lifts.total)) {
    return lifts.total.bodyweight_kg
  }

  const verifiedEntries = LIFTS.map((lift) => lifts[lift]).filter(hasMeetBodyweight)
  if (verifiedEntries.length) {
    return [...verifiedEntries].sort(
      (a, b) => new Date(b.achieved_date) - new Date(a.achieved_date),
    )[0].bodyweight_kg
  }

  return null
}
