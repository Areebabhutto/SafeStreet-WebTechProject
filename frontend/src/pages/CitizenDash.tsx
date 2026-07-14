// =============================================================================
// CitizenDash — lets a citizen submit a new incident (title, category shown
// is AI-assigned after submit, description, geolocation, optional image) and
// view the status of their own past reports in real time.
// =============================================================================
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useGeolocation } from '../hooks/useGeolocation';
import { useIncidentStore } from '../store/useIncidentStore';
import DuplicateModal from '../components/DuplicateModal';
import AIFeedback from '../components/AIFeedback';
import LeafletMap from '../components/LeafletMap';
import {
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  formatCategoryLabel,
  formatStatusLabel,
} from '../lib/uiHelpers';
import type { CreateIncidentResponse, DuplicateDetectionResult, Incident } from '../types';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB — keeps Base64 payloads reasonable

export default function CitizenDash() {
  const { incidents, fetchIncidents, connectRealtime, currentUser } = useIncidentStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateDetectionResult | null>(null);
  const [lastRationale, setLastRationale] = useState<{ rationale: string; confidence: number } | null>(
    null,
  );

  const { latitude, longitude, error: geoError, loading: geoLoading, requestLocation } = useGeolocation();

  useEffect(() => {
    fetchIncidents();
    connectRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myIncidents = incidents.filter((i) => i.reportedById === currentUser?.id);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setImageError(null);
    if (!file) {
      setImageDataUrl(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submitIncident(confirmedNotDuplicate: boolean) {
    if (latitude === null || longitude === null) {
      setSubmitError('Please share your location before submitting.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data } = await api.post<CreateIncidentResponse>('/incidents', {
        title,
        description,
        address: address || undefined,
        latitude,
        longitude,
        imageUrl: imageDataUrl ?? undefined,
        confirmedNotDuplicate,
      });

      if ('duplicateWarning' in data) {
        setDuplicateResult(data.result);
        return;
      }

      setDuplicateResult(null);
      setLastRationale({
        rationale: data.incident.aiRationale ?? '',
        confidence: data.incident.aiConfidence ?? 0,
      });
      setSuccessMessage(
        `Report submitted! AI classified this as "${formatCategoryLabel(data.incident.category)}" (${data.incident.priority} priority).`,
      );
      setTitle('');
      setDescription('');
      setAddress('');
      setImageDataUrl(null);
      fetchIncidents();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    submitIncident(false);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Report an Issue</h1>
        <p className="text-slate-500 text-sm mt-1">
          Welcome back, {currentUser?.fullName}. Your report will be automatically classified and
          routed to the right department.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* --- Submission form --- */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Large pothole on Main St"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              required
              minLength={10}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you see — our AI uses this to classify and prioritize your report."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Address <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={requestLocation}
                disabled={geoLoading}
                className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {geoLoading ? 'Locating…' : '📍 Use my current location'}
              </button>
              {latitude !== null && longitude !== null && (
                <span className="text-xs text-emerald-700">
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
              )}
            </div>
            {geoError && <p className="text-xs text-red-600 mt-1">{geoError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Photo <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
            {imageDataUrl && (
              <img src={imageDataUrl} alt="Preview" className="mt-2 rounded-md max-h-32 border border-slate-200" />
            )}
            {imageError && <p className="text-xs text-red-600 mt-1">{imageError}</p>}
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {successMessage && <p className="text-sm text-emerald-700">{successMessage}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>

          {lastRationale && lastRationale.rationale && (
            <AIFeedback rationale={lastRationale.rationale} confidence={lastRationale.confidence} />
          )}
        </form>

        {/* --- My reports + map --- */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">My Reports ({myIncidents.length})</h2>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {myIncidents.length === 0 && (
                <p className="text-sm text-slate-400">You haven't submitted any reports yet.</p>
              )}
              {myIncidents.map((incident: Incident) => (
                <div key={incident.id} className="border border-slate-100 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{incident.title}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE_CLASSES[incident.status]}`}
                    >
                      {formatStatusLabel(incident.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_BADGE_CLASSES[incident.priority]}`}
                    >
                      {incident.priority}
                    </span>
                    <span className="text-xs text-slate-400">{formatCategoryLabel(incident.category)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <LeafletMap incidents={myIncidents} height="300px" />
        </div>
      </div>

      {duplicateResult && (
        <DuplicateModal
          result={duplicateResult}
          submitting={submitting}
          onCancel={() => setDuplicateResult(null)}
          onSubmitAnyway={() => submitIncident(true)}
        />
      )}
    </div>
  );
}
