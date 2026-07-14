export declare function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number;
export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}
export declare function computeBoundingBox(latitude: number, longitude: number, radiusMeters: number): BoundingBox;
