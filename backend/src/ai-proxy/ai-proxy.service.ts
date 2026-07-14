import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { haversineDistanceMeters, computeBoundingBox } from './utils/geo.util';
import {
  ClassificationResult,
  DuplicateDetectionResult,
  DuplicateCandidate,
  DraftResponseResult,
  HotspotPredictionResult,
  ExistingIncidentForDuplicateCheck,
} from './types/ai-results.types';

/** Radius (in meters) within which two incidents are considered "nearby" for duplicate checking. */
const DUPLICATE_SEARCH_RADIUS_METERS = 50;
/** Score above which we surface a "Duplicate Detected" prompt to the citizen. */
export const DUPLICATE_SCORE_THRESHOLD = 0.75;

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly genAI: GoogleGenerativeAI;
  /**
   * Model name is read from the environment (GEMINI_MODEL) rather than
   * hardcoded, so it can be swapped between `gemini-flash-latest`,
   * `gemini-1.5-flash`, `gemini-2.0-flash`, etc. without a code change.
   */
  private readonly modelName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    this.modelName = this.config.get<string>('GEMINI_MODEL', 'gemini-flash-latest');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // ===========================================================================
  // (a) CLASSIFY & ROUTE
  // ---------------------------------------------------------------------------
  // Takes the citizen-submitted description + location and asks Gemini to
  // return a structured JSON classification: category, department, priority,
  // and a rationale explaining the decision (shown to supervisors/workers via
  // the AIFeedback component so the AI's reasoning is never a black box).
  // ===========================================================================
  async classifyAndRoute(input: {
    title: string;
    description: string;
    address?: string;
    latitude: number;
    longitude: number;
  }): Promise<ClassificationResult> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            category: {
              type: SchemaType.STRING,
              enum: [
                'POTHOLE',
                'STREETLIGHT',
                'GARBAGE',
                'WATER_LEAKAGE',
                'ILLEGAL_DUMPING',
                'ROAD_SAFETY',
                'GRAFFITI',
                'TREE_HAZARD',
                'DRAINAGE',
                'OTHER',
              ],
            },
            departmentCode: {
              type: SchemaType.STRING,
              description:
                'Short department code, e.g. ROADS, SANITATION, WATER, ELECTRICAL, PARKS, PUBLIC_SAFETY',
            },
            priority: { type: SchemaType.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            rationale: { type: SchemaType.STRING },
            confidence: { type: SchemaType.NUMBER },
          },
          required: ['category', 'departmentCode', 'priority', 'rationale', 'confidence'],
        },
      },
    });

    const prompt = `You are a municipal incident triage assistant for "SafeStreet". A citizen has
submitted the following report. Classify it accurately and route it to the
correct department.

Title: ${input.title}
Description: ${input.description}
Address: ${input.address ?? 'Not provided'}
Coordinates: ${input.latitude}, ${input.longitude}

Guidance:
- CRITICAL priority = immediate danger to life (e.g. exposed live wires, deep open manholes, structural collapse risk).
- HIGH priority = significant safety/health risk but not immediately life-threatening (e.g. large pothole on a busy road, major water leak).
- MEDIUM priority = standard maintenance issue (e.g. broken streetlight, minor pothole).
- LOW priority = cosmetic/non-urgent (e.g. graffiti, litter).
- departmentCode should be one of: ROADS, SANITATION, WATER, ELECTRICAL, PARKS, PUBLIC_SAFETY, OTHER.
- rationale should be a concise (1-2 sentence) explanation a supervisor can quickly review.

Respond ONLY with the JSON object matching the provided schema.`;

    try {
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text()) as ClassificationResult;
      return parsed;
    } catch (error) {
      this.logger.error('Gemini classifyAndRoute failed, falling back to safe default', error as Error);
      // Fail-safe default: route to a human for manual triage rather than
      // silently dropping the report or throwing a 500 to the citizen.
      return {
        category: 'OTHER',
        departmentCode: 'OTHER',
        priority: 'MEDIUM',
        rationale:
          'AI classification unavailable at time of submission - routed to general queue for manual triage.',
        confidence: 0,
      };
    }
  }

  // ===========================================================================
  // (b) DUPLICATE DETECTOR
  // ---------------------------------------------------------------------------
  // Strategy: cheap bounding-box query in Postgres (indexed lat/lng columns)
  // -> exact Haversine filter to strictly enforce the 50m radius -> Gemini
  // semantic comparison of the surviving candidates' text against the new
  // report, to catch cases where TWO complaints about the same pothole are
  // worded completely differently.
  // ===========================================================================
  async detectDuplicates(input: {
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    category?: string;
  }): Promise<DuplicateDetectionResult> {
    const bbox = computeBoundingBox(input.latitude, input.longitude, DUPLICATE_SEARCH_RADIUS_METERS);

    // Step 1: cheap DB-level bounding box filter, limited to recent open
    // incidents so we don't compare against long-resolved/ancient reports.
    const nearby = await this.prisma.incident.findMany({
      where: {
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
        status: { notIn: ['CLOSED', 'REJECTED'] },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    // Step 2: exact Haversine distance filter to strictly enforce 50m.
    const withinRadius: ExistingIncidentForDuplicateCheck[] = nearby
      .map((incident) => ({
        id: incident.id,
        title: incident.title,
        description: incident.description,
        category: incident.category,
        latitude: Number(incident.latitude),
        longitude: Number(incident.longitude),
        createdAt: incident.createdAt.toISOString(),
        distance: haversineDistanceMeters(
          input.latitude,
          input.longitude,
          Number(incident.latitude),
          Number(incident.longitude),
        ),
      }))
      .filter((incident) => incident.distance <= DUPLICATE_SEARCH_RADIUS_METERS)
      .map(({ distance: _distance, ...rest }) => rest);

    if (withinRadius.length === 0) {
      return { isDuplicate: false, bestMatch: null, candidates: [] };
    }

    // Step 3: ask Gemini to semantically compare descriptions for the
    // geographically-close candidates so wording differences don't cause
    // false negatives (e.g. "big hole in road" vs "pothole causing damage").
    const candidates = await this.compareWithGemini(input, withinRadius);
    const bestMatch =
      candidates.length > 0
        ? candidates.reduce((best, c) => (c.similarityScore > best.similarityScore ? c : best))
        : null;

    return {
      isDuplicate: (bestMatch?.similarityScore ?? 0) > DUPLICATE_SCORE_THRESHOLD,
      bestMatch,
      candidates,
    };
  }

  private async compareWithGemini(
    input: { title: string; description: string },
    candidates: ExistingIncidentForDuplicateCheck[],
  ): Promise<DuplicateCandidate[]> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            matches: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  incidentId: { type: SchemaType.STRING },
                  similarityScore: { type: SchemaType.NUMBER },
                  reason: { type: SchemaType.STRING },
                },
                required: ['incidentId', 'similarityScore', 'reason'],
              },
            },
          },
          required: ['matches'],
        },
      },
    });

    const candidateList = candidates
      .map((c) => `- id: "${c.id}" | title: "${c.title}" | description: "${c.description}"`)
      .join('\n');

    const prompt = `A new incident report was submitted within 50 meters of the following EXISTING
open incidents. For each existing incident, score from 0.0 to 1.0 how likely
it describes the SAME real-world problem as the new report (1.0 = certainly
the same issue, 0.0 = clearly unrelated despite proximity).

NEW REPORT:
Title: ${input.title}
Description: ${input.description}

EXISTING NEARBY INCIDENTS:
${candidateList}

Respond ONLY with JSON matching the schema: { "matches": [{ "incidentId", "similarityScore", "reason" }, ...] }
one entry per existing incident listed above.`;

    try {
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text()) as { matches: DuplicateCandidate[] };
      return parsed.matches;
    } catch (error) {
      this.logger.error('Gemini duplicate comparison failed, using proximity-only fallback', error as Error);
      // Fallback: without semantic comparison we conservatively flag
      // proximity-only matches at a moderate score so a human can review,
      // rather than silently skipping duplicate detection entirely.
      return candidates.map((c) => ({
        incidentId: c.id,
        similarityScore: 0.5,
        reason: 'Proximity-based match only (AI comparison unavailable).',
      }));
    }
  }

  // ===========================================================================
  // (c) RESPONSE DRAFTER
  // ---------------------------------------------------------------------------
  // Given a worker/supervisor's raw resolution notes, draft a short,
  // empathetic, citizen-facing message. Shown in AIFeedback.tsx where the
  // worker can edit before sending.
  // ===========================================================================
  async draftResponse(input: {
    incidentTitle: string;
    incidentCategory: string;
    resolutionNotes: string;
  }): Promise<DraftResponseResult> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: { draft: { type: SchemaType.STRING } },
          required: ['draft'],
        },
      },
    });

    const prompt = `Write a short, warm, and empathetic message to a citizen letting them know
their reported issue has been addressed. Use EXACTLY 3 sentences. Do not
invent details beyond what's given. Sign off simply as "The SafeStreet Team".

Incident: ${input.incidentTitle} (${input.incidentCategory})
Resolution notes from field worker: ${input.resolutionNotes}

Respond ONLY with JSON: { "draft": "..." }`;

    try {
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text()) as DraftResponseResult;
      return parsed;
    } catch (error) {
      this.logger.error('Gemini draftResponse failed, using template fallback', error as Error);
      return {
        draft: `Thank you for reporting this issue. Our team has completed work on "${input.incidentTitle}": ${input.resolutionNotes}. We appreciate you helping keep our community safe. - The SafeStreet Team`,
      };
    }
  }

  // ===========================================================================
  // (d) HOTSPOT PREDICTOR
  // ---------------------------------------------------------------------------
  // Aggregates recent historical incidents into a coarse lat/lng grid, then
  // asks Gemini to reason over the aggregated counts (not raw free text) to
  // identify emerging hotspots and produce a short natural-language summary.
  // Doing the aggregation in SQL/JS first keeps token usage small and
  // deterministic; Gemini's role here is pattern synthesis + narrative, not
  // arithmetic.
  // ===========================================================================
  async predictHotspots(daysBack = 90): Promise<HotspotPredictionResult> {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const incidents = await this.prisma.incident.findMany({
      where: { createdAt: { gte: since } },
      select: { latitude: true, longitude: true, category: true },
    });

    if (incidents.length === 0) {
      return { grid: [], summary: 'Not enough historical data to predict hotspots yet.' };
    }

    // Bucket incidents into ~0.005 degree (~500m) grid cells.
    const CELL_SIZE = 0.005;
    const cellMap = new Map<
      string,
      { latSum: number; lngSum: number; count: number; categories: Record<string, number> }
    >();

    for (const incident of incidents) {
      const lat = Number(incident.latitude);
      const lng = Number(incident.longitude);
      const cellKey = `${Math.round(lat / CELL_SIZE)}:${Math.round(lng / CELL_SIZE)}`;
      const cell = cellMap.get(cellKey) ?? { latSum: 0, lngSum: 0, count: 0, categories: {} };
      cell.latSum += lat;
      cell.lngSum += lng;
      cell.count += 1;
      cell.categories[incident.category] = (cell.categories[incident.category] ?? 0) + 1;
      cellMap.set(cellKey, cell);
    }

    const maxCount = Math.max(...Array.from(cellMap.values()).map((c) => c.count));
    const grid = Array.from(cellMap.values()).map((cell) => {
      const dominant = Object.entries(cell.categories).sort((a, b) => b[1] - a[1])[0][0];
      return {
        latitude: cell.latSum / cell.count,
        longitude: cell.lngSum / cell.count,
        intensity: cell.count / maxCount,
        dominantCategory: dominant,
        incidentCount: cell.count,
      };
    });

    // Ask Gemini for a short narrative summary of the top hotspots (pure text
    // synthesis over already-aggregated numeric data - cheap + fast).
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    const topCells = [...grid].sort((a, b) => b.incidentCount - a.incidentCount).slice(0, 5);
    const prompt = `Here are the top incident hotspot grid cells from the last ${daysBack} days
(lat, lng, incidentCount, dominantCategory):
${topCells.map((c) => `(${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}) count=${c.incidentCount} category=${c.dominantCategory}`).join('\n')}

Write a 2-3 sentence plain-English summary for a city supervisor highlighting
the most concerning patterns and what department(s) should prioritize
attention.`;

    let summary = 'Hotspot analysis complete.';
    try {
      const result = await model.generateContent(prompt);
      summary = result.response.text().trim();
    } catch (error) {
      this.logger.error('Gemini hotspot summary failed, using generic summary', error as Error);
    }

    return { grid, summary };
  }
}
