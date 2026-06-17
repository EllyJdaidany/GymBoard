import { Navigate } from 'react-router-dom'

export const AUTH_TOKEN_KEY = 'admin_auth_token'

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  if (!token) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}
