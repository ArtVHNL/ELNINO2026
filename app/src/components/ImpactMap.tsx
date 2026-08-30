// ============================================================================
// "What are the consequences?" — abstract flat world map showing concrete
// land impacts of the active El Niño (drought / flooding), not ocean data.
// Land in light gray, impact zones as flat color patches, zone labels.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";

interface Zone {
  name: string;
  fill: string;
  opacity: number;
  polygon: [number, number][];
}

// Canonical El Niño land impacts (NOAA/IRI consensus patterns)
const ZONES: Zone[] = [
  {
    name: "Drought: Australia",
    fill: "#DC2626",
    opacity: 0.22,
    polygon: [[112.0, -44.0], [154.0, -44.0], [154.0, -11.0], [112.0, -11.0]],
  },
  {
    name: "Drought: Indonesia–Papua",
    fill: "#DC2626",
    opacity: 0.22,
    polygon: [[95.0, -9.0], [141.0, -9.0], [141.0, 6.0], [95.0, 6.0]],
  },
  {
    name: "Flooding: Peru–Ecuador",
    fill: "#1D4ED8",
    opacity: 0.38,
    polygon: [[-82.0, -16.0], [-70.0, -16.0], [-70.0, 3.0], [-82.0, 3.0]],
  },
  {
    name: "Above-normal rain: southern US",
    fill: "#60A5FA",
    opacity: 0.30,
    polygon: [[-125.0, 24.0], [-85.0, 24.0], [-85.0, 37.0], [-125.0, 37.0]],
  },
  {
    name: "Above-normal rain: East Africa",
    fill: "#60A5FA",
    opacity: 0.30,
    polygon: [[30.0, -12.0], [50.0, -12.0], [50.0, 6.0], [30.0, 6.0]],
  },
];

const W = 880;
const H = 460;

export function ImpactMap() {
  const [world, setWorld] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((topo: unknown) => {
        if (cancelled) return;
        const topoAny = topo as any;
        const fc = feature(topoAny, topoAny.objects.land) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry>;
        setWorld(fc);
      })
      .catch(err => console.warn("[ImpactMap] world atlas:", err));
    return () => { cancelled = true; };
  }, []);

  const { landPath, zonePaths, projection } = useMemo(() => {
    const projection = d3.geoNaturalEarth1().fitExtent(
      [[10, 10], [W - 10, H - 10]],
      { type: "Sphere" } as any,
    );
    const path = d3.geoPath(projection);
    const landPath = world ? path(world as any) : "";
    const zonePaths = ZONES.map(z => ({
      ...z,
      d: path({ type: "Polygon", coordinates: [z.polygon.map(([lon, lat]) => [lon, lat])] } as any) || "",
    }));
    return { landPath, zonePaths, projection };
  }, [world]);

  return (
    <div className="mt-4">
      {!world ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-gray-500">
          Loading base map…
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="El Niño impact map">
          {/* graticule: extremely light, functional only */}
          <g>
            {d3.range(-60, 61, 30).map(lat => {
              const y = projection([0, lat] as [number, number])?.[1];
              if (y === undefined) return null;
              return <line key={`lat${lat}`} x1={0} x2={W} y1={y} y2={y} stroke="#F3F4F6" strokeWidth="1" />;
            })}
          </g>
          <path d={landPath} fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="0.6" />
          {zonePaths.map(z => (
            <path key={z.name} d={z.d} fill={z.fill} fillOpacity={z.opacity} stroke="none" />
          ))}
          {zonePaths.map(z => {
            const [lon, lat] = z.polygon.reduce(
              (acc, p) => [acc[0] + p[0] / z.polygon.length, acc[1] + p[1] / z.polygon.length] as [number, number],
              [0, 0] as [number, number],
            );
            const pt = projection([lon, lat]);
            if (!pt) return null;
            const isRed = z.fill === "#DC2626";
            return (
              <text
                key={`${z.name}-label`}
                x={pt[0]}
                y={pt[1]}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill={isRed ? "#B91C1C" : "#1E3A8A"}
                fontFamily="inherit"
              >
                {z.name}
              </text>
            );
          })}
        </svg>
      )}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-700">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-6 bg-[#DC2626]/25" /> drought risk
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-6 bg-[#1D4ED8]/40" /> flooding risk
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-6 bg-[#60A5FA]/30" /> above-normal rainfall
        </span>
      </div>
    </div>
  );
}
