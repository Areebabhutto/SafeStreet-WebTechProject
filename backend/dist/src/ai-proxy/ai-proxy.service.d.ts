import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationResult, DuplicateDetectionResult, DraftResponseResult, HotspotPredictionResult } from './types/ai-results.types';
export declare const DUPLICATE_SCORE_THRESHOLD = 0.75;
export declare class AiProxyService {
    private readonly config;
    private readonly prisma;
    private readonly logger;
    private readonly genAI;
    private readonly modelName;
    constructor(config: ConfigService, prisma: PrismaService);
    classifyAndRoute(input: {
        title: string;
        description: string;
        address?: string;
        latitude: number;
        longitude: number;
    }): Promise<ClassificationResult>;
    detectDuplicates(input: {
        title: string;
        description: string;
        latitude: number;
        longitude: number;
        category?: string;
    }): Promise<DuplicateDetectionResult>;
    private compareWithGemini;
    draftResponse(input: {
        incidentTitle: string;
        incidentCategory: string;
        resolutionNotes: string;
    }): Promise<DraftResponseResult>;
    predictHotspots(daysBack?: number): Promise<HotspotPredictionResult>;
}
