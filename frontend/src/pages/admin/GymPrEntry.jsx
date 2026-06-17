import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import Loading from '../../components/shared/Loading'
import WeightUnitToggle from '../../components/admin/WeightUnitToggle'
import { adminApi } from '../../services/adminApi'
import {
  buildGymPrPayload,
  convertGymPrFormUnits,
  EMPTY_GYM_PR_FORM,
  formatLiftKg,
  GYM_PR_LIFT_FIELD_LABELS,
  gymPrEntryToForm,
} from '../../utils/gymPrForm'

export default function GymPrEntry() {
  const [form, setForm] = useState(EMPTY_GYM_PR_FORM)
  const [weightUnit, setWeightUnit] = useState('kg')
  const [memberId, setMemberId] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [savedMembers, setSavedMembers] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const isEditing = memberId != null

  const loadSavedMembers = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const data = await adminApi.getGymPrs()
      setSavedMembers(data.members || [])
    } catch (err) {
      setListError(err.message || 'Failed to load saved gym PRs')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadSavedMembers()
  }, [loadSavedMembers])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError(null)
    setSuccessMessage(null)
    if (!isEditing && (field === 'firstName' || field === 'lastName')) {
      setMemberId(null)
      setCandidates([])
    }
  }

  function handleUnitChange(nextUnit) {
    if (nextUnit === weightUnit) return
    setForm((current) => convertGymPrFormUnits(current, weightUnit, nextUnit))
    setWeightUnit(nextUnit)
    setError(null)
    setSuccessMessage(null)
  }

  function resetForm() {
    setForm(EMPTY_GYM_PR_FORM)
    setWeightUnit('kg')
    setMemberId(null)
    setCandidates([])
    setError(null)
    setSuccessMessage(null)
  }

  function startEdit(entry) {
    setForm(gymPrEntryToForm(entry))
    setWeightUnit('kg')
    setMemberId(entry.member_id)
    setCandidates([])
    setError(null)
    setSuccessMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function buildPayload(selectedMemberId = memberId) {
    return buildGymPrPayload(form, weightUnit, selectedMemberId)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)
    setCandidates([])

    try {
      const result = await adminApi.upsertGymPrs(buildPayload())
      const memberLabel = `${form.firstName.trim()} ${form.lastName.trim()}`
      const createdNote = result.member_created ? ' New member created.' : ''
      setSuccessMessage(
        `Saved gym PRs for ${memberLabel}. Updated ${result.prs_updated} lift${result.prs_updated === 1 ? '' : 's'} on the PR board.${createdNote}`,
      )
      setMemberId(result.member_id)
      await loadSavedMembers()
    } catch (err) {
      if (err.candidates?.length) {
        setCandidates(err.candidates)
        setError(err.message || 'Multiple members match that name')
      } else {
        setError(err.message || 'Failed to save gym PRs')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSelectCandidate(candidateId) {
    setMemberId(candidateId)
    setCandidates([])
    setError(null)
    setSubmitting(true)

    try {
      const result = await adminApi.upsertGymPrs(buildPayload(candidateId))
      const memberLabel = `${form.firstName.trim()} ${form.lastName.trim()}`
      setSuccessMessage(
        `Saved gym PRs for ${memberLabel}. Updated ${result.prs_updated} lift${result.prs_updated === 1 ? '' : 's'} on the PR board.`,
      )
      await loadSavedMembers()
    } catch (err) {
      setError(err.message || 'Failed to save gym PRs')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={isEditing ? 'Edit gym PRs' : 'Enter gym PRs'}
        subtitle="Log in-gym personal records for the weight-class PR board. These do not affect DOTS leaderboards."
      />

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        <div className="flex justify-end">
          <WeightUnitToggle unit={weightUnit} onChange={handleUnitChange} />
        </div>

        {isEditing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-3">
            <p className="text-sm text-violet-100">
              Editing {form.firstName} {form.lastName}
            </p>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              New entry
            </button>
          </div>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Member</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="gym-first-name">
                First name
              </label>
              <input
                id="gym-first-name"
                type="text"
                required
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="gym-last-name">
                Last name
              </label>
              <input
                id="gym-last-name"
                type="text"
                required
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="gym-sex">
                Gender
              </label>
              <select
                id="gym-sex"
                required
                value={form.sex}
                onChange={(event) => updateField('sex', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="mx">Mx</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="gym-weight-class">
                Weight class ({weightUnit})
              </label>
              <input
                id="gym-weight-class"
                type="number"
                required
                min="1"
                step={weightUnit === 'lbs' ? '1' : '0.5'}
                value={form.weightClassKg}
                onChange={(event) => updateField('weightClassKg', event.target.value)}
                placeholder={weightUnit === 'lbs' ? 'e.g. 183' : 'e.g. 83'}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Used to place the lifter on the correct weight-class board. Saved as kg.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Gym PRs ({weightUnit})
          </h2>
          <p className="text-sm text-slate-400">
            {isEditing
              ? 'Update lift values below. Clear a field to remove that gym PR.'
              : 'Enter at least one lift. Leave blank any lift you do not want to save.'}{' '}
            Values are saved as kg.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {GYM_PR_LIFT_FIELD_LABELS.map(([field, label]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-200" htmlFor={`gym-${field}`}>
                  {label}
                </label>
                <input
                  id={`gym-${field}`}
                  type="number"
                  min="0"
                  step={weightUnit === 'lbs' ? '1' : '0.5'}
                  value={form[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            ))}
          </div>
        </section>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-300">{successMessage}</p> : null}

        {candidates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Select the member to update:</p>
            <ul className="space-y-2">
              {candidates.map((candidate) => (
                <li
                  key={candidate.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-100">
                      {candidate.first_name} {candidate.last_name}
                    </p>
                    {candidate.email ? (
                      <p className="text-sm text-slate-400">{candidate.email}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSelectCandidate(candidate.id)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                  >
                    Use this member
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Save gym PRs'}
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
          ) : null}
          <Link to="/" className="text-sm text-violet-300 hover:text-violet-200">
            View PR board
          </Link>
        </div>
      </form>

      <section className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-100">Saved gym PRs</h2>
          <p className="mt-1 text-sm text-slate-400">
            Members with gym PRs on the board. Click Edit to update their lifts.
          </p>
        </div>

        {loadingList ? (
          <div className="px-6 py-8">
            <Loading label="Loading saved gym PRs..." />
          </div>
        ) : listError ? (
          <p className="px-6 py-8 text-sm text-rose-300">{listError}</p>
        ) : savedMembers.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400">No gym PRs saved yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Member</th>
                  <th className="px-6 py-3 font-medium">Class</th>
                  <th className="px-6 py-3 font-medium">Squat</th>
                  <th className="px-6 py-3 font-medium">Bench</th>
                  <th className="px-6 py-3 font-medium">Deadlift</th>
                  <th className="px-6 py-3 font-medium">Total</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedMembers.map((entry) => (
                  <tr
                    key={entry.member_id}
                    className={[
                      'border-b border-slate-800/80 last:border-b-0',
                      entry.member_id === memberId ? 'bg-violet-500/5' : '',
                    ].join(' ')}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-100">
                        {entry.first_name} {entry.last_name}
                      </p>
                      {entry.email ? (
                        <p className="text-xs text-slate-500">{entry.email}</p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {entry.weight_class_kg != null ? `${entry.weight_class_kg} kg` : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{formatLiftKg(entry.squat_kg)}</td>
                    <td className="px-6 py-4 text-slate-300">{formatLiftKg(entry.bench_kg)}</td>
                    <td className="px-6 py-4 text-slate-300">{formatLiftKg(entry.deadlift_kg)}</td>
                    <td className="px-6 py-4 text-slate-300">{formatLiftKg(entry.total_kg)}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
