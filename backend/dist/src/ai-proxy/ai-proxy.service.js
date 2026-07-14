"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AiProxyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProxyService = exports.DUPLICATE_SCORE_THRESHOLD = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
const prisma_service_1 = require("../prisma/prisma.service");
const geo_util_1 = require("./utils/geo.util");
const DUPLICATE_SEARCH_RADIUS_METERS = 50;
exports.DUPLICATE_SCORE_THRESHOLD = 0.75;
let AiProxyService = AiProxyService_1 = class AiProxyService {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.logger = new common_1.Logger(AiProxyService_1.name);
        const apiKey = this.config.getOrThrow('GEMINI_API_KEY');
        this.modelName = this.config.get('GEMINI_MODEL', 'gemini-flash-latest');
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    async classifyAndRoute(input) {
        const model = this.genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: generative_ai_1.SchemaType.OBJECT,
                    properties: {
                        category: {
                            type: generative_ai_1.SchemaType.STRING,
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
                            type: generative_ai_1.SchemaType.STRING,
                            description: 'Short department code, e.g. ROADS, SANITATION, WATER, ELECTRICAL, PARKS, PUBLIC_SAFETY',
                        },
                        priority: { type: generative_ai_1.SchemaType.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                        rationale: { type: generative_ai_1.SchemaType.STRING },
                        confidence: { type: generative_ai_1.SchemaType.NUMBER },
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
            const parsed = JSON.parse(result.response.text());
            return parsed;
        }
        catch (error) {
            this.logger.error('Gemini classifyAndRoute failed, falling back to safe default', error);
            return {
                category: 'OTHER',
                departmentCode: 'OTHER',
                priority: 'MEDIUM',
                rationale: 'AI classification unavailable at time of submission - routed to general queue for manual triage.',
                confidence: 0,
            };
        }
    }
    async detectDuplicates(input) {
        const bbox = (0, geo_util_1.computeBoundingBox)(input.latitude, input.longitude, DUPLICATE_SEARCH_RADIUS_METERS);
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
        const withinRadius = nearby
            .map((incident) => ({
            id: incident.id,
            title: incident.title,
            description: incident.description,
            category: incident.category,
            latitude: Number(incident.latitude),
            longitude: Number(incident.longitude),
            createdAt: incident.createdAt.toISOString(),
            distance: (0, geo_util_1.haversineDistanceMeters)(input.latitude, input.longitude, Number(incident.latitude), Number(incident.longitude)),
        }))
            .filter((incident) => incident.distance <= DUPLICATE_SEARCH_RADIUS_METERS)
            .map(({ distance: _distance, ...rest }) => rest);
        if (withinRadius.length === 0) {
            return { isDuplicate: false, bestMatch: null, candidates: [] };
        }
        const candidates = await this.compareWithGemini(input, withinRadius);
        const bestMatch = candidates.length > 0
            ? candidates.reduce((best, c) => (c.similarityScore > best.similarityScore ? c : best))
            : null;
        return {
            isDuplicate: (bestMatch?.similarityScore ?? 0) > exports.DUPLICATE_SCORE_THRESHOLD,
            bestMatch,
            candidates,
        };
    }
    async compareWithGemini(input, candidates) {
        const model = this.genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: generative_ai_1.SchemaType.OBJECT,
                    properties: {
                        matches: {
                            type: generative_ai_1.SchemaType.ARRAY,
                            items: {
                                type: generative_ai_1.SchemaType.OBJECT,
                                properties: {
                                    incidentId: { type: generative_ai_1.SchemaType.STRING },
                                    similarityScore: { type: generative_ai_1.SchemaType.NUMBER },
                                    reason: { type: generative_ai_1.SchemaType.STRING },
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
            const parsed = JSON.parse(result.response.text());
            return parsed.matches;
        }
        catch (error) {
            this.logger.error('Gemini duplicate comparison failed, using proximity-only fallback', error);
            return candidates.map((c) => ({
                incidentId: c.id,
                similarityScore: 0.5,
                reason: 'Proximity-based match only (AI comparison unavailable).',
            }));
        }
    }
    async draftResponse(input) {
        const model = this.genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: generative_ai_1.SchemaType.OBJECT,
                    properties: { draft: { type: generative_ai_1.SchemaType.STRING } },
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
            const parsed = JSON.parse(result.response.text());
            return parsed;
        }
        catch (error) {
            this.logger.error('Gemini draftResponse failed, using template fallback', error);
            return {
                draft: `Thank you for reporting this issue. Our team has completed work on "${input.incidentTitle}": ${input.resolutionNotes}. We appreciate you helping keep our community safe. - The SafeStreet Team`,
            };
        }
    }
    async predictHotspots(daysBack = 90) {
        const since = new Date();
        since.setDate(since.getDate() - daysBack);
        const incidents = await this.prisma.incident.findMany({
            where: { createdAt: { gte: since } },
            select: { latitude: true, longitude: true, category: true },
        });
        if (incidents.length === 0) {
            return { grid: [], summary: 'Not enough historical data to predict hotspots yet.' };
        }
        const CELL_SIZE = 0.005;
        const cellMap = new Map();
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
        }
        catch (error) {
            this.logger.error('Gemini hotspot summary failed, using generic summary', error);
        }
        return { grid, summary };
    }
};
exports.AiProxyService = AiProxyService;
exports.AiProxyService = AiProxyService = AiProxyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], AiProxyService);
//# sourceMappingURL=ai-proxy.service.js.map