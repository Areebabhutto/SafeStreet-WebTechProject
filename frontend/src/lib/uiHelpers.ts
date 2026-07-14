// =============================================================================
// Small shared helpers for consistent priority/status colors + labels across
// the map, badges, and dashboards.
// =============================================================================
import type { IncidentPriority, IncidentStatus } from '../types';

export const PRIORITY_COLORS: Record<IncidentPriority, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

export const PRIORITY_BADGE_CLASSES: Record<IncidentPriority, string> = {
  LOW: 'bg-green-100 text-green-800 border-green-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
};

export const STATUS_BADGE_CLASSES: Record<IncidentStatus, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-800 border-slate-300',
  TRIAGED: 'bg-blue-100 text-blue-800 border-blue-300',
  ASSIGNED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  EN_ROUTE: 'bg-purple-100 text-purple-800 border-purple-300',
  ON_SITE: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CLOSED: 'bg-gray-200 text-gray-700 border-gray-400',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
};

export function formatStatusLabel(status: IncidentStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatCategoryLabel(category: string): string {
  return category
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
