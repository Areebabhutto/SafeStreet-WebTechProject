import { PrismaService } from '../prisma/prisma.service';
declare class UpsertDepartmentDto {
    name: string;
    code: string;
    description?: string;
}
export declare class DepartmentsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        code: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(dto: UpsertDepartmentDto): import(".prisma/client").Prisma.Prisma__DepartmentClient<{
        id: string;
        name: string;
        code: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, dto: Partial<UpsertDepartmentDto>): import(".prisma/client").Prisma.Prisma__DepartmentClient<{
        id: string;
        name: string;
        code: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__DepartmentClient<{
        id: string;
        name: string;
        code: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
export {};
