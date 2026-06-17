import { useRef, useState } from 'react'
import { adminApi } from '../../services/adminApi'

function SummaryLine({ label, value, highlight = false }) {
  if (!value) return null

  return (
    <p className={highlight ? 'font-medium text-emerald-300' : 'text-slate-300'}>
      {label}: {value}
    </p>
  )
}

export default function ImportCsvPanel({ onImported }) {
  const inputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setError(null)
    setResult(null)
  }

  async function handleImport() {
    if (!selectedFile) return

    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const response = await adminApi.importCsv(selectedFile)
      setResult(response)
      setSelectedFile(null)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      await onImported?.()
    } catch (err) {
      setError(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const summary = result?.import_summary
  const matching = result?.matching_summary

  return (
    <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-lg font-semibold text-slate-100">Import members from CSV</h2>
      <p className="mt-1 text-sm text-slate-400">
        Upload a PushPress member export to add new gym members. Existing members are left
        unchanged — OPL links and profile data are never overwritten.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block max-w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-slate-700"
        />

        <button
          type="button"
          onClick={handleImport}
          disabled={!selectedFile || importing}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importing ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Importing...
            </>
          ) : (
            'Import CSV'
          )}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Expected columns include firstName, lastName, email, dob, gender, plan, status, planStatus,
        planEndDate, memberId, and lastCheckin. Only active members with valid emails are imported.
      </p>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
          <div>
            <p className="mb-1 font-medium text-slate-100">Import summary</p>
            <SummaryLine label="New members added" value={summary.created} highlight />
            <SummaryLine label="Already in database (skipped)" value={summary.already_exists} />
            <SummaryLine label="Skipped (missing data)" value={summary.skipped} />
            <SummaryLine label="Invalid email" value={summary.invalid_email} />
            <SummaryLine label="Missing date of birth" value={summary.missing_dob} />
            <SummaryLine label="Filtered inactive" value={summary.inactive_filtered} />
            <SummaryLine label="Filtered expired plans" value={summary.expired_plan_filtered} />
            <SummaryLine label="Queued for OPL matching" value={summary.queued_for_matching} />
          </div>

          {matching ? (
            <div>
              <p className="mb-1 font-medium text-slate-100">OPL matching</p>
              <SummaryLine label="Auto-linked" value={matching.auto_linked} highlight />
              <SummaryLine label="Needs review" value={matching.needs_review} />
              <SummaryLine label="Probable match" value={matching.probable_match} />
              <SummaryLine label="No profile found" value={matching.no_profile} />
              <SummaryLine label="Errors" value={matching.error} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
