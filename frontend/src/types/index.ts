// =============================================================================
// Shared frontend types — mirror the backend Prisma enums/models so the
// whole app has a single, strictly-typed source of truth for shape.
// =============================================================================

export type Role = 'CITIZEN' | 'WORKER' | 'SUPERVISOR' | 'ADMIN';

export type IncidentStatus =
  | 'SUBMITTED'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ON_SITE'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED';

export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentCategory =
  | 'POTHOLE'
  | 'STREETLIGHT'
  | 'GARBAGE'
  | 'WATER_LEAKAGE'
  | 'ILLEGAL_DUMPING'
  | 'ROAD_SAFETY'
  | 'GRAFFITI'
  | 'TREE_HAZARD'
  | 'DRAINAGE'
  | 'OTHER';

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone?: string | null;
  isActive: boolean;
  departmentId?: string | null;
  department?: { name: string; code: string } | null;
  createdAt?: string;
}

export interface IncidentTimelineEntry {
  id: string;
  status: IncidentStatus;
  note?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  actor?: { fullName: string; role: Role } | null;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  address?: string | null;
  imageUrl?: string | null;
  aiRationale?: string | null;
  aiConfidence?: number | null;
  aiDraftResponse?: string | null;
  departmentId?: string | null;
  department?: Department | null;
  reportedById: string;
  reportedBy?: UserSummary;
  assignedToId?: string | null;
  assignedTo?: UserSummary | null;
  slaDeadline?: string | null;
  slaBreached: boolean;
  timeline?: IncidentTimelineEntry[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

/** Result shape returned by AiProxyService.detectDuplicates on the backend. */
export interface DuplicateCandidate {
  incidentId: string;
  similarityScore: number;
  reason: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  bestMatch: DuplicateCandidate | null;
  candidates: DuplicateCandidate[];
}

export interface HotspotCell {
  latitude: number;
  longitude: number;
  intensity: number;
  dominantCategory: string;
  incidentCount: number;
}

export interface HotspotPrediction {
  grid: HotspotCell[];
  summary: string;
}

export interface SlaAlertPayload {
  incidentId: string;
  level: 'AMBER' | 'RED';
  deadline: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Create-incident response can either be the created incident or a duplicate warning. */
export type CreateIncidentResponse =
  | { incident: Incident }
  | { duplicateWarning: true; result: DuplicateDetectionResult };
