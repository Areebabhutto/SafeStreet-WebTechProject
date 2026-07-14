import { AiProxyService } from './ai-proxy.service';
export declare class AiProxyController {
    private readonly aiProxyService;
    constructor(aiProxyService: AiProxyService);
    getHotspots(daysBack?: string): Promise<import("./types/ai-results.types").HotspotPredictionResult>;
}
