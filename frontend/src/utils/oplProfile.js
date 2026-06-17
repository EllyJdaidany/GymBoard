const OPL_PROFILE_BASE_URL = 'https://www.openpowerlifting.org'

export function getOplProfileUrl(username) {
  const slug = String(username || '').trim().replace(/^@/, '')
  if (!slug) return null
  return `${OPL_PROFILE_BASE_URL}/u/${encodeURIComponent(slug)}`
}
