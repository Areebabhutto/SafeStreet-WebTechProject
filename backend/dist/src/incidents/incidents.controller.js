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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const incidents_service_1 = require("./incidents.service");
const create_incident_dto_1 = require("./dto/create-incident.dto");
const update_status_dto_1 = require("./dto/update-status.dto");
const assign_incident_dto_1 = require("./dto/assign-incident.dto");
const draft_resolution_dto_1 = require("./dto/draft-resolution.dto");
const query_incidents_dto_1 = require("./dto/query-incidents.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let IncidentsController = class IncidentsController {
    constructor(incidentsService) {
        this.incidentsService = incidentsService;
    }
    create(dto, user) {
        return this.incidentsService.create(dto, user);
    }
    findAll(query, user) {
        return this.incidentsService.findAll(query, user);
    }
    findOne(id) {
        return this.incidentsService.findOne(id);
    }
    assign(id, dto, user) {
        return this.incidentsService.assign(id, dto, user);
    }
    updateStatus(id, dto, user) {
        return this.incidentsService.updateStatus(id, dto, user);
    }
    draftResponse(id, dto) {
        return this.incidentsService.draftResolutionResponse(id, dto);
    }
};
exports.IncidentsController = IncidentsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.CITIZEN, client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: '[CITIZEN] Submit a new incident report (runs AI duplicate check + classification)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_incident_dto_1.CreateIncidentDto, Object]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List incidents, scoped by role and optional filters (dept/status/priority/date range)' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_incidents_dto_1.QueryIncidentsDto, Object]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single incident with full timeline history' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/assign'),
    (0, roles_decorator_1.Roles)(client_1.Role.SUPERVISOR, client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: '[SUPERVISOR/ADMIN] Assign an incident to a worker' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, assign_incident_dto_1.AssignIncidentDto, Object]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "assign", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(client_1.Role.WORKER, client_1.Role.SUPERVISOR, client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: '[WORKER/SUPERVISOR/ADMIN] Advance incident status (En Route/On Site/Resolved/...)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_status_dto_1.UpdateIncidentStatusDto, Object]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)(':id/draft-response'),
    (0, roles_decorator_1.Roles)(client_1.Role.WORKER, client_1.Role.SUPERVISOR, client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: '[WORKER/SUPERVISOR] Generate an AI-drafted, empathetic citizen-facing resolution message' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, draft_resolution_dto_1.DraftResolutionDto]),
    __metadata("design:returntype", void 0)
], IncidentsController.prototype, "draftResponse", null);
exports.IncidentsController = IncidentsController = __decorate([
    (0, swagger_1.ApiTags)('incidents'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('incidents'),
    __metadata("design:paramtypes", [incidents_service_1.IncidentsService])
], IncidentsController);
//# sourceMappingURL=incidents.controller.js.map