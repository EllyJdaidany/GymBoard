/**
 * Canonical weight-class buckets for the PR board.
 *
 * - traditional: USAPL-shaped classes (USAPL, USPA, APF, PLU, most niche feds)
 * - modern: Powerlifting America-shaped classes (OPL federation tag: AMP)
 *
 * Each federation-specific class maps to exactly one bucket.
 */

export const RULESETS = ['traditional', 'modern']

// Powerlifting America uses modern weight classes. OPL tags those meets as "AMP".
export const POWERLIFTING_AMERICA_ALIASES = new Set([
  'powerlifting america',
  'pla',
  'pa',
  'amp',
])

const MODERN_FEDERATION_ALIASES = POWERLIFTING_AMERICA_ALIASES

const FEDERATION_DISPLAY_NAMES = {
  amp: 'Powerlifting America',
  pla: 'Powerlifting America',
  pa: 'Powerlifting America',
}

/** @type {Array<{
 *   id: string,
 *   sex: Array<'female' | 'male' | 'mx'>,
 *   display: string,
 *   sortOrder: number,
 *   traditional: Array<number | string>,
 *   modern: Array<number | string>,
 * }>} */
export const WEIGHT_CLASS_BUCKETS = [
  // Women
  { id: 'f-44', sex: ['female'], display: '44kg', sortOrder: 10, traditional: [44], modern: [] },
  { id: 'f-48', sex: ['female'], display: '48kg', sortOrder: 20, traditional: [48], modern: [] },
  { id: 'f-52', sex: ['female'], display: '52kg', sortOrder: 30, traditional: [52], modern: [52] },
  {
    id: 'f-56-57',
    sex: ['female'],
    display: '56/57kg',
    sortOrder: 40,
    traditional: [56],
    modern: [57],
  },
  {
    id: 'f-60-63',
    sex: ['female'],
    display: '60/63kg',
    sortOrder: 50,
    traditional: [60],
    modern: [63],
  },
  { id: 'f-65', sex: ['female'], display: '65kg', sortOrder: 60, traditional: [65], modern: [] },
  {
    id: 'f-69-70',
    sex: ['female'],
    display: '69/70kg',
    sortOrder: 70,
    traditional: [70],
    modern: [69],
  },
  {
    id: 'f-75-76',
    sex: ['female'],
    display: '75/76kg',
    sortOrder: 80,
    traditional: [75],
    modern: [76],
  },
  {
    id: 'f-82.5-84',
    sex: ['female'],
    display: '82.5/84kg',
    sortOrder: 90,
    traditional: [82.5],
    modern: [84],
  },
  { id: 'f-90', sex: ['female'], display: '90kg', sortOrder: 100, traditional: [90], modern: [] },
  {
    id: 'f-superheavy',
    sex: ['female'],
    display: '84+/100+kg',
    sortOrder: 110,
    traditional: [100, '100+'],
    modern: ['84+'],
  },

  // Men / Mx
  { id: 'm-52', sex: ['male', 'mx'], display: '52kg', sortOrder: 10, traditional: [52], modern: [] },
  { id: 'm-56', sex: ['male', 'mx'], display: '56kg', sortOrder: 20, traditional: [56], modern: [] },
  { id: 'm-60', sex: ['male', 'mx'], display: '60kg', sortOrder: 30, traditional: [60], modern: [] },
  {
    id: 'm-66-67.5',
    sex: ['male', 'mx'],
    display: '66/67.5kg',
    sortOrder: 40,
    traditional: [67.5],
    modern: [66],
  },
  {
    id: 'm-74-75',
    sex: ['male', 'mx'],
    display: '74/75kg',
    sortOrder: 50,
    traditional: [75],
    modern: [74],
  },
  {
    id: 'm-82.5-83',
    sex: ['male', 'mx'],
    display: '82.5/83kg',
    sortOrder: 60,
    traditional: [82.5],
    modern: [83],
  },
  {
    id: 'm-90-93',
    sex: ['male', 'mx'],
    display: '90/93kg',
    sortOrder: 70,
    traditional: [90],
    modern: [93],
  },
  {
    id: 'm-100-105',
    sex: ['male', 'mx'],
    display: '100/105kg',
    sortOrder: 80,
    traditional: [100],
    modern: [105],
  },
  { id: 'm-110', sex: ['male', 'mx'], display: '110kg', sortOrder: 90, traditional: [110], modern: [] },
  {
    id: 'm-120-125',
    sex: ['male', 'mx'],
    display: '120/125kg',
    sortOrder: 100,
    traditional: [125],
    modern: [120],
  },
  {
    id: 'm-superheavy',
    sex: ['male', 'mx'],
    display: '120+/140+kg',
    sortOrder: 110,
    traditional: [140, '140+'],
    modern: ['120+'],
  },
]

const BUCKET_BY_ID = Object.fromEntries(WEIGHT_CLASS_BUCKETS.map((bucket) => [bucket.id, bucket]))

const CLASS_LOOKUP = new Map()

for (const bucket of WEIGHT_CLASS_BUCKETS) {
  for (const sex of bucket.sex) {
    for (const ruleset of RULESETS) {
      for (const classToken of bucket[ruleset]) {
        const key = `${sex}|${ruleset}|${normalizeClassToken(classToken)}`
        CLASS_LOOKUP.set(key, bucket.id)
      }
    }
  }
}

export function normalizeClassToken(value) {
  if (value === null || value === undefined || value === '') return null

  const trimmed = String(value).trim().toLowerCase().replace(/\s+/g, '')
  if (!trimmed) return null
  if (trimmed.endsWith('+')) return trimmed

  const numeric = Number.parseFloat(trimmed.replace(/kg$/, ''))
  return Number.isNaN(numeric) ? null : numeric
}

export function parseMemberWeightClass(member) {
  if (member.weight_class_kg != null) {
    return normalizeClassToken(member.weight_class_kg)
  }
  return normalizeClassToken(member.weight_class)
}

export function normalizeFederationName(federation) {
  const raw = String(federation ?? '').trim()
  if (!raw) return null
  return FEDERATION_DISPLAY_NAMES[raw.toLowerCase()] ?? raw
}

export function getRulesetFromFederation(federation) {
  const normalized = String(federation ?? '')
    .trim()
    .toLowerCase()

  if (MODERN_FEDERATION_ALIASES.has(normalized)) return 'modern'
  return 'traditional'
}

export function getMemberRuleset(member) {
  if (member.ruleset === 'traditional' || member.ruleset === 'modern') {
    return member.ruleset
  }
  return getRulesetFromFederation(member.federation)
}

export function resolveBucketId(sex, ruleset, classToken) {
  const normalizedClass = normalizeClassToken(classToken)
  if (!sex || !ruleset || normalizedClass == null) return null
  return CLASS_LOOKUP.get(`${sex}|${ruleset}|${normalizedClass}`) ?? null
}

export function resolveBucketIdWithFallback(sex, ruleset, classToken) {
  if (!sex) return { bucketId: null, ruleset }

  const preferred = ruleset === 'modern' || ruleset === 'traditional' ? ruleset : 'traditional'
  let bucketId = resolveBucketId(sex, preferred, classToken)
  if (bucketId) return { bucketId, ruleset: preferred }

  const alternate = preferred === 'traditional' ? 'modern' : 'traditional'
  bucketId = resolveBucketId(sex, alternate, classToken)
  if (bucketId) return { bucketId, ruleset: alternate }

  return { bucketId: null, ruleset: preferred }
}

export function getBucketById(bucketId) {
  return BUCKET_BY_ID[bucketId] ?? null
}

const SUPERHEAVY_BUCKET_BY_SEX = {
  female: 'f-superheavy',
  male: 'm-superheavy',
  mx: 'm-superheavy',
}

export function getBucketWeightLimitKg(bucketId, ruleset) {
  if (!bucketId || String(bucketId).endsWith('-superheavy')) return null

  const bucket = BUCKET_BY_ID[bucketId]
  if (!bucket || (ruleset !== 'traditional' && ruleset !== 'modern')) return null

  const numericLimits = (bucket[ruleset] ?? [])
    .map((token) => normalizeClassToken(token))
    .filter((token) => typeof token === 'number')

  if (!numericLimits.length) return null
  return Math.max(...numericLimits)
}

export function adjustBucketForBodyweight(bucketId, ruleset, bodyweightKg, sex) {
  if (!bucketId || bodyweightKg == null || bodyweightKg <= 0 || !sex) return bucketId

  const limit = getBucketWeightLimitKg(bucketId, ruleset)
  if (limit == null || bodyweightKg <= limit) return bucketId

  return SUPERHEAVY_BUCKET_BY_SEX[sex] ?? bucketId
}

export function resolveMeetBucketIdWithFallback(sex, ruleset, classToken, bodyweightKg = null) {
  const resolved = resolveBucketIdWithFallback(sex, ruleset, classToken)
  if (!resolved.bucketId) return resolved

  return {
    bucketId: adjustBucketForBodyweight(
      resolved.bucketId,
      resolved.ruleset,
      bodyweightKg,
      sex,
    ),
    ruleset: resolved.ruleset,
  }
}

export function formatBucketLabel(sex, bucket) {
  const sexLabels = {
    female: 'Female',
    male: 'Male',
    mx: 'Mx',
  }
  const sexLabel = sexLabels[sex]
  return sexLabel ? `${sexLabel} ${bucket.display}` : bucket.display
}

const TRADITIONAL_OPEN_CLASS_KG = {
  '100+': 100,
  '140+': 140,
  '84+': 84,
  '120+': 120,
}

export function getTraditionalBucketClassKg(bucket) {
  const token = bucket.traditional[0]
  if (typeof token === 'number') return token
  const parsed = Number.parseFloat(String(token))
  return TRADITIONAL_OPEN_CLASS_KG[token] ?? (Number.isFinite(parsed) ? parsed : null)
}

export function getTraditionalWeightClassOptions(sex) {
  if (!sex) return []
  return WEIGHT_CLASS_BUCKETS.filter((bucket) => bucket.sex.includes(sex))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((bucket) => ({
      label: bucket.display,
      weightClassKg: getTraditionalBucketClassKg(bucket),
    }))
    .filter((option) => option.weightClassKg != null)
}
