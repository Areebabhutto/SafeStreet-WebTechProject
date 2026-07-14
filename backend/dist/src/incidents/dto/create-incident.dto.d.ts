export declare class CreateIncidentDto {
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    address?: string;
    imageUrl?: string;
    confirmedNotDuplicate?: boolean;
}
