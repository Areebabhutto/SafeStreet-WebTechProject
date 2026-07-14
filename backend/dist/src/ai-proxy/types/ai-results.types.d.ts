export interface ClassificationResult {
    category: 'POTHOLE' | 'STREETLIGHT' | 'GARBAGE' | 'WATER_LEAKAGE' | 'ILLEGAL_DUMPING' | 'ROAD_SAFETY' | 'GRAFFITI' | 'TREE_HAZARD' | 'DRAINAGE' | 'OTHER';
    departmentCode: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    rationale: string;
    confidence: number;
}
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
export interface DraftResponseResult {
    draft: string;
}
export interface HotspotCell {
    latitude: number;
    longitude: number;
    intensity: number;
    dominantCategory: string;
    incidentCount: number;
}
export interface HotspotPredictionResult {
    grid: HotspotCell[];
    summary: string;
}
export interface ExistingIncidentForDuplicateCheck {
    id: string;
    title: string;
    description: string;
    category: string;
    latitude: number;
    longitude: number;
    createdAt: string;
}
