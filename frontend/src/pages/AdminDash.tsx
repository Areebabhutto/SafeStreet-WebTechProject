// =============================================================================
// AdminDash — three tabs: User Management (role/department/active toggles),
// Department Configuration (CRUD), and System Analytics (AI hotspot
// predictor + incident-volume breakdown).
// =============================================================================
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useIncidentStore } from '../store/useIncidentStore';
import LeafletMap from '../components/LeafletMap';
import type { Department, HotspotPrediction, Role, User } from '../types';

type Tab = 'users' | 'departments' | 'analytics';

export default function AdminDash() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
      </header>

      <div className="flex gap-2 border-b border-slate-200">
        {(['users', 'departments', 'analytics'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'analytics' && <AnalyticsTab />}
    </div>
  );
}

// ===========================================================================
// Users tab
// ===========================================================================
function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);

  function load() {
    setLoading(true);
    Promise.all([api.get<User[]>('/users'), api.get<Department[]>('/departments')])
      .then(([u, d]) => {
        setUsers(u.data);
        setDepartments(d.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateUser(id: string, patch: Partial<Pick<User, 'role' | 'departmentId' | 'isActive'>>) {
    await api.patch(`/users/${id}`, patch);
    load();
  }

  if (loading) return <p className="text-sm text-slate-400">Loading users…</p>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Email</th>
            <th className="text-left px-4 py-2">Role</th>
            <th className="text-left px-4 py-2">Department</th>
            <th className="text-left px-4 py-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium text-slate-800">{u.fullName}</td>
              <td className="px-4 py-2 text-slate-500">{u.email}</td>
              <td className="px-4 py-2">
                <select
                  value={u.role}
                  onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  {(['CITIZEN', 'WORKER', 'SUPERVISOR', 'ADMIN'] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <select
                  value={u.departmentId ?? ''}
                  onChange={(e) => updateUser(u.id, { departmentId: e.target.value || undefined })}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={u.isActive}
                  onChange={(e) => updateUser(u.id, { isActive: e.target.checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===========================================================================
// Departments tab
// ===========================================================================
function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<Department[]>('/departments').then((r) => setDepartments(r.data));
  }
  useEffect(load, []);

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/departments', { name, code: code.toUpperCase(), description: description || undefined });
      setName('');
      setCode('');
      setDescription('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create department.');
    }
  }

  async function removeDepartment(id: string) {
    await api.delete(`/departments/${id}`);
    load();
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={createDepartment} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Add Department</h3>
        <input
          required
          placeholder="Name (e.g. Roads & Transportation)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Code (e.g. ROADS) — must match AI classifier output"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white">
          Add Department
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Departments</h3>
        {departments.map((d) => (
          <div key={d.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-2 text-sm">
            <div>
              <p className="font-medium text-slate-800">
                {d.name} <span className="text-xs text-slate-400">({d.code})</span>
              </p>
              {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
            </div>
            <button onClick={() => removeDepartment(d.id)} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// Analytics tab — AI Hotspot Predictor + live incident map
// ===========================================================================
function AnalyticsTab() {
  const { incidents, fetchIncidents } = useIncidentStore();
  const [hotspots, setHotspots] = useState<HotspotPrediction | null>(null);
  const [loadingHotspots, setLoadingHotspots] = useState(false);

  useEffect(() => {
    fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHotspots() {
    setLoadingHotspots(true);
    try {
      const { data } = await api.get<HotspotPrediction>('/ai/hotspots');
      setHotspots(data);
    } finally {
      setLoadingHotspots(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Incidents" value={incidents.length} />
        <StatCard
          label="Open"
          value={incidents.filter((i) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(i.status)).length}
        />
        <StatCard label="Resolved" value={incidents.filter((i) => i.status === 'RESOLVED').length} />
        <StatCard label="SLA Breaches" value={incidents.filter((i) => i.slaBreached).length} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">🤖 AI Hotspot Predictor</h3>
          <button
            onClick={loadHotspots}
            disabled={loadingHotspots}
            className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 disabled:opacity-50"
          >
            {loadingHotspots ? 'Analyzing…' : 'Run Analysis'}
          </button>
        </div>
        {hotspots && (
          <>
            <p className="text-sm text-slate-700 bg-indigo-50 rounded-lg p-3">{hotspots.summary}</p>
            <LeafletMap
              incidents={hotspots.grid.map((cell, idx) => ({
                id: `hotspot-${idx}`,
                title: `${cell.dominantCategory} cluster`,
                description: '',
                category: cell.dominantCategory as any,
                priority: cell.intensity > 0.66 ? 'CRITICAL' : cell.intensity > 0.33 ? 'HIGH' : 'MEDIUM',
                status: 'SUBMITTED',
                latitude: cell.latitude,
                longitude: cell.longitude,
                slaBreached: false,
                reportedById: '',
                createdAt: '',
                updatedAt: '',
              }))}
              showHeatmap
              height="400px"
            />
          </>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Live Incident Map</h3>
        <LeafletMap incidents={incidents} height="400px" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
