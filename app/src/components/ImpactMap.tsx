// ============================================================================
// "What are the consequences?" — flat world map, impact shading per country.
// No ocean data. Land in light gray; affected countries tinted with their
// expected weather anomaly (drought red, flooding blue, wetter light blue).
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";

interface CountryFeature {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry;
}

interface Zone {
  label: string;
  fill: string;
  opacity: number;
  ids: string[]; // ISO 3166-1 numeric
}

const ZONES: Zone[] = [
  {
    label: "drier than normal",
    fill: "#DC2626",
    opacity: 0.26,
    // Australia, Indonesia, Papua New Guinea, India, southern Africa,
    // Colombia and Venezuela
    ids: ["036", "360", "598", "356", "710", "716", "508", "894", "072", "516", "170", "862"],
  },
  {
    label: "heavy rain, flooding",
    fill: "#1D4ED8",
    opacity: 0.40,
    // Peru, Ecuador (Pacific coast of South America)
    ids: ["604", "218"],
  },
  {
    label: "wetter than normal",
    fill: "#60A5FA",
    opacity: 0.32,
    // Kenya, Somalia, Ethiopia (East Africa); Uruguay, Paraguay, Argentina
    // (southern South America)
    ids: ["404", "706", "231", "858", "600", "032"],
  },
];

const W = 880;
const H = 440;

const pad = (id: string) => id.padStart(3, "0");

export function ImpactMap() {
  const [countries, setCountries] = useState<CountryFeature[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((topo: any) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as {
          features: CountryFeature[];
        };
        setCountries(fc.features);
      })
      .catch(err => console.warn("[ImpactMap] world atlas:", err));
    return () => { cancelled = true; };
  }, []);

  const { landPaths, zonePaths } = useMemo(() => {
    if (!countries) return { landPaths: [], zonePaths: [] };
    const projection = d3.geoNaturalEarth1().fitExtent(
      [[10, 10], [W - 10, H - 10]],
      { type: "Sphere" } as any,
    );
    const path = d3.geoPath(projection);

    const zoneById = new Map<string, Zone>();
    ZONES.forEach(z => z.ids.forEach(id => zoneById.set(pad(id), z)));

    const landPaths: { d: string; zone?: Zone }[] = [];
    for (const c of countries) {
      const d = path(c as any);
      if (!d) continue;
      const zone = typeof c.id !== "undefined" ? zoneById.get(pad(String(c.id))) : undefined;
      landPaths.push({ d, zone });
    }
    return { landPaths, zonePaths: ZONES };
  }, [countries]);

  if (!countries) {
    return (
      <div className="mt-4 h-[300px] flex items-center justify-center text-sm text-gray-500">
        Loading base map…
      </div>
    );
  }

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="El Niño impact map">
        {landPaths.map((lp, i) => (
          <path
            key={i}
            d={lp.d}
            fill={lp.zone ? lp.zone.fill : "#F3F4F6"}
            fillOpacity={lp.zone ? lp.zone.opacity : 1}
            stroke="#D1D5DB"
            strokeWidth="0.5"
          />
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-700">
        {zonePaths.map(z => (
          <span key={z.label} className="inline-flex items-center gap-2">
            <span
              className="inline-block h-3 w-6"
              style={{ backgroundColor: z.fill, opacity: z.opacity }}
            />
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}
