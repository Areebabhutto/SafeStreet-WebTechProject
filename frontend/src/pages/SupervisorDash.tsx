// =============================================================================
// SupervisorDash — advanced filtering (department/status/priority/date range),
// an SLA-risk visualization, and the ability to assign incidents to workers.
// =============================================================================
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useIncidentStore } from '../store/useIncidentStore';
import LeafletMap from '../components/LeafletMap';
import {
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  formatCategoryLabel,
  formatStatusLabel,
} from '../lib/uiHelpers';
import type { Department, Incident, IncidentPriority, IncidentStatus, User } from '../types';

const STATUS_OPTIONS: IncidentStatus[] = [
  'SUBMITTED',
  'TRIAGED',
  'ASSIGNED',
  'EN_ROUTE',
  'ON_SITE',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
];
const PRIORITY_OPTIONS: IncidentPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function SupervisorDash() {
  const { incidents, fetchIncidents, connectRealtime, slaAlerts } = useIncidentStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);
  const [filters, setFilters] = useState<{
    status?: IncidentStatus;
    priority?: IncidentPriority;
    departmentId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    connectRealtime();
    api.get<Department[]>('/departments').then((r) => setDepartments(r.data));
    api.get<User[]>('/users', { params: { role: 'WORKER' } }).then((r) => setWorkers(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.departmentId) params.departmentId = filters.departmentId;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    fetchIncidents(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const slaStats = useMemo(() => {
    const open = incidents.filter((i) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(i.status));
    const breached = open.filter((i) => i.slaBreached);
    const atRisk = open.filter((i) => {
      if (!i.slaDeadline || i.slaBreached) return false;
      const remaining = new Date(i.slaDeadline).getTime() - Date.now();
      return remaining > 0 && remaining < 1000 * 60 * 60 * 4; // within 4h
    });
    return { open: open.length, breached: breached.length, atRisk: atRisk.length };
  }, [incidents]);

  async function assignWorker(incidentId: string) {
    if (!selectedWorkerId) return;
    setAssignError(null);
    try {
      await api.patch(`/incidents/${incidentId}/assign`, { workerId: selectedWorkerId });
      setAssigningId(null);
      setSelectedWorkerId('');
      fetchIncidents();
    } catch (err: any) {
      setAssignError(err?.response?.data?.message ?? 'Failed to assign worker.');
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Supervisor Dashboard</h1>
      </header>

      {/* --- SLA overview cards --- */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Open Incidents</p>
          <p className="text-2xl font-bold text-slate-900">{slaStats.open}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 bg-amber-50">
          <p className="text-xs text-amber-700 uppercase tracking-wide">At Risk (Amber)</p>
          <p className="text-2xl font-bold text-amber-700">{slaStats.atRisk}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 bg-red-50">
          <p className="text-xs text-red-700 uppercase tracking-wide">SLA Breached (Red)</p>
          <p className="text-2xl font-bold text-red-700">{slaStats.breached}</p>
        </div>
      </div>

      {slaAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent SLA Alerts</h3>
          <ul className="space-y-1 max-h-32 overflow-y-auto text-xs">
            {slaAlerts.map((a, idx) => (
              <li key={idx} className={a.level === 'RED' ? 'text-red-600' : 'text-amber-600'}>
                [{a.level}] Incident {a.incidentId.slice(0, 8)} — deadline {new Date(a.deadline).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Filters --- */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <FilterSelect
          label="Status"
          value={filters.status ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, status: (v || undefined) as IncidentStatus }))}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: formatStatusLabel(s) }))}
        />
        <FilterSelect
          label="Priority"
          value={filters.priority ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, priority: (v || undefined) as IncidentPriority }))}
          options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          label="Department"
          value={filters.departmentId ?? ''}
          onChange={(v) => setFilters((f) => ({ ...f, departmentId: v || undefined }))}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
          <input
            type="date"
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
          <input
            type="date"
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFilters({})}
          className="text-sm text-indigo-600 hover:underline"
        >
          Clear filters
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <LeafletMap incidents={incidents} height="450px" />

        <div className="bg-white rounded-xl border border-slate-200 p-4 max-h-[450px] overflow-y-auto space-y-2">
          {assignError && <p className="text-sm text-red-600">{assignError}</p>}
          {incidents.map((incident: Incident) => (
            <div key={incident.id} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-slate-800">{incident.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_BADGE_CLASSES[incident.priority]}`}>
                  {incident.priority}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE_CLASSES[incident.status]}`}>
                  {formatStatusLabel(incident.status)}
                </span>
                <span className="text-xs text-slate-400">{formatCategoryLabel(incident.category)}</span>
                {incident.assignedTo && (
                  <span className="text-xs text-slate-500">→ {incident.assignedTo.fullName}</span>
                )}
                {incident.slaBreached && <span className="text-xs text-red-600 font-medium">⚠ SLA breached</span>}
              </div>

              {['TRIAGED', 'ASSIGNED'].includes(incident.status) && (
                <div className="mt-2">
                  {assigningId === incident.id ? (
                    <div className="flex gap-2">
                      <select
                        value={selectedWorkerId}
                        onChange={(e) => setSelectedWorkerId(e.target.value)}
                        className="text-xs rounded-md border border-slate-300 px-2 py-1"
                      >
                        <option value="">Select worker…</option>
                        {workers
                          .filter((w) => !incident.departmentId || w.departmentId === incident.departmentId)
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.fullName}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => assignWorker(incident.id)}
                        className="text-xs rounded-md bg-indigo-600 text-white px-2 py-1"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setAssigningId(null)} className="text-xs text-slate-500">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAssigningId(incident.id)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Assign worker
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {incidents.length === 0 && <p className="text-sm text-slate-400">No incidents match these filters.</p>}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm min-w-[140px]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
