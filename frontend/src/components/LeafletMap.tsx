// =============================================================================
// LeafletMap — renders incidents as markers colored by priority/status, with
// an optional heatmap overlay (via leaflet.heat) for hotspot visualization.
// Markers are clickable and surface a popup with key incident info.
// =============================================================================
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { Incident } from '../types';
import { PRIORITY_COLORS, formatStatusLabel, formatCategoryLabel } from '../lib/uiHelpers';

interface LeafletMapProps {
  incidents: Incident[];
  /** Show a density heatmap layer (weighted toward higher priority incidents). */
  showHeatmap?: boolean;
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMarkerClick?: (incident: Incident) => void;
}

/** Internal sub-component: draws the leaflet.heat layer onto the parent map instance. */
function HeatmapLayer({ incidents }: { incidents: Incident[] }): null {
  const map = useMap();

  useEffect(() => {
    if (incidents.length === 0) return;

    const weightByPriority: Record<string, number> = { LOW: 0.3, MEDIUM: 0.5, HIGH: 0.75, CRITICAL: 1 };
    const points: [number, number, number][] = incidents.map((i) => [
      i.latitude,
      i.longitude,
      weightByPriority[i.priority] ?? 0.5,
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heatLayer = (L as any).heatLayer(points, { radius: 30, blur: 20, maxZoom: 17 });
    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [incidents, map]);

  return null;
}

export default function LeafletMap({
  incidents,
  showHeatmap = false,
  center,
  zoom = 13,
  height = '500px',
  onMarkerClick,
}: LeafletMapProps) {
  const defaultCenter = useMemo<[number, number]>(() => {
    if (center) return center;
    if (incidents.length > 0) return [incidents[0].latitude, incidents[0].longitude];
    return [37.7749, -122.4194]; // fallback: San Francisco
  }, [center, incidents]);

  const markerRadiusByPriority: Record<string, number> = { LOW: 6, MEDIUM: 8, HIGH: 10, CRITICAL: 13 };

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-slate-200">
      <MapContainer center={defaultCenter} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showHeatmap && <HeatmapLayer incidents={incidents} />}

        {!showHeatmap &&
          incidents.map((incident) => (
            <CircleMarker
              key={incident.id}
              center={[incident.latitude, incident.longitude]}
              radius={markerRadiusByPriority[incident.priority] ?? 8}
              pathOptions={{
                color: PRIORITY_COLORS[incident.priority],
                fillColor: PRIORITY_COLORS[incident.priority],
                fillOpacity: incident.slaBreached ? 1 : 0.6,
                weight: incident.slaBreached ? 3 : 1,
              }}
              eventHandlers={{
                click: () => onMarkerClick?.(incident),
              }}
            >
              <Popup>
                <div className="text-sm space-y-1 max-w-[220px]">
                  <p className="font-semibold">{incident.title}</p>
                  <p className="text-slate-600">{formatCategoryLabel(incident.category)}</p>
                  <p>
                    <span className="font-medium">Priority:</span> {incident.priority}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span> {formatStatusLabel(incident.status)}
                  </p>
                  {incident.slaBreached && (
                    <p className="text-red-600 font-semibold">⚠ SLA breached</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>
    </div>
  );
}
