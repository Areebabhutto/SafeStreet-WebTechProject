import { IncidentStatus } from '@prisma/client';
export declare class UpdateIncidentStatusDto {
    status: IncidentStatus;
    note?: string;
    imageUrl?: string;
}
