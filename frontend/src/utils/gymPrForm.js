import { convertDisplayWeight, parseWeightForSave } from './weightUnits'

export const GYM_PR_LIFT_FIELDS = ['squatKg', 'benchKg', 'deadliftKg', 'totalKg']

export const GYM_PR_LIFT_FIELD_LABELS = [
  ['squatKg', 'Squat'],
  ['benchKg', 'Bench'],
  ['deadliftKg', 'Deadlift'],
  ['totalKg', 'Total'],
]

export const EMPTY_GYM_PR_FORM = {
  firstName: '',
  lastName: '',
  sex: '',
  weightClassKg: '',
  squatKg: '',
  benchKg: '',
  deadliftKg: '',
  totalKg: '',
}

export function gymPrEntryToForm(entry) {
  return {
    firstName: entry?.first_name ?? '',
    lastName: entry?.last_name ?? '',
    sex: entry?.sex ?? '',
    weightClassKg: entry?.weight_class_kg != null ? String(entry.weight_class_kg) : '',
    squatKg: entry?.squat_kg != null ? String(entry.squat_kg) : '',
    benchKg: entry?.bench_kg != null ? String(entry.bench_kg) : '',
    deadliftKg: entry?.deadlift_kg != null ? String(entry.deadlift_kg) : '',
    totalKg: entry?.total_kg != null ? String(entry.total_kg) : '',
  }
}

export function formatLiftKg(value) {
  if (value == null || value === '') return '—'
  return `${value} kg`
}

export function convertGymPrFormUnits(form, fromUnit, toUnit) {
  if (fromUnit === toUnit) return form
  const next = convertGymPrLiftFields(form, fromUnit, toUnit)
  next.weightClassKg = convertDisplayWeight(form.weightClassKg, fromUnit, toUnit)
  return next
}

export function convertGymPrLiftFields(form, fromUnit, toUnit) {
  if (fromUnit === toUnit) return form
  const next = { ...form }
  for (const field of GYM_PR_LIFT_FIELDS) {
    next[field] = convertDisplayWeight(form[field], fromUnit, toUnit)
  }
  return next
}

export function parseDisplayWeight(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function buildGymPrPayload(form, unit, memberId = null, options = {}) {
  const weightClassUnit = options.weightClassUnit ?? unit
  const payload = {
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    sex: form.sex,
    weight_class_kg: parseWeightForSave(form.weightClassKg, weightClassUnit),
    squat_kg: parseWeightForSave(form.squatKg, unit),
    bench_kg: parseWeightForSave(form.benchKg, unit),
    deadlift_kg: parseWeightForSave(form.deadliftKg, unit),
    total_kg: parseWeightForSave(form.totalKg, unit),
  }

  if (memberId) {
    payload.member_id = memberId
  }

  return payload
}

export function hasGymPrLift(form) {
  return GYM_PR_LIFT_FIELDS.some((field) => parseDisplayWeight(form[field]) != null)
}

export function computeSuggestedGymPrTotal(form) {
  const squat = parseDisplayWeight(form.squatKg)
  const bench = parseDisplayWeight(form.benchKg)
  const deadlift = parseDisplayWeight(form.deadliftKg)
  if (squat == null || bench == null || deadlift == null) return ''
  return String(squat + bench + deadlift)
}
