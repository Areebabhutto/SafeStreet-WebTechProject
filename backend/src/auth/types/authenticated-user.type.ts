import { Role } from '@prisma/client';

/**
 * Shape of the user object attached to `request.user` after JwtStrategy
 * validates the access token. Kept intentionally minimal - anything else
 * needed should be fetched fresh from the DB to avoid stale-JWT-payload bugs
 * (e.g. a role change should take effect without waiting for token refresh
 * in critical paths, so services re-check `isActive`/role from DB where it
 * matters for authorization-sensitive writes).
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
  departmentId: string | null;
}

/** Payload encoded inside JWT access/refresh tokens. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
  departmentId: string | null;
}
