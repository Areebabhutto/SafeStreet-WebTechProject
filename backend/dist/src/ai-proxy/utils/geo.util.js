"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineDistanceMeters = haversineDistanceMeters;
exports.computeBoundingBox = computeBoundingBox;
const EARTH_RADIUS_METERS = 6371000;
function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
}
function computeBoundingBox(latitude, longitude, radiusMeters) {
    const latDelta = radiusMeters / 111320;
    const lngDelta = radiusMeters / (111320 * Math.cos(toRadians(latitude)) || 1);
    return {
        minLat: latitude - latDelta,
        maxLat: latitude + latDelta,
        minLng: longitude - lngDelta,
        maxLng: longitude + lngDelta,
    };
}
//# sourceMappingURL=geo.util.js.map