function capitalizeSegment(segment) {
  if (!segment) return segment
  if (segment.length === 1) return segment.toUpperCase()
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
}

function capitalizeWord(word) {
  return word
    .split(/([-'])/)
    .map((part) => (part === '-' || part === "'" ? part : capitalizeSegment(part)))
    .join('')
}

export function formatNamePart(name) {
  if (name == null) return ''
  const trimmed = String(name).trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return trimmed.split(' ').map(capitalizeWord).join(' ')
}

export function formatMemberName(member) {
  if (!member) return ''
  const first = formatNamePart(member.first_name)
  const last = formatNamePart(member.last_name)
  return [first, last].filter(Boolean).join(' ')
}

export function normalizeMember(member) {
  if (!member) return member
  return {
    ...member,
    first_name: formatNamePart(member.first_name),
    last_name: formatNamePart(member.last_name),
  }
}

export function normalizeMemberEntry(entry) {
  if (!entry?.member) return entry
  return {
    ...entry,
    member: normalizeMember(entry.member),
  }
}

export function normalizeDotsEntry(entry) {
  return normalizeMemberEntry(entry)
}

export function normalizeMemberEntries(entries = []) {
  return entries.map(normalizeMemberEntry)
}

export function normalizeDotsEntries(entries = []) {
  return entries.map(normalizeDotsEntry)
}
