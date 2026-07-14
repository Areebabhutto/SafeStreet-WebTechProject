// =============================================================================
// AIFeedback — reusable panel that surfaces WHY the AI made a decision
// (classification rationale, confidence) and, when a draft response is
// present, lets the human editor tweak it before it's sent to the citizen.
// Used in CitizenDash (read-only rationale) and WorkerDash (editable draft).
// =============================================================================
import { useEffect, useState } from 'react';

interface AIFeedbackProps {
  rationale?: string | null;
  confidence?: number | null;
  /** If provided, renders an editable textarea seeded with this draft. */
  draft?: string | null;
  onDraftChange?: (value: string) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export default function AIFeedback({
  rationale,
  confidence,
  draft,
  onDraftChange,
  onRegenerate,
  regenerating,
}: AIFeedbackProps) {
  const [localDraft, setLocalDraft] = useState(draft ?? '');

  useEffect(() => {
    setLocalDraft(draft ?? '');
  }, [draft]);

  if (!rationale && draft === undefined) return null;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <h4 className="font-semibold text-indigo-900 text-sm">AI Assistant</h4>
        {typeof confidence === 'number' && (
          <span className="ml-auto text-xs text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </div>

      {rationale && (
        <div>
          <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide mb-1">
            Classification rationale
          </p>
          <p className="text-sm text-indigo-950">{rationale}</p>
        </div>
      )}

      {draft !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide">
              Drafted citizen response (editable)
            </p>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={regenerating}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50"
              >
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            )}
          </div>
          <textarea
            className="w-full text-sm rounded-md border border-indigo-300 p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            rows={3}
            value={localDraft}
            onChange={(e) => {
              setLocalDraft(e.target.value);
              onDraftChange?.(e.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}
