import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Role } from '@prisma/client';
interface AuthenticatedSocket extends Socket {
    data: {
        userId: string;
        role: Role;
        departmentId: string | null;
    };
}
export declare class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private readonly configService;
    server: Server;
    private readonly logger;
    constructor(jwtService: JwtService, configService: ConfigService);
    handleConnection(client: AuthenticatedSocket): Promise<void>;
    handleDisconnect(client: AuthenticatedSocket): void;
    notifyUser(userId: string, event: string, payload: unknown): void;
    notifyRole(role: Role, event: string, payload: unknown): void;
    notifyDepartmentRole(departmentId: string, role: Role, event: string, payload: unknown): void;
    broadcastIncidentUpdate(payload: unknown): void;
}
export {};
