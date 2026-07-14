import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
declare class UpdateUserDto {
    role?: Role;
    departmentId?: string;
    isActive?: boolean;
}
export declare class UsersController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(role?: Role, departmentId?: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        department: {
            name: string;
            code: string;
        } | null;
        email: string;
        fullName: string;
        phone: string | null;
        role: import(".prisma/client").$Enums.Role;
        departmentId: string | null;
        isActive: boolean;
    }[]>;
    update(id: string, dto: UpdateUserDto): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        email: string;
        fullName: string;
        role: import(".prisma/client").$Enums.Role;
        departmentId: string | null;
        isActive: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
export {};
