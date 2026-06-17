import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/admin/AdminLayout'
import ProtectedRoute from './components/shared/ProtectedRoute'
import Board from './pages/Board'
import BoardTV from './pages/BoardTV'
import DotsLeaderboard from './pages/DotsLeaderboard'
import Dashboard from './pages/admin/Dashboard'
import GymPrEntry from './pages/admin/GymPrEntry'
import Login from './pages/admin/Login'
import Members from './pages/admin/Members'
import SyncLog from './pages/admin/SyncLog'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Board />} />
        <Route path="/leaderboard/dots" element={<DotsLeaderboard />} />
        <Route path="/tv" element={<BoardTV />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/members"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Members />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/gym-prs"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <GymPrEntry />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sync-log"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <SyncLog />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
