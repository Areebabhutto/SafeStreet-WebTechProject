// =============================================================================
// Login — combined login/register form. On success, redirects to the
// role-appropriate dashboard (App.tsx's <Navigate> in the index route
// handles this via currentUser.role).
// =============================================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIncidentStore } from '../store/useIncidentStore';
import type { Role } from '../types';

const ROLE_HOME: Record<Role, string> = {
  CITIZEN: '/citizen',
  WORKER: '/worker',
  SUPERVISOR: '/supervisor',
  ADMIN: '/admin',
};

export default function Login() {
  const navigate = useNavigate();
  const login = useIncidentStore((s) => s.login);
  const register = useIncidentStore((s) => s.register);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('CITIZEN');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, password, fullName, role });
      }
      const user = useIncidentStore.getState().currentUser;
      navigate(user ? ROLE_HOME[user.role] : '/login');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">🛡️ SafeStreet</h1>
          <p className="text-sm text-slate-500 mt-1">AI-Powered Community Incident Reporting</p>
        </div>

        <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 font-medium ${mode === 'login' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2 font-medium ${mode === 'register' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account type</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="CITIZEN">Citizen — report issues</option>
                <option value="WORKER">Worker — field staff</option>
                <option value="SUPERVISOR">Supervisor</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                (Admin accounts are provisioned separately; workers should be assigned a department by an admin after signup.)
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
