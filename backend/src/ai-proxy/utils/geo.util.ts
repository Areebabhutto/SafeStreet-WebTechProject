/**
 * Geospatial helper functions used by the Duplicate Detector.
 *
 * We use a bounding-box PRE-filter (cheap, index-friendly, done in the SQL
 * WHERE clause via Prisma) followed by an exact Haversine distance check
 * (accurate, done in JS) rather than a full PostGIS `ST_DWithin` query. This
 * keeps the Prisma schema portable (plain Decimal columns) while still being
 * performant, since the bounding box lets the DB index narrow candidates
 * before we do the more expensive trig in application code.
 */

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Computes a bounding box of `radiusMeters` around a point. Used to build a
 * cheap Prisma `WHERE latitude BETWEEN ... AND longitude BETWEEN ...` filter
 * before doing exact Haversine math on the (small) result set.
 */
export function computeBoundingBox(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): BoundingBox {
  // ~111,320 meters per degree of latitude (roughly constant).
  const latDelta = radiusMeters / 111320;
  // Degrees per meter of longitude shrinks as you move away from the equator.
  const lngDelta = radiusMeters / (111320 * Math.cos(toRadians(latitude)) || 1);

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };
}
