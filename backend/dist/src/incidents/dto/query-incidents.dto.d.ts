import { IncidentCategory, IncidentPriority, IncidentStatus } from '@prisma/client';
export declare class QueryIncidentsDto {
    status?: IncidentStatus;
    priority?: IncidentPriority;
    category?: IncidentCategory;
    departmentId?: string;
    dateFrom?: string;
    dateTo?: string;
    assignedToId?: string;
}
