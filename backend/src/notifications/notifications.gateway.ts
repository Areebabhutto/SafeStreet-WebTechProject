import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/types/authenticated-user.type';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    role: Role;
    departmentId: string | null;
  };
}

/**
 * Central real-time hub. Every connecting client authenticates with the same
 * JWT access token used for REST calls (passed via the `auth.token` handshake
 * field). Once authenticated, the socket is auto-joined into rooms so
 * `notifications.gateway` (and IncidentsService, which injects this class)
 * can target broadcasts precisely:
 *
 *   - `user:<userId>`           -> personal notifications (e.g. "your report was resolved")
 *   - `role:<ROLE>`             -> broadcast to every user with a given role (e.g. all ADMINs)
 *   - `dept:<DEPT_CODE>:<ROLE>` -> e.g. "WORKER_ROADS" - workers in a specific department
 *
 * CORS origin is read from config, matching the REST API's CORS_ORIGIN so we
 * don't hardcode the frontend URL.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/realtime',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Authenticates the socket using the JWT access token, then joins it into
   * the personal/role/department rooms it needs. Disconnects immediately on
   * invalid/missing tokens.
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new Error('No auth token supplied');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.data.departmentId = payload.departmentId;

      // Personal room - for "your incident was updated" style pushes.
      await client.join(`user:${payload.sub}`);
      // Role-wide room - e.g. every ADMIN sees system-wide SLA breach alerts.
      await client.join(`role:${payload.role}`);
      // Department+role room - e.g. "WORKER_ROADS" gets new-assignment pings
      // scoped to their department only.
      if (payload.departmentId) {
        await client.join(`dept:${payload.departmentId}:${payload.role}`);
      }

      this.logger.log(`Socket connected: user=${payload.sub} role=${payload.role}`);
    } catch (error) {
      this.logger.warn(`Rejected unauthenticated socket connection: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.log(`Socket disconnected: user=${client.data?.userId ?? 'unknown'}`);
  }

  // ---------------------------------------------------------------------
  // Emit helpers - called by IncidentsService so all "who gets notified
  // about what" logic lives in one place.
  // ---------------------------------------------------------------------

  /** Notify the citizen who reported an incident that it changed. */
  notifyUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  /** Notify every user with a given role (e.g. all ADMINs on SLA breach). */
  notifyRole(role: Role, event: string, payload: unknown): void {
    this.server.to(`role:${role}`).emit(event, payload);
  }

  /** Notify workers/supervisors of a specific department (e.g. new assignment). */
  notifyDepartmentRole(departmentId: string, role: Role, event: string, payload: unknown): void {
    this.server.to(`dept:${departmentId}:${role}`).emit(event, payload);
  }

  /** Broadcast an incident update to everyone (used for the live map view). */
  broadcastIncidentUpdate(payload: unknown): void {
    this.server.emit('incidentUpdated', payload);
  }
}
