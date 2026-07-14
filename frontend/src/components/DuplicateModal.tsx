// =============================================================================
// DuplicateModal — shown when AiProxyService.detectDuplicates returns
// isDuplicate=true (similarity score > 0.75). Lets the citizen either cancel
// (assume someone already reported it) or force-submit anyway by resubmitting
// with `confirmedNotDuplicate: true`.
// =============================================================================
import type { DuplicateDetectionResult } from '../types';

interface DuplicateModalProps {
  result: DuplicateDetectionResult;
  onCancel: () => void;
  onSubmitAnyway: () => void;
  submitting?: boolean;
}

export default function DuplicateModal({ result, onCancel, onSubmitAnyway, submitting }: DuplicateModalProps) {
  const score = result.bestMatch?.similarityScore ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <h3 className="text-lg font-semibold text-slate-900">Possible Duplicate Detected</h3>
        </div>

        <p className="text-sm text-slate-600">
          Our AI found an existing report near this location that looks{' '}
          <span className="font-semibold">{Math.round(score * 100)}% similar</span> to yours.
        </p>

        {result.bestMatch && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
            {result.bestMatch.reason}
          </div>
        )}

        <p className="text-sm text-slate-600">
          If this is the same issue, there's no need to submit again — it's already in the queue. If
          you believe this is genuinely a different problem, you can submit anyway.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel — it's a duplicate
          </button>
          <button
            type="button"
            onClick={onSubmitAnyway}
            disabled={submitting}
            className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}
