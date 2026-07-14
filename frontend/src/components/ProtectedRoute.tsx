// =============================================================================
// ProtectedRoute — wraps a page element, redirecting to /login if the user
// isn't authenticated, or to a role-appropriate dashboard if they're logged
// in but lack permission for this route (e.g. a CITIZEN hitting /admin).
// =============================================================================
import { Navigate } from 'react-router-dom';
import { useIncidentStore } from '../store/useIncidentStore';
import type { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

const ROLE_HOME: Record<Role, string> = {
  CITIZEN: '/citizen',
  WORKER: '/worker',
  SUPERVISOR: '/supervisor',
  ADMIN: '/admin',
};

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser, isAuthenticated, authLoading } = useIncidentStore();

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading SafeStreet…
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={ROLE_HOME[currentUser.role]} replace />;
  }

  return <>{children}</>;
}
