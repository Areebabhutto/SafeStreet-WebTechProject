import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from './types/authenticated-user.type';

/**
 * Validates the `Authorization: Bearer <token>` header against
 * JWT_ACCESS_SECRET. On success, `validate()`'s return value becomes
 * `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Re-verify the user still exists and is active on every request. This
    // is a small DB hit but closes the "deactivated user still has a valid
    // token" gap that pure-JWT stateless auth otherwise leaves open.
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is inactive or no longer exists');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    };
  }
}
