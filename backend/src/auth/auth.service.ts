import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/authenticated-user.type';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  departmentId: string | null;
}

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Registers a new user, hashing their password before persisting. */
  async register(dto: RegisterDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role ?? Role.CITIZEN,
        departmentId: dto.departmentId,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.departmentId);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`New user registered: ${user.email} (${user.role})`);
    return { user: this.toSafeUser(user), tokens };
  }

  /** Validates credentials and issues a fresh token pair. */
  async login(dto: LoginDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.departmentId);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    await this.prisma.auditLog.create({
      data: { action: 'LOGIN', actorId: user.id },
    });

    return { user: this.toSafeUser(user), tokens };
  }

  /**
   * Exchanges a valid, non-revoked refresh token for a new token pair
   * (refresh-token rotation - the old one is invalidated immediately).
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const matches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!matches) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.departmentId);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  /** Invalidates the stored refresh token so it can no longer be used. */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  private async issueTokens(
    userId: string,
    email: string,
    role: Role,
    departmentId: string | null,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role, departmentId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRY', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    departmentId: string | null;
  }): SafeUser {
    // Strips passwordHash/hashedRefreshToken before sending to the client.
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId,
    };
  }
}
