import { formatTvMeetLine } from './boardUtils'

export default function TVMeetLabel({ meetName, achievedDate, className = '' }) {
  const line = formatTvMeetLine(meetName, achievedDate)
  if (!line) return null

  return (
    <p className={['truncate text-catalyst-text/45', className].filter(Boolean).join(' ')}>
      {line}
    </p>
  )
}
