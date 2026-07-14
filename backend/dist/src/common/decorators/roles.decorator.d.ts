import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: Role[]) => ReturnType<typeof SetMetadata>;
