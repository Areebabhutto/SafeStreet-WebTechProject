/** Result of the Classify & Route AI call. */
export interface ClassificationResult {
  category:
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
  departmentCode: string; // e.g. "ROADS", "SANITATION", "WATER", "ELECTRICAL"
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string; // human-readable explanation of the decision
  confidence: number; // 0..1
}

/** A single candidate match returned by the Duplicate Detector. */
export interface DuplicateCandidate {
  incidentId: string;
  similarityScore: number; // 0..1, where >0.75 is considered a likely duplicate
  reason: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  bestMatch: DuplicateCandidate | null;
  candidates: DuplicateCandidate[];
}

/** Result of the Response Drafter AI call. */
export interface DraftResponseResult {
  draft: string; // ~3 sentence empathetic message to the citizen
}

/** A single grid cell in the Hotspot Predictor output. */
export interface HotspotCell {
  latitude: number;
  longitude: number;
  intensity: number; // 0..1 relative density/risk score
  dominantCategory: string;
  incidentCount: number;
}

export interface HotspotPredictionResult {
  grid: HotspotCell[];
  summary: string;
}

/** Minimal shape of an existing incident used as input to the duplicate check. */
export interface ExistingIncidentForDuplicateCheck {
  id: string;
  title: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}
