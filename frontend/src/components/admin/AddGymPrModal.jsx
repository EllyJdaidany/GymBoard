import { useEffect, useMemo, useState } from 'react'
import { getTraditionalWeightClassOptions } from '../../config/weightClassBuckets'
import WeightUnitToggle from './WeightUnitToggle'
import { adminApi } from '../../services/adminApi'
import {
  buildGymPrPayload,
  computeSuggestedGymPrTotal,
  convertGymPrLiftFields,
  EMPTY_GYM_PR_FORM,
  GYM_PR_LIFT_FIELD_LABELS,
  gymPrEntryToForm,
  hasGymPrLift,
} from '../../utils/gymPrForm'

export default function AddGymPrModal({ onClose, onCreated, editMember = null }) {
  const [form, setForm] = useState(EMPTY_GYM_PR_FORM)
  const [weightUnit, setWeightUnit] = useState('kg')
  const [totalTouched, setTotalTouched] = useState(false)
  const [memberId, setMemberId] = useState(editMember?.id ?? null)
  const [loadingEntry, setLoadingEntry] = useState(Boolean(editMember?.id))
  const [memberCandidates, setMemberCandidates] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const isEditing = memberId != null

  useEffect(() => {
    if (!editMember?.id) return undefined

    let cancelled = false
    setLoadingEntry(true)
    setError(null)

    adminApi
      .getGymPr(editMember.id)
      .then((entry) => {
        if (cancelled) return
        setForm(gymPrEntryToForm(entry))
        setMemberId(entry.member_id)
        setWeightUnit('kg')
        setTotalTouched(true)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 404) {
          setForm({
            ...EMPTY_GYM_PR_FORM,
            firstName: editMember.first_name ?? '',
            lastName: editMember.last_name ?? '',
            sex: editMember.sex ?? '',
            weightClassKg:
              editMember.weight_class_kg != null ? String(editMember.weight_class_kg) : '',
          })
          setMemberId(editMember.id)
        } else {
          setError(err.message || 'Failed to load gym PRs')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEntry(false)
      })

    return () => {
      cancelled = true
    }
  }, [editMember])

  const weightClassOptions = useMemo(
    () => getTraditionalWeightClassOptions(form.sex),
    [form.sex],
  )

  function handleUnitChange(nextUnit) {
    if (nextUnit === weightUnit) return
    setForm((current) => convertGymPrLiftFields(current, weightUnit, nextUnit))
    setWeightUnit(nextUnit)
    setError(null)
    setSuccessMessage(null)
  }

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (!totalTouched && ['squatKg', 'benchKg', 'deadliftKg'].includes(field)) {
        next.totalKg = computeSuggestedGymPrTotal(next)
      }
      return next
    })
    setMemberCandidates([])
    setError(null)
    setSuccessMessage(null)
    if (field === 'firstName' || field === 'lastName') {
      if (!isEditing) setMemberId(null)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)
    setMemberCandidates([])

    const payload = buildGymPrPayload(form, weightUnit, memberId, { weightClassUnit: 'kg' })

    try {
      const result = await adminApi.upsertGymPrs(payload)
      const action = result.member_created ? 'Added' : 'Updated'
      setSuccessMessage(
        `${action} ${payload.first_name} ${payload.last_name} with ${result.prs_updated} gym PR${result.prs_updated === 1 ? '' : 's'}.`,
      )
      setMemberId(result.member_id)
      onCreated?.(result)
      setTimeout(() => onClose(), 1200)
    } catch (err) {
      if (err.candidates?.length) {
        setMemberCandidates(err.candidates)
        setError(err.message || 'Multiple members match that name')
      } else {
        setError(err.message || 'Failed to save gym PRs')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const hasLift = hasGymPrLift(form)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {isEditing ? 'Edit gym PRs' : 'Add gym PRs'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Log in-gym bests for the PR board. Gym PRs do not count toward DOTS leaderboards.
              {isEditing ? ' Clear a lift field to remove it.' : null}
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
          {loadingEntry ? (
            <p className="text-sm text-slate-400">Loading gym PRs...</p>
          ) : (
            <>
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
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    sex: event.target.value,
                    weightClassKg: '',
                  }))
                  if (!editMember?.id) setMemberId(null)
                  setMemberCandidates([])
                  setError(null)
                  setSuccessMessage(null)
                }}
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
                Weight class
              </label>
              <select
                id="gym-weight-class"
                required
                disabled={!form.sex}
                value={form.weightClassKg}
                onChange={(event) => updateField('weightClassKg', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
              >
                <option value="">
                  {form.sex ? 'Select weight class' : 'Select gender first'}
                </option>
                {weightClassOptions.map((option) => (
                  <option key={option.label} value={String(option.weightClassKg)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <legend className="px-1 text-sm font-medium text-slate-200">
                PRs ({weightUnit})
              </legend>
              <WeightUnitToggle
                unit={weightUnit}
                onChange={handleUnitChange}
                disabled={loadingEntry}
              />
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {GYM_PR_LIFT_FIELD_LABELS.map(([field, label]) => (
                <div key={field}>
                  <label className="block text-sm text-slate-300" htmlFor={`gym-${field}`}>
                    {label}
                  </label>
                  <input
                    id={`gym-${field}`}
                    type="number"
                    min="0"
                    step={weightUnit === 'lbs' ? '1' : '0.5'}
                    value={form[field]}
                    onChange={(event) => {
                      if (field === 'totalKg') setTotalTouched(true)
                      updateField(field, event.target.value)
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Total auto-fills from S/B/D until you edit it manually. Values are saved as kg.
            </p>
          </fieldset>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-300">{successMessage}</p> : null}

          {memberCandidates.length > 0 ? (
            <ul className="space-y-2">
              {memberCandidates.map((candidate) => (
                <li
                  key={candidate.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-100">
                      {candidate.first_name} {candidate.last_name}
                    </p>
                    <p className="text-sm text-slate-400">{candidate.email || 'No email'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMemberId(candidate.id)
                      setMemberCandidates([])
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
              disabled={
                loadingEntry ||
                submitting ||
                !form.firstName.trim() ||
                !form.lastName.trim() ||
                !form.sex ||
                !form.weightClassKg ||
                !hasLift
              }
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Save gym PRs'}
            </button>
          </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
