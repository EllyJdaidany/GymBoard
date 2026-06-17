import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import { useAdminAuth } from '../../hooks/useAdminAuth'

export default function Login() {
  const { isAuthenticated, login } = useAdminAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (login(password)) {
      navigate('/admin/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8"
      >
        <PageHeader title="Admin Login" subtitle="Enter the admin password to continue" />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
          placeholder="Password"
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-slate-100 px-4 py-3 font-medium text-slate-950"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}
