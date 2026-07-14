// =============================================================================
// App — top-level router. Wraps role-specific dashboards in ProtectedRoute,
// and renders a shared navbar showing the current user + logout.
// =============================================================================
import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useIncidentStore } from './store/useIncidentStore';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import CitizenDash from './pages/CitizenDash';
import WorkerDash from './pages/WorkerDash';
import SupervisorDash from './pages/SupervisorDash';
import AdminDash from './pages/AdminDash';
import type { Role } from './types';

const ROLE_HOME: Record<Role, string> = {
  CITIZEN: '/citizen',
  WORKER: '/worker',
  SUPERVISOR: '/supervisor',
  ADMIN: '/admin',
};

function Navbar() {
  const { currentUser, logout } = useIncidentStore();
  const navigate = useNavigate();

  if (!currentUser) return null;

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
      <span className="font-bold text-slate-900">🛡️ SafeStreet</span>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-600">
          {currentUser.fullName} <span className="text-slate-400">({currentUser.role})</span>
        </span>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="text-slate-500 hover:text-red-600"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  const { hydrateFromStorage, currentUser, isAuthenticated, authLoading } = useIncidentStore();

  useEffect(() => {
    hydrateFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/citizen"
          element={
            <ProtectedRoute allowedRoles={['CITIZEN']}>
              <CitizenDash />
            </ProtectedRoute>
          }
        />
        <Route
          path="/worker"
          element={
            <ProtectedRoute allowedRoles={['WORKER']}>
              <WorkerDash />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor"
          element={
            <ProtectedRoute allowedRoles={['SUPERVISOR']}>
              <SupervisorDash />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDash />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            authLoading ? (
              <div className="flex h-screen items-center justify-center text-slate-500">Loading…</div>
            ) : isAuthenticated && currentUser ? (
              <Navigate to={ROLE_HOME[currentUser.role]} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
