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
var IncidentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_proxy_service_1 = require("../ai-proxy/ai-proxy.service");
const notifications_gateway_1 = require("../notifications/notifications.gateway");
const TERMINAL_STATUSES = ['RESOLVED', 'CLOSED', 'REJECTED'];
const ALLOWED_TRANSITIONS = {
    SUBMITTED: ['TRIAGED', 'REJECTED'],
    TRIAGED: ['ASSIGNED', 'REJECTED'],
    ASSIGNED: ['EN_ROUTE', 'REJECTED'],
    EN_ROUTE: ['ON_SITE'],
    ON_SITE: ['RESOLVED'],
    RESOLVED: ['CLOSED'],
    CLOSED: [],
    REJECTED: [],
};
let IncidentsService = IncidentsService_1 = class IncidentsService {
    constructor(prisma, aiProxy, notifications, config) {
        this.prisma = prisma;
        this.aiProxy = aiProxy;
        this.notifications = notifications;
        this.config = config;
        this.logger = new common_1.Logger(IncidentsService_1.name);
    }
    async create(dto, reporter) {
        if (!dto.confirmedNotDuplicate) {
            const duplicateResult = await this.aiProxy.detectDuplicates({
                title: dto.title,
                description: dto.description,
                latitude: dto.latitude,
                longitude: dto.longitude,
            });
            if (duplicateResult.isDuplicate) {
                this.logger.log(`Potential duplicate detected for new report near (${dto.latitude}, ${dto.longitude}) - score=${duplicateResult.bestMatch?.similarityScore}`);
                return { duplicateWarning: true, result: duplicateResult };
            }
        }
        const classification = await this.aiProxy.classifyAndRoute({
            title: dto.title,
            description: dto.description,
            address: dto.address,
            latitude: dto.latitude,
            longitude: dto.longitude,
        });
        const department = await this.prisma.department.findFirst({
            where: { code: { equals: classification.departmentCode, mode: 'insensitive' } },
        });
        const slaDeadline = this.computeSlaDeadline(classification.priority);
        const incident = await this.prisma.$transaction(async (tx) => {
            const created = await tx.incident.create({
                data: {
                    title: dto.title,
                    description: dto.description,
                    imageUrl: dto.imageUrl,
                    latitude: dto.latitude,
                    longitude: dto.longitude,
                    address: dto.address,
                    category: classification.category,
                    priority: classification.priority,
                    status: 'TRIAGED',
                    aiRationale: classification.rationale,
                    aiConfidence: classification.confidence,
                    departmentId: department?.id,
                    reportedById: reporter.userId,
                    slaDeadline,
                },
            });
            await tx.incidentTimeline.create({
                data: {
                    incidentId: created.id,
                    status: 'TRIAGED',
                    note: `AI classified as ${classification.category} (${classification.priority} priority): ${classification.rationale}`,
                    actorId: reporter.userId,
                },
            });
            await tx.auditLog.create({
                data: {
                    action: 'AI_CLASSIFICATION',
                    actorId: reporter.userId,
                    incidentId: created.id,
                    metadata: classification,
                },
            });
            return created;
        });
        if (department) {
            this.notifications.notifyDepartmentRole(department.id, client_1.Role.WORKER, 'newIncident', incident);
            this.notifications.notifyDepartmentRole(department.id, client_1.Role.SUPERVISOR, 'newIncident', incident);
        }
        this.notifications.notifyRole(client_1.Role.ADMIN, 'newIncident', incident);
        this.notifications.broadcastIncidentUpdate(incident);
        return { incident };
    }
    async findAll(query, requester) {
        const where = {
            ...(query.status ? { status: query.status } : {}),
            ...(query.priority ? { priority: query.priority } : {}),
            ...(query.category ? { category: query.category } : {}),
            ...(query.departmentId ? { departmentId: query.departmentId } : {}),
            ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
            ...(query.dateFrom || query.dateTo
                ? {
                    createdAt: {
                        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
                    },
                }
                : {}),
        };
        if (requester.role === client_1.Role.CITIZEN) {
            where.reportedById = requester.userId;
        }
        else if (requester.role === client_1.Role.WORKER) {
            where.assignedToId = requester.userId;
        }
        else if (requester.role === client_1.Role.SUPERVISOR && requester.departmentId) {
            where.departmentId = query.departmentId ?? requester.departmentId;
        }
        return this.prisma.incident.findMany({
            where,
            include: {
                department: true,
                reportedBy: { select: { id: true, fullName: true, email: true } },
                assignedTo: { select: { id: true, fullName: true, email: true } },
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        });
    }
    async findOne(id) {
        const incident = await this.prisma.incident.findUnique({
            where: { id },
            include: {
                department: true,
                reportedBy: { select: { id: true, fullName: true, email: true } },
                assignedTo: { select: { id: true, fullName: true, email: true } },
                timeline: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { fullName: true, role: true } } } },
            },
        });
        if (!incident) {
            throw new common_1.NotFoundException(`Incident ${id} not found`);
        }
        return incident;
    }
    async assign(id, dto, actor) {
        const incident = await this.findOne(id);
        const worker = await this.prisma.user.findUnique({ where: { id: dto.workerId } });
        if (!worker || worker.role !== client_1.Role.WORKER) {
            throw new common_1.BadRequestException('Target user is not a valid WORKER');
        }
        if (incident.departmentId && worker.departmentId !== incident.departmentId) {
            throw new common_1.BadRequestException('Worker does not belong to the incident\'s department');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.incident.update({
                where: { id },
                data: { assignedToId: dto.workerId, status: 'ASSIGNED' },
            });
            await tx.incidentTimeline.create({
                data: {
                    incidentId: id,
                    status: 'ASSIGNED',
                    note: `Assigned to ${worker.fullName}`,
                    actorId: actor.userId,
                },
            });
            await tx.auditLog.create({
                data: { action: 'ASSIGN', actorId: actor.userId, incidentId: id, metadata: { workerId: dto.workerId } },
            });
            return result;
        });
        this.notifications.notifyUser(dto.workerId, 'incidentAssigned', updated);
        this.notifications.notifyUser(incident.reportedById, 'incidentUpdated', updated);
        this.notifications.broadcastIncidentUpdate(updated);
        return updated;
    }
    async updateStatus(id, dto, actor) {
        const incident = await this.findOne(id);
        if (actor.role === client_1.Role.WORKER && incident.assignedToId !== actor.userId) {
            throw new common_1.ForbiddenException('You are not assigned to this incident');
        }
        const allowedNext = ALLOWED_TRANSITIONS[incident.status] ?? [];
        if (!allowedNext.includes(dto.status)) {
            throw new common_1.BadRequestException(`Cannot transition from ${incident.status} to ${dto.status}. Allowed: ${allowedNext.join(', ') || 'none'}`);
        }
        const isResolving = dto.status === 'RESOLVED';
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.incident.update({
                where: { id },
                data: {
                    status: dto.status,
                    imageUrl: dto.imageUrl ?? incident.imageUrl,
                    resolvedAt: isResolving ? new Date() : incident.resolvedAt,
                },
            });
            await tx.incidentTimeline.create({
                data: { incidentId: id, status: dto.status, note: dto.note, imageUrl: dto.imageUrl, actorId: actor.userId },
            });
            await tx.auditLog.create({
                data: { action: 'STATUS_CHANGE', actorId: actor.userId, incidentId: id, metadata: { from: incident.status, to: dto.status } },
            });
            return result;
        });
        this.notifications.notifyUser(incident.reportedById, 'incidentUpdated', updated);
        if (incident.departmentId) {
            this.notifications.notifyDepartmentRole(incident.departmentId, client_1.Role.SUPERVISOR, 'incidentUpdated', updated);
        }
        this.notifications.broadcastIncidentUpdate(updated);
        return updated;
    }
    async draftResolutionResponse(id, dto) {
        const incident = await this.findOne(id);
        const result = await this.aiProxy.draftResponse({
            incidentTitle: incident.title,
            incidentCategory: incident.category,
            resolutionNotes: dto.resolutionNotes,
        });
        await this.prisma.incident.update({ where: { id }, data: { aiDraftResponse: result.draft } });
        await this.prisma.auditLog.create({
            data: { action: 'AI_DRAFT_RESPONSE', incidentId: id, metadata: { resolutionNotes: dto.resolutionNotes, draft: result.draft } },
        });
        return result;
    }
    async monitorSlaBreaches() {
        this.logger.log('Running hourly SLA monitor sweep...');
        const now = new Date();
        const atRisk = await this.prisma.incident.findMany({
            where: {
                status: { notIn: TERMINAL_STATUSES },
                slaBreached: false,
                slaDeadline: { not: null, gt: now },
            },
        });
        for (const incident of atRisk) {
            if (!incident.slaDeadline)
                continue;
            const totalWindowMs = incident.slaDeadline.getTime() - incident.createdAt.getTime();
            const remainingMs = incident.slaDeadline.getTime() - now.getTime();
            const remainingRatio = totalWindowMs > 0 ? remainingMs / totalWindowMs : 1;
            if (remainingRatio <= 0.2) {
                if (incident.departmentId) {
                    this.notifications.notifyDepartmentRole(incident.departmentId, client_1.Role.SUPERVISOR, 'slaAlert', {
                        incidentId: incident.id,
                        level: 'AMBER',
                        deadline: incident.slaDeadline,
                    });
                }
            }
        }
        const breached = await this.prisma.incident.findMany({
            where: {
                status: { notIn: TERMINAL_STATUSES },
                slaBreached: false,
                slaDeadline: { not: null, lte: now },
            },
        });
        for (const incident of breached) {
            await this.prisma.incident.update({ where: { id: incident.id }, data: { slaBreached: true } });
            if (incident.departmentId) {
                this.notifications.notifyDepartmentRole(incident.departmentId, client_1.Role.SUPERVISOR, 'slaAlert', {
                    incidentId: incident.id,
                    level: 'RED',
                    deadline: incident.slaDeadline,
                });
            }
            this.notifications.notifyRole(client_1.Role.ADMIN, 'slaAlert', {
                incidentId: incident.id,
                level: 'RED',
                deadline: incident.slaDeadline,
            });
        }
        this.logger.log(`SLA sweep complete: ${atRisk.length} amber candidates checked, ${breached.length} newly breached`);
    }
    computeSlaDeadline(priority) {
        const minutesByPriority = {
            CRITICAL: this.config.get('SLA_MINUTES_CRITICAL', 120),
            HIGH: this.config.get('SLA_MINUTES_HIGH', 480),
            MEDIUM: this.config.get('SLA_MINUTES_MEDIUM', 1440),
            LOW: this.config.get('SLA_MINUTES_LOW', 4320),
        };
        const minutes = minutesByPriority[priority] ?? minutesByPriority.MEDIUM;
        return new Date(Date.now() + minutes * 60 * 1000);
    }
};
exports.IncidentsService = IncidentsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IncidentsService.prototype, "monitorSlaBreaches", null);
exports.IncidentsService = IncidentsService = IncidentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_proxy_service_1.AiProxyService,
        notifications_gateway_1.NotificationsGateway,
        config_1.ConfigService])
], IncidentsService);
//# sourceMappingURL=incidents.service.js.map