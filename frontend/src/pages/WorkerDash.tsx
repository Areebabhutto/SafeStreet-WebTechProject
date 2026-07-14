// =============================================================================
// WorkerDash — shows incidents assigned to the logged-in worker. Lets them
// advance status (En Route / On Site / Resolved), attach a photo, and (when
// resolving) request an AI-drafted citizen-facing message they can edit
// before it's saved.
// =============================================================================
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useIncidentStore } from '../store/useIncidentStore';
import AIFeedback from '../components/AIFeedback';
import LeafletMap from '../components/LeafletMap';
import {
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  formatCategoryLabel,
  formatStatusLabel,
} from '../lib/uiHelpers';
import type { Incident, IncidentStatus } from '../types';

/** Mirrors IncidentsService.ALLOWED_TRANSITIONS for the statuses a worker can set. */
const NEXT_STATUS: Partial<Record<IncidentStatus, IncidentStatus>> = {
  ASSIGNED: 'EN_ROUTE',
  EN_ROUTE: 'ON_SITE',
  ON_SITE: 'RESOLVED',
};

export default function WorkerDash() {
  const { incidents, fetchIncidents, connectRealtime, currentUser } = useIncidentStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents({ assignedToId: currentUser?.id ?? '' });
    connectRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const myTasks = incidents.filter((i) => i.assignedToId === currentUser?.id);
  const selected = myTasks.find((i) => i.id === selectedId) ?? null;

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function requestDraft() {
    if (!selected || !resolutionNotes.trim()) return;
    setDrafting(true);
    setError(null);
    try {
      const { data } = await api.post<{ draft: string }>(`/incidents/${selected.id}/draft-response`, {
        resolutionNotes,
      });
      setDraft(data.draft);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to generate draft.');
    } finally {
      setDrafting(false);
    }
  }

  async function advanceStatus() {
    if (!selected) return;
    const nextStatus = NEXT_STATUS[selected.status];
    if (!nextStatus) return;

    setUpdating(true);
    setError(null);
    try {
      await api.patch(`/incidents/${selected.id}/status`, {
        status: nextStatus,
        note: note || undefined,
        imageUrl: imageDataUrl ?? undefined,
      });
      setNote('');
      setImageDataUrl(null);
      fetchIncidents({ assignedToId: currentUser?.id ?? '' });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Assigned Tasks</h1>
        <p className="text-slate-500 text-sm mt-1">{myTasks.length} incident(s) assigned to you</p>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        {/* --- Task list --- */}
        <div className="md:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
          {myTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => {
                setSelectedId(task.id);
                setDraft(null);
                setResolutionNotes('');
                setNote('');
                setImageDataUrl(null);
              }}
              className={`w-full text-left p-3 rounded-lg border transition ${
                selectedId === task.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-slate-800 truncate">{task.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${PRIORITY_BADGE_CLASSES[task.priority]}`}>
                  {task.priority}
                </span>
              </div>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE_CLASSES[task.status]}`}>
                {formatStatusLabel(task.status)}
              </span>
              {task.slaBreached && <p className="text-xs text-red-600 mt-1 font-medium">⚠ SLA breached</p>}
            </button>
          ))}
          {myTasks.length === 0 && <p className="text-sm text-slate-400">No tasks assigned yet.</p>}
        </div>

        {/* --- Detail panel --- */}
        <div className="md:col-span-2 space-y-4">
          {!selected && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              Select a task from the list to view details and update its status.
            </div>
          )}

          {selected && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selected.title}</h2>
                <p className="text-sm text-slate-600 mt-1">{selected.description}</p>
                <p className="text-xs text-slate-400 mt-1">{selected.address}</p>
              </div>

              <LeafletMap incidents={[selected]} height="220px" zoom={16} />

              {error && <p className="text-sm text-red-600">{error}</p>}

              {/* Advance status */}
              {NEXT_STATUS[selected.status] && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Update Status → {formatStatusLabel(NEXT_STATUS[selected.status]!)}
                  </h3>
                  <textarea
                    placeholder="Add a note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
                  {imageDataUrl && <img src={imageDataUrl} className="max-h-28 rounded-md border border-slate-200" />}

                  {/* Resolution + AI draft flow, only shown for the ON_SITE -> RESOLVED transition */}
                  {selected.status === 'ON_SITE' && (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Resolution notes (used to draft the citizen-facing message)"
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={requestDraft}
                        disabled={drafting || !resolutionNotes.trim()}
                        className="text-sm rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      >
                        {drafting ? 'Drafting…' : '✨ Draft AI response to citizen'}
                      </button>
                      {draft !== null && (
                        <AIFeedback draft={draft} onDraftChange={setDraft} onRegenerate={requestDraft} regenerating={drafting} />
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={advanceStatus}
                    disabled={updating}
                    className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {updating ? 'Updating…' : `Mark as ${formatStatusLabel(NEXT_STATUS[selected.status]!)}`}
                  </button>
                </div>
              )}

              {!NEXT_STATUS[selected.status] && (
                <p className="text-sm text-slate-400 border-t border-slate-100 pt-4">
                  This incident is {formatStatusLabel(selected.status).toLowerCase()} — no further action needed.
                </p>
              )}

              {/* Timeline */}
              {selected.timeline && selected.timeline.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">History</h3>
                  <ol className="space-y-2">
                    {selected.timeline.map((entry) => (
                      <li key={entry.id} className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{formatStatusLabel(entry.status)}</span>{' '}
                        — {entry.note || 'no note'} ({new Date(entry.createdAt).toLocaleString()})
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
