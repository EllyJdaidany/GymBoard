const KG_TO_LBS = 2.2046226218
const LBS_TO_KG = 1 / KG_TO_LBS

function kgToLbs(kg) {
  return Math.round(kg * KG_TO_LBS * 10) / 10
}

function lbsToKg(lbs) {
  return Math.round(lbs * LBS_TO_KG * 100) / 100
}

export function convertDisplayWeight(value, fromUnit, toUnit) {
  const parsed = Number.parseFloat(String(value ?? '').trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return value
  if (fromUnit === toUnit) return String(parsed)
  const converted = fromUnit === 'kg' ? kgToLbs(parsed) : lbsToKg(parsed)
  return String(converted)
}

export function parseWeightForSave(value, unit) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  const kg = unit === 'lbs' ? lbsToKg(parsed) : parsed
  return Math.round(kg * 100) / 100
}
