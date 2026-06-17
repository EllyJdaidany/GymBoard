import { useCallback, useState } from 'react'
import { AUTH_TOKEN_KEY } from '../components/shared/ProtectedRoute'

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem(AUTH_TOKEN_KEY)),
  )

  const login = useCallback((password) => {
    const valid = Boolean(password)
    if (valid) {
      localStorage.setItem(AUTH_TOKEN_KEY, password)
      setIsAuthenticated(true)
    }
    return valid
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setIsAuthenticated(false)
  }, [])

  return { isAuthenticated, login, logout }
}
