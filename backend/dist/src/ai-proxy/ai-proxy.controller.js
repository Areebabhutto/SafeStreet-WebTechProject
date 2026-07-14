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
exports.AiProxyController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const ai_proxy_service_1 = require("./ai-proxy.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let AiProxyController = class AiProxyController {
    constructor(aiProxyService) {
        this.aiProxyService = aiProxyService;
    }
    getHotspots(daysBack) {
        return this.aiProxyService.predictHotspots(daysBack ? parseInt(daysBack, 10) : undefined);
    }
};
exports.AiProxyController = AiProxyController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '[SUPERVISOR/ADMIN] AI-generated incident hotspot grid + summary' }),
    __param(0, (0, common_1.Query)('daysBack')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiProxyController.prototype, "getHotspots", null);
exports.AiProxyController = AiProxyController = __decorate([
    (0, swagger_1.ApiTags)('ai-proxy'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SUPERVISOR, client_1.Role.ADMIN),
    (0, common_1.Controller)('ai/hotspots'),
    __metadata("design:paramtypes", [ai_proxy_service_1.AiProxyService])
], AiProxyController);
//# sourceMappingURL=ai-proxy.controller.js.map