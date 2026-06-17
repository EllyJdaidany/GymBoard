import { resolveBucketId } from '../config/weightClassBuckets'

const LIFTS = ['squat', 'bench', 'deadlift', 'total']

function bucketTags({ canonicalBucketId, meetRuleset, meetWeightClassKg }) {
  return {
    canonical_bucket_id: canonicalBucketId ?? null,
    meet_ruleset: meetRuleset ?? null,
    meet_weight_class_kg: meetWeightClassKg ?? null,
  }
}

function gymLift(weightKg, equipment = 'classic raw', context = {}) {
  return {
    weight_kg: weightKg,
    weight_lbs: Math.round(weightKg * 2.205 * 10) / 10,
    source: 'gym',
    equipment,
    achieved_date: '2025-11-12',
    meet_name: null,
    federation: null,
    is_meet_verified: false,
    bodyweight_kg: null,
    ...bucketTags(context),
  }
}

function meetLift(
  weightKg,
  {
    equipment = 'classic raw',
    meetName = 'Catalyst Open',
    date = '2025-09-14',
    federation = 'USAPL',
    bodyweightKg = null,
    canonicalBucketId = null,
    meetRuleset = null,
    meetWeightClassKg = null,
  } = {},
) {
  return {
    weight_kg: weightKg,
    weight_lbs: Math.round(weightKg * 2.205 * 10) / 10,
    source: 'opl',
    equipment,
    achieved_date: date,
    meet_name: meetName,
    federation,
    is_meet_verified: true,
    bodyweight_kg: bodyweightKg,
    ...bucketTags({
      canonicalBucketId,
      meetRuleset,
      meetWeightClassKg,
    }),
  }
}

function buildLifts({
  squat,
  bench,
  deadlift,
  equipment = 'classic raw',
  meet = true,
  bodyweightKg = null,
  canonicalBucketId = null,
  meetRuleset = null,
  meetWeightClassKg = null,
  meetName = 'Catalyst Open',
  date = '2025-09-14',
  federation = 'USAPL',
}) {
  const total = squat + bench + deadlift
  const context = {
    canonicalBucketId,
    meetRuleset,
    meetWeightClassKg,
  }

  if (meet) {
    const meetOpts = {
      equipment,
      bodyweightKg,
      meetName,
      date,
      federation,
      ...context,
    }
    return {
      squat: [meetLift(squat, meetOpts)],
      bench: [meetLift(bench, meetOpts)],
      deadlift: [meetLift(deadlift, meetOpts)],
      total: [meetLift(total, meetOpts)],
    }
  }

  return {
    squat: [gymLift(squat, equipment, context)],
    bench: [gymLift(bench, equipment, context)],
    deadlift: [gymLift(deadlift, equipment, context)],
    total: [gymLift(total, equipment, context)],
  }
}

function mergeLiftSets(...liftSets) {
  return LIFTS.reduce(
    (merged, lift) => {
      merged[lift] = liftSets.flatMap((set) => set[lift] ?? [])
      return merged
    },
    { squat: [], bench: [], deadlift: [], total: [] },
  )
}

function defaultWeighInKg(weightClassKg, id) {
  if (typeof weightClassKg !== 'number') return null
  const variation = (id.charCodeAt(1) % 6) * 0.1
  return Math.round((weightClassKg - 0.8 - variation) * 10) / 10
}

function member(id, first, last, weightClass, liftSpec, options = {}) {
  const resolved = typeof options === 'string' ? { oplStatus: options } : options
  const {
    oplStatus = 'auto_linked',
    sex = 'male',
    ruleset = 'traditional',
    federation = ruleset === 'modern' ? 'Powerlifting America' : 'USAPL',
    weighInKg,
  } = resolved

  const normalizedClass = String(weightClass).trim().toLowerCase().replace(/\s+/g, '')
  const weight_class_kg = normalizedClass.endsWith('+')
    ? normalizedClass
    : Number.parseFloat(normalizedClass.replace(/kg$/, ''))

  const isGymOnly = oplStatus === 'no_profile' || liftSpec.meet === false
  const bodyweightKg = isGymOnly
    ? null
    : (weighInKg ?? defaultWeighInKg(weight_class_kg, id))

  const canonicalBucketId = resolveBucketId(sex, ruleset, weight_class_kg)

  const lifts = buildLifts({
    ...liftSpec,
    bodyweightKg,
    canonicalBucketId,
    meetRuleset: ruleset,
    meetWeightClassKg: weight_class_kg,
    federation,
  })

  return {
    member: {
      id,
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      date_of_birth: '1992-04-18',
      weight_class: weightClass,
      weight_class_kg,
      sex,
      ruleset,
      federation,
      division: 'Open',
      opl_username: oplStatus === 'no_profile' ? null : `${first}${last}`.toLowerCase(),
      opl_match_status: oplStatus,
      opl_linked_at: oplStatus === 'no_profile' ? null : '2025-08-01T12:00:00Z',
      created_at: '2025-01-15T10:00:00Z',
    },
    best_lifts: lifts,
  }
}

function memberWithHistories(id, first, last, weightClass, histories, options = {}) {
  const resolved = typeof options === 'string' ? { oplStatus: options } : options
  const {
    oplStatus = 'auto_linked',
    sex = 'male',
    ruleset = 'traditional',
    federation = ruleset === 'modern' ? 'Powerlifting America' : 'USAPL',
  } = resolved

  const normalizedClass = String(weightClass).trim().toLowerCase().replace(/\s+/g, '')
  const weight_class_kg = normalizedClass.endsWith('+')
    ? normalizedClass
    : Number.parseFloat(normalizedClass.replace(/kg$/, ''))

  const liftSets = histories.map((history) =>
    buildLifts({
      squat: history.squat,
      bench: history.bench,
      deadlift: history.deadlift,
      equipment: history.equipment ?? 'classic raw',
      meet: history.meet ?? true,
      bodyweightKg: history.bodyweightKg ?? null,
      canonicalBucketId: history.bucketId,
      meetRuleset: history.ruleset,
      meetWeightClassKg: history.weightClassKg,
      meetName: history.meetName ?? 'Catalyst Open',
      date: history.date ?? '2025-09-14',
      federation: history.federation ?? federation,
    }),
  )

  return {
    member: {
      id,
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      date_of_birth: '1992-04-18',
      weight_class: weightClass,
      weight_class_kg,
      sex,
      ruleset,
      federation,
      division: 'Open',
      opl_username: oplStatus === 'no_profile' ? null : `${first}${last}`.toLowerCase(),
      opl_match_status: oplStatus,
      opl_linked_at: oplStatus === 'no_profile' ? null : '2025-08-01T12:00:00Z',
      created_at: '2025-01-15T10:00:00Z',
    },
    best_lifts: mergeLiftSets(...liftSets),
  }
}

export const mockPRBoard = [
  // 63 kg (modern) / 60 kg (traditional) — female 60/63kg board
  member('m01', 'Ava', 'Reeves', '63 kg', { squat: 142.5, bench: 82.5, deadlift: 175 }, { sex: 'female', ruleset: 'modern' }),
  member('m02', 'Lena', 'Cho', '63 kg', { squat: 137.5, bench: 77.5, deadlift: 167.5 }, { sex: 'female', ruleset: 'modern' }),
  member('m03', 'Mia', 'Santos', '63 kg', { squat: 132.5, bench: 75, deadlift: 160, meet: false }, { sex: 'female', ruleset: 'modern', oplStatus: 'no_profile' }),
  member('m04', 'Nora', 'Kim', '63 kg', { squat: 125, bench: 70, deadlift: 155, meet: false }, { sex: 'female', ruleset: 'modern', oplStatus: 'no_profile' }),
  member('m05', 'Zoe', 'Patel', '63 kg', { squat: 120, bench: 67.5, deadlift: 147.5 }, { sex: 'female', ruleset: 'modern' }),
  member('m06', 'Ivy', 'Nguyen', '63 kg', { squat: 115, bench: 65, deadlift: 142.5 }, { sex: 'female', ruleset: 'modern' }),
  member('m07', 'Ella', 'Brooks', '63 kg', { squat: 110, bench: 62.5, deadlift: 137.5 }, { sex: 'female', ruleset: 'modern' }),
  member('m08', 'Ruby', 'Hayes', '63 kg', { squat: 105, bench: 60, deadlift: 132.5 }, { sex: 'female', ruleset: 'modern' }),
  member('m09', 'Lily', 'Ford', '63 kg', { squat: 100, bench: 57.5, deadlift: 127.5 }, { sex: 'female', ruleset: 'modern' }),

  // 66 kg (modern) / 67.5 kg (traditional) — male 66/67.5kg board
  member('m10', 'James', 'Carter', '66 kg', { squat: 210, bench: 130, deadlift: 245 }, { ruleset: 'modern' }),
  member('m11', 'Ethan', 'Walsh', '66 kg', { squat: 202.5, bench: 125, deadlift: 237.5 }, { ruleset: 'modern' }),
  member('m12', 'Noah', 'Diaz', '66 kg', { squat: 195, bench: 120, deadlift: 230 }, { ruleset: 'modern' }),
  member('m13', 'Liam', 'Ortiz', '66 kg', { squat: 187.5, bench: 115, deadlift: 222.5 }, { ruleset: 'modern' }),
  member('m14', 'Owen', 'Reed', '66 kg', { squat: 180, bench: 110, deadlift: 215, meet: false }, { ruleset: 'modern', oplStatus: 'no_profile' }),
  member('m15', 'Caleb', 'Shaw', '66 kg', { squat: 172.5, bench: 105, deadlift: 207.5 }, { ruleset: 'modern' }),
  member('m16', 'Mason', 'Price', '66 kg', { squat: 165, bench: 100, deadlift: 200 }, { ruleset: 'modern' }),
  member('m17', 'Logan', 'Bryant', '66 kg', { squat: 157.5, bench: 95, deadlift: 192.5 }, { ruleset: 'modern' }),
  member('m18', 'Jack', 'Hughes', '66 kg', { squat: 150, bench: 90, deadlift: 185 }, { ruleset: 'modern' }),
  member('m19', 'Luke', 'Grant', '66 kg', { squat: 142.5, bench: 85, deadlift: 177.5 }, { ruleset: 'modern' }),

  // 74 kg (modern) / 75 kg (traditional) — male 74/75kg board
  member('m20', 'Marcus', 'Thorne', '74 kg', { squat: 245, bench: 155, deadlift: 285 }, { ruleset: 'modern' }),
  member('m21', 'Daniel', 'Mercer', '74 kg', { squat: 237.5, bench: 150, deadlift: 275 }, { ruleset: 'modern' }),
  member('m22', 'Ryan', 'Voss', '74 kg', { squat: 230, bench: 145, deadlift: 265 }, { ruleset: 'modern' }),
  member('m23', 'Tyler', 'Kane', '74 kg', { squat: 222.5, bench: 140, deadlift: 255 }, { ruleset: 'modern' }),
  member('m24', 'Brandon', 'Sloan', '74 kg', { squat: 215, bench: 135, deadlift: 245 }, { ruleset: 'modern' }),
  member('m25', 'Kevin', 'Marsh', '74 kg', { squat: 207.5, bench: 130, deadlift: 237.5 }, { ruleset: 'modern' }),
  member('m26', 'Chris', 'Dalton', '74 kg', { squat: 200, bench: 125, deadlift: 230 }, { ruleset: 'modern' }),
  member('m27', 'Alex', 'Pierce', '74 kg', { squat: 192.5, bench: 120, deadlift: 222.5 }, { ruleset: 'modern' }),
  member('m28', 'Jordan', 'Blake', '74 kg', { squat: 185, bench: 115, deadlift: 215 }, { ruleset: 'modern' }),
  member('m29', 'Derek', 'Frost', '74 kg', { squat: 177.5, bench: 110, deadlift: 207.5 }, { ruleset: 'modern' }),
  member('m30', 'Sean', 'Rowe', '74 kg', { squat: 170, bench: 105, deadlift: 200 }, { ruleset: 'modern' }),

  // 83 kg (modern) / 82.5 kg (traditional) — male 82.5/83kg board
  member(
    'm31',
    'Victor',
    'Hale',
    '83 kg',
    { squat: 280, bench: 185, deadlift: 320, equipment: 'equipped' },
    { ruleset: 'modern' },
  ),
  member('m32', 'Nathan', 'Cross', '83 kg', { squat: 265, bench: 170, deadlift: 300 }, { ruleset: 'modern' }),
  member('m33', 'Patrick', 'Lowe', '83 kg', { squat: 255, bench: 165, deadlift: 290 }, { ruleset: 'modern' }),
  member('m34', 'Eric', 'Vance', '83 kg', { squat: 245, bench: 160, deadlift: 280 }, { ruleset: 'modern' }),
  member('m35', 'Adam', 'Cole', '83 kg', { squat: 235, bench: 155, deadlift: 270 }, { ruleset: 'modern' }),
  member('m36', 'Brian', 'Wells', '83 kg', { squat: 225, bench: 150, deadlift: 260 }, { ruleset: 'modern' }),
  member('m37', 'Justin', 'Marsh', '83 kg', { squat: 215, bench: 145, deadlift: 250 }, { ruleset: 'modern' }),
  member('m38', 'Trevor', 'Nash', '83 kg', { squat: 205, bench: 140, deadlift: 240 }, { ruleset: 'modern' }),
  member('m39', 'Colin', 'Reed', '83 kg', { squat: 195, bench: 135, deadlift: 230 }, { ruleset: 'modern' }),
  member('m40', 'Grant', 'Silva', '83 kg', { squat: 185, bench: 130, deadlift: 220 }, { ruleset: 'modern' }),

  // Dual-bucket lifter — holds gym records in 90/93 and 100/105
  memberWithHistories(
    'm41',
    'AJ',
    'Mercer',
    '105 kg',
    [
      {
        bucketId: 'm-90-93',
        ruleset: 'traditional',
        weightClassKg: 90,
        squat: 320,
        bench: 270,
        deadlift: 320,
        bodyweightKg: 89.4,
        date: '2024-03-10',
        federation: 'USAPL',
        meetName: 'Catalyst Classic',
      },
      {
        bucketId: 'm-100-105',
        ruleset: 'modern',
        weightClassKg: 105,
        squat: 350,
        bench: 290,
        deadlift: 310,
        bodyweightKg: 103.6,
        date: '2025-09-14',
        federation: 'Powerlifting America',
      },
    ],
    { ruleset: 'modern' },
  ),
]
