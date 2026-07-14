import { ConfigService } from '@nestjs/config';
import { Incident } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-status.dto';
import { AssignIncidentDto } from './dto/assign-incident.dto';
import { DraftResolutionDto } from './dto/draft-resolution.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
export declare class IncidentsService {
    private readonly prisma;
    private readonly aiProxy;
    private readonly notifications;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, aiProxy: AiProxyService, notifications: NotificationsGateway, config: ConfigService);
    create(dto: CreateIncidentDto, reporter: AuthenticatedUser): Promise<{
        incident: Incident;
    } | {
        duplicateWarning: true;
        result: unknown;
    }>;
    findAll(query: QueryIncidentsDto, requester: AuthenticatedUser): Promise<Incident[]>;
    findOne(id: string): Promise<Incident>;
    assign(id: string, dto: AssignIncidentDto, actor: AuthenticatedUser): Promise<Incident>;
    updateStatus(id: string, dto: UpdateIncidentStatusDto, actor: AuthenticatedUser): Promise<Incident>;
    draftResolutionResponse(id: string, dto: DraftResolutionDto): Promise<{
        draft: string;
    }>;
    monitorSlaBreaches(): Promise<void>;
    private computeSlaDeadline;
}
