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
var NotificationsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsGateway = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let NotificationsGateway = NotificationsGateway_1 = class NotificationsGateway {
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.logger = new common_1.Logger(NotificationsGateway_1.name);
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ??
                client.handshake.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                throw new Error('No auth token supplied');
            }
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
            });
            client.data.userId = payload.sub;
            client.data.role = payload.role;
            client.data.departmentId = payload.departmentId;
            await client.join(`user:${payload.sub}`);
            await client.join(`role:${payload.role}`);
            if (payload.departmentId) {
                await client.join(`dept:${payload.departmentId}:${payload.role}`);
            }
            this.logger.log(`Socket connected: user=${payload.sub} role=${payload.role}`);
        }
        catch (error) {
            this.logger.warn(`Rejected unauthenticated socket connection: ${error.message}`);
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        this.logger.log(`Socket disconnected: user=${client.data?.userId ?? 'unknown'}`);
    }
    notifyUser(userId, event, payload) {
        this.server.to(`user:${userId}`).emit(event, payload);
    }
    notifyRole(role, event, payload) {
        this.server.to(`role:${role}`).emit(event, payload);
    }
    notifyDepartmentRole(departmentId, role, event, payload) {
        this.server.to(`dept:${departmentId}:${role}`).emit(event, payload);
    }
    broadcastIncidentUpdate(payload) {
        this.server.emit('incidentUpdated', payload);
    }
};
exports.NotificationsGateway = NotificationsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationsGateway.prototype, "server", void 0);
exports.NotificationsGateway = NotificationsGateway = NotificationsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
            credentials: true,
        },
        namespace: '/realtime',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], NotificationsGateway);
//# sourceMappingURL=notifications.gateway.js.map