import { useEffect, useState } from 'react'
import Loading from '../shared/Loading'
import { adminApi } from '../../services/adminApi'
import { getOplProfileUrl } from '../../utils/oplProfile'

function OplCandidateRow({ candidate, submitting, onLink }) {
  const profileUrl = getOplProfileUrl(candidate.username)

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-100">{candidate.name}</p>
        <p className="text-sm text-slate-400">@{candidate.username}</p>
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-violet-300 hover:text-violet-200"
          >
            View on OpenPowerlifting
          </a>
        ) : null}
      </div>
      <button
        type="button"
        disabled={submitting}
        onClick={() => onLink(candidate.username)}
        className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Link
      </button>
    </li>
  )
}

export default function LinkOplModal({ member, onClose, onResolved }) {
  const [candidates, setCandidates] = useState([])
  const [manualInput, setManualInput] = useState(member.opl_username || '')
  const [preview, setPreview] = useState(null)
  const [lookupCandidates, setLookupCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [lookingUp, setLookingUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const inputId = `opl-profile-input-${member.id}`

  useEffect(() => {
    let cancelled = false

    async function loadCandidates() {
      setLoading(true)
      setError(null)
      try {
        const results = await adminApi.getMemberCandidates(member.id)
        if (!cancelled) setCandidates(results)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load candidates')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCandidates()
    return () => {
      cancelled = true
    }
  }, [member.id])

  async function handleLookup() {
    const query = manualInput.trim()
    if (!query) return

    setLookingUp(true)
    setError(null)
    setPreview(null)
    setLookupCandidates([])

    try {
      const result = await adminApi.lookupOplProfile(query)
      if (result.profile) {
        setPreview(result.profile)
        setManualInput(result.profile.username)
      } else if (result.candidates?.length) {
        setLookupCandidates(result.candidates)
        setError(result.error || 'Multiple profiles match — pick one below')
      } else {
        setError(result.error || 'No OPL profile found')
      }
    } catch (err) {
      setError(err.message || 'Failed to look up profile')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleResolve(username) {
    setSubmitting(true)
    setError(null)
    try {
      await adminApi.resolveMember(member.id, username)
      onResolved()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to link OPL profile')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnlink() {
    const username = member.opl_username
    if (!username) return

    const confirmed = window.confirm(
      `Unlink @${username} from ${member.first_name} ${member.last_name}? Meet data synced from OPL will be removed from their PR board.`,
    )
    if (!confirmed) return

    setSubmitting(true)
    setError(null)
    try {
      await adminApi.unlinkMember(member.id)
      onResolved()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to unlink OPL profile')
    } finally {
      setSubmitting(false)
    }
  }

  const linkedProfileUrl = getOplProfileUrl(member.opl_username)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Link OPL profile</h2>
            <p className="mt-1 text-sm text-slate-400">
              {member.first_name} {member.last_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            Close
          </button>
        </div>

        {member.opl_username ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
            <div>
              <p className="text-sm text-slate-400">Currently linked</p>
              <p className="font-medium text-slate-100">@{member.opl_username}</p>
              {linkedProfileUrl ? (
                <a
                  href={linkedProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-violet-300 hover:text-violet-200"
                >
                  View on OpenPowerlifting
                </a>
              ) : null}
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleUnlink}
              className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
            >
              Unlink
            </button>
          </div>
        ) : null}

        <div className="mb-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
          <label className="block text-sm font-medium text-slate-200" htmlFor={inputId}>
            Enter OPL profile manually
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Use the OPL slug (e.g. <span className="text-slate-300">stevenzhao1</span>) or the full
            display name (e.g. <span className="text-slate-300">Steven Zhao #1</span>).
          </p>
          <div className="mt-3 flex gap-2">
            <input
              id={inputId}
              type="text"
              value={manualInput}
              onChange={(event) => {
                setManualInput(event.target.value)
                setPreview(null)
                setLookupCandidates([])
              }}
              placeholder="stevenzhao1 or Steven Zhao #1"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              disabled={lookingUp || !manualInput.trim()}
              onClick={handleLookup}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              {lookingUp ? 'Checking...' : 'Preview'}
            </button>
            <button
              type="button"
              disabled={submitting || !manualInput.trim()}
              onClick={() => handleResolve(manualInput)}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              Link
            </button>
          </div>

          {preview ? (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <p className="font-medium">{preview.name}</p>
              <p className="text-emerald-200/80">@{preview.username}</p>
              {preview.total_entries != null ? (
                <p className="mt-1 text-xs text-emerald-200/70">
                  {preview.total_entries} meet{preview.total_entries === 1 ? '' : 's'}
                  {preview.last_meet ? ` · last meet ${preview.last_meet}` : ''}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

        {lookupCandidates.length > 0 ? (
          <div className="mb-6">
            <p className="mb-2 text-sm text-slate-400">Matching profiles</p>
            <ul className="space-y-2">
              {lookupCandidates.map((candidate) => (
                <OplCandidateRow
                  key={candidate.username}
                  candidate={candidate}
                  submitting={submitting}
                  onLink={handleResolve}
                />
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium text-slate-300">Suggested matches</p>
          {loading ? <Loading label="Loading candidates..." /> : null}

          {!loading && candidates.length === 0 ? (
            <p className="text-sm text-slate-400">No suggested matches from the member name.</p>
          ) : null}

          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {candidates.map((candidate) => (
              <OplCandidateRow
                key={candidate.username}
                candidate={candidate}
                submitting={submitting}
                onLink={handleResolve}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
