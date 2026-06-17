import { useState } from 'react'
import { adminApi } from '../../services/adminApi'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  opl: '',
  email: '',
  sex: '',
  dateOfBirth: '',
}

export default function AddMemberModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [preview, setPreview] = useState(null)
  const [lookupCandidates, setLookupCandidates] = useState([])
  const [lookingUp, setLookingUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setPreview(null)
    setLookupCandidates([])
    setError(null)
    setSuccessMessage(null)
  }

  async function handlePreview() {
    const query = form.opl.trim()
    if (!query) return

    setLookingUp(true)
    setError(null)
    setPreview(null)
    setLookupCandidates([])

    try {
      const result = await adminApi.lookupOplProfile(query)
      if (result.profile) {
        setPreview(result.profile)
        setForm((current) => ({ ...current, opl: result.profile.username }))
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

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    const payload = {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      opl: form.opl.trim(),
    }

    if (form.email.trim()) payload.email = form.email.trim()
    if (form.sex) payload.sex = form.sex
    if (form.dateOfBirth) payload.date_of_birth = form.dateOfBirth

    try {
      const result = await adminApi.createMember(payload)
      const syncNote =
        result.sync?.status === 'success'
          ? ' Meet data synced.'
          : ' Member created, but meet sync did not return new PRs.'
      setSuccessMessage(
        `Added ${result.member.first_name} ${result.member.last_name} as @${result.member.opl_username}.${syncNote}`,
      )
      onCreated(result)
      setTimeout(() => onClose(), 1200)
    } catch (err) {
      if (err.candidates?.length) {
        setLookupCandidates(err.candidates)
        setError(err.message || 'Multiple OPL profiles match that input')
      } else {
        setError(err.message || 'Failed to add member')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Add member manually</h2>
            <p className="mt-1 text-sm text-slate-400">
              Create a lifter with their name and OPL profile. Email is optional — a placeholder is
              generated if you leave it blank.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="add-first-name">
                First name
              </label>
              <input
                id="add-first-name"
                type="text"
                required
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="add-last-name">
                Last name
              </label>
              <input
                id="add-last-name"
                type="text"
                required
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="add-opl">
              OPL profile
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Slug (e.g. <span className="text-slate-300">stevenzhao1</span>) or display name.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                id="add-opl"
                type="text"
                required
                value={form.opl}
                onChange={(event) => updateField('opl', event.target.value)}
                placeholder="stevenzhao1 or Steven Zhao #1"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <button
                type="button"
                disabled={lookingUp || !form.opl.trim()}
                onClick={handlePreview}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                {lookingUp ? 'Checking...' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                <p className="font-medium">{preview.name}</p>
                <p className="text-emerald-200/80">@{preview.username}</p>
              </div>
            ) : null}
          </div>

          <details className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">
              Optional details
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-300" htmlFor="add-email">
                  Email
                </label>
                <input
                  id="add-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-slate-300" htmlFor="add-sex">
                    Sex
                  </label>
                  <select
                    id="add-sex"
                    value={form.sex}
                    onChange={(event) => updateField('sex', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="">Infer from OPL on sync</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="mx">Mx</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300" htmlFor="add-dob">
                    Date of birth
                  </label>
                  <input
                    id="add-dob"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) => updateField('dateOfBirth', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>
            </div>
          </details>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-300">{successMessage}</p> : null}

          {lookupCandidates.length > 0 ? (
            <ul className="space-y-2">
              {lookupCandidates.map((candidate) => (
                <li
                  key={candidate.username}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-100">{candidate.name}</p>
                    <p className="text-sm text-slate-400">@{candidate.username}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((current) => ({ ...current, opl: candidate.username }))
                      setLookupCandidates([])
                      setError(null)
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.firstName.trim() || !form.lastName.trim() || !form.opl.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {submitting ? 'Adding...' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
