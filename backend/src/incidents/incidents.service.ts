import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Incident, IncidentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiProxyService, DUPLICATE_SCORE_THRESHOLD } from '../ai-proxy/ai-proxy.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-status.dto';
import { AssignIncidentDto } from './dto/assign-incident.dto';
import { DraftResolutionDto } from './dto/draft-resolution.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

/** Terminal statuses after which SLA breach checks no longer apply. */
const TERMINAL_STATUSES: IncidentStatus[] = ['RESOLVED', 'CLOSED', 'REJECTED'];

/** Legal forward transitions for worker/supervisor status updates. */
const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  SUBMITTED: ['TRIAGED', 'REJECTED'],
  TRIAGED: ['ASSIGNED', 'REJECTED'],
  ASSIGNED: ['EN_ROUTE', 'REJECTED'],
  EN_ROUTE: ['ON_SITE'],
  ON_SITE: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
  REJECTED: [],
};

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProxy: AiProxyService,
    private readonly notifications: NotificationsGateway,
    private readonly config: ConfigService,
  ) {}

  // ===========================================================================
  // CREATE - citizen submits a new incident
  // ---------------------------------------------------------------------------
  // Flow:
  //   1. Run the duplicate detector first. If score > 0.75 and the citizen has
  //      NOT already confirmed "submit anyway", return the duplicate result to
  //      the frontend instead of persisting (frontend shows the modal).
  //   2. Run classify & route (category/department/priority/rationale).
  //   3. Look up (or fall back to) the target Department by code.
  //   4. Compute the SLA deadline from priority.
  //   5. Persist + write initial timeline entry + audit log.
  //   6. Emit WebSocket events so live maps/dashboards update instantly.
  // ===========================================================================
  async create(
    dto: CreateIncidentDto,
    reporter: AuthenticatedUser,
  ): Promise<{ incident: Incident } | { duplicateWarning: true; result: unknown }> {
    // Step 1: duplicate check runs BEFORE we commit anything to the DB.
    if (!dto.confirmedNotDuplicate) {
      const duplicateResult = await this.aiProxy.detectDuplicates({
        title: dto.title,
        description: dto.description,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });

      if (duplicateResult.isDuplicate) {
        this.logger.log(
          `Potential duplicate detected for new report near (${dto.latitude}, ${dto.longitude}) - score=${duplicateResult.bestMatch?.similarityScore}`,
        );
        return { duplicateWarning: true, result: duplicateResult };
      }
    }

    // Step 2: AI classification + routing.
    const classification = await this.aiProxy.classifyAndRoute({
      title: dto.title,
      description: dto.description,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    // Step 3: resolve department by code (case-insensitive), fall back to null
    // (unassigned queue) if no matching department exists yet.
    const department = await this.prisma.department.findFirst({
      where: { code: { equals: classification.departmentCode, mode: 'insensitive' } },
    });

    // Step 4: SLA deadline based on priority (minutes configurable via env).
    const slaDeadline = this.computeSlaDeadline(classification.priority);

    // Step 5: persist everything transactionally so the incident + its first
    // timeline entry + audit log are created atomically.
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
          metadata: classification as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    // Step 6: real-time push. Department workers see it appear instantly;
    // the citizen's own dashboard updates without a manual refresh.
    if (department) {
      this.notifications.notifyDepartmentRole(department.id, Role.WORKER, 'newIncident', incident);
      this.notifications.notifyDepartmentRole(department.id, Role.SUPERVISOR, 'newIncident', incident);
    }
    this.notifications.notifyRole(Role.ADMIN, 'newIncident', incident);
    this.notifications.broadcastIncidentUpdate(incident);

    return { incident };
  }

  // ===========================================================================
  // READ
  // ===========================================================================
  async findAll(query: QueryIncidentsDto, requester: AuthenticatedUser): Promise<Incident[]> {
    const where: Prisma.IncidentWhereInput = {
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

    // Row-level scoping by role: citizens only ever see their own reports;
    // workers only see incidents assigned to them; supervisors/admins see
    // everything (optionally narrowed by the department filter above).
    if (requester.role === Role.CITIZEN) {
      where.reportedById = requester.userId;
    } else if (requester.role === Role.WORKER) {
      where.assignedToId = requester.userId;
    } else if (requester.role === Role.SUPERVISOR && requester.departmentId) {
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

  async findOne(id: string): Promise<Incident> {
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
      throw new NotFoundException(`Incident ${id} not found`);
    }
    return incident;
  }

  // ===========================================================================
  // ASSIGN - supervisor assigns a worker
  // ===========================================================================
  async assign(id: string, dto: AssignIncidentDto, actor: AuthenticatedUser): Promise<Incident> {
    const incident = await this.findOne(id);
    const worker = await this.prisma.user.findUnique({ where: { id: dto.workerId } });

    if (!worker || worker.role !== Role.WORKER) {
      throw new BadRequestException('Target user is not a valid WORKER');
    }
    if (incident.departmentId && worker.departmentId !== incident.departmentId) {
      throw new BadRequestException('Worker does not belong to the incident\'s department');
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

  // ===========================================================================
  // UPDATE STATUS - worker/supervisor advances the lifecycle
  // ===========================================================================
  async updateStatus(
    id: string,
    dto: UpdateIncidentStatusDto,
    actor: AuthenticatedUser,
  ): Promise<Incident> {
    const incident = await this.findOne(id);

    if (actor.role === Role.WORKER && incident.assignedToId !== actor.userId) {
      throw new ForbiddenException('You are not assigned to this incident');
    }

    const allowedNext = ALLOWED_TRANSITIONS[incident.status] ?? [];
    if (!allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${incident.status} to ${dto.status}. Allowed: ${allowedNext.join(', ') || 'none'}`,
      );
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
      this.notifications.notifyDepartmentRole(incident.departmentId, Role.SUPERVISOR, 'incidentUpdated', updated);
    }
    this.notifications.broadcastIncidentUpdate(updated);

    return updated;
  }

  // ===========================================================================
  // AI RESPONSE DRAFTER - worker/supervisor requests a draft citizen message
  // ===========================================================================
  async draftResolutionResponse(id: string, dto: DraftResolutionDto): Promise<{ draft: string }> {
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

  // ===========================================================================
  // SLA MONITORING - runs every hour, flags breaches, escalates via sockets
  // ===========================================================================
  @Cron(CronExpression.EVERY_HOUR)
  async monitorSlaBreaches(): Promise<void> {
    this.logger.log('Running hourly SLA monitor sweep...');
    const now = new Date();

    // AMBER: within 20% of deadline remaining, not yet breached.
    const atRisk = await this.prisma.incident.findMany({
      where: {
        status: { notIn: TERMINAL_STATUSES },
        slaBreached: false,
        slaDeadline: { not: null, gt: now },
      },
    });

    for (const incident of atRisk) {
      if (!incident.slaDeadline) continue;
      const totalWindowMs = incident.slaDeadline.getTime() - incident.createdAt.getTime();
      const remainingMs = incident.slaDeadline.getTime() - now.getTime();
      const remainingRatio = totalWindowMs > 0 ? remainingMs / totalWindowMs : 1;

      if (remainingRatio <= 0.2) {
        // AMBER alert - approaching breach.
        if (incident.departmentId) {
          this.notifications.notifyDepartmentRole(incident.departmentId, Role.SUPERVISOR, 'slaAlert', {
            incidentId: incident.id,
            level: 'AMBER',
            deadline: incident.slaDeadline,
          });
        }
      }
    }

    // RED: deadline has passed and it's not already flagged as breached.
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
        this.notifications.notifyDepartmentRole(incident.departmentId, Role.SUPERVISOR, 'slaAlert', {
          incidentId: incident.id,
          level: 'RED',
          deadline: incident.slaDeadline,
        });
      }
      this.notifications.notifyRole(Role.ADMIN, 'slaAlert', {
        incidentId: incident.id,
        level: 'RED',
        deadline: incident.slaDeadline,
      });
    }

    this.logger.log(`SLA sweep complete: ${atRisk.length} amber candidates checked, ${breached.length} newly breached`);
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  private computeSlaDeadline(priority: string): Date {
    const minutesByPriority: Record<string, number> = {
      CRITICAL: this.config.get<number>('SLA_MINUTES_CRITICAL', 120),
      HIGH: this.config.get<number>('SLA_MINUTES_HIGH', 480),
      MEDIUM: this.config.get<number>('SLA_MINUTES_MEDIUM', 1440),
      LOW: this.config.get<number>('SLA_MINUTES_LOW', 4320),
    };
    const minutes = minutesByPriority[priority] ?? minutesByPriority.MEDIUM;
    return new Date(Date.now() + minutes * 60 * 1000);
  }
}
