// ============================================================================
// "Where the measurements come from" — flat source diagram: the Niño-3.4
// region and the TAO/TRITON mooring array that measures the ocean.
// Static geometry (public PMEL/NDBC positions), no data retrieval.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";

const W = 880;
const H = 360;

// TAO/TRITON mooring positions (lon, lat) — equatorial array + meridional legs
const MOORINGS: [number, number][] = [
  [147, 0], [156, 0], [165, 0], [180, 0], [190, 0], [205, 0], [220, 0], [235, 0], [250, 0], [265, 0],
  [165, 5], [165, -5], [180, 5], [180, -5], [205, 5], [205, -5], [220, 5], [220, -5],
  [235, 5], [235, -5], [250, 5], [250, -5], [265, 5], [265, -5],
];

// Niño-3.4 box: 5°S–5°N, 170°W–120°W

export function SourceMap() {
  const [landPath, setLandPath] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((topo: any) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection;
        const projection = d3.geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: "Sphere" } as any);
        setLandPath(d3.geoPath(projection)(fc as any) || "");
      })
      .catch(err => console.warn("[SourceMap]", err));
    return () => { cancelled = true; };
  }, []);

  const { box, dots } = useMemo(() => {
    const projection = d3.geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: "Sphere" } as any);
    // Niño-3.4 region as a projected pixel rectangle (robust; no geo-path quirks)
    const nw = projection([190, 5]);
    const se = projection([240, -5]);
    const box = nw && se
      ? { x: nw[0], y: nw[1], w: se[0] - nw[0], h: se[1] - nw[1] }
      : null;
    const dots = MOORINGS.map(([lon, lat]) => {
      const pt = projection([lon, lat]);
      return pt ? { x: pt[0], y: pt[1] } : null;
    }).filter(Boolean) as { x: number; y: number }[];
    return { box, dots };
  }, []);

  return (
    <div className="mt-8">
      <h3 className="text-base font-bold">Where the numbers come from</h3>
      {!landPath ? (
        <div className="mt-3 h-[220px] flex items-center text-sm text-gray-500">Loading map…</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full h-auto" role="img" aria-label="Measurement network map">
          <path d={landPath} fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="0.6" />
          {box && (
            <rect
              x={box.x} y={box.y} width={box.w} height={box.h}
              fill="none" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="5,3"
            />
          )}
          {dots.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.6" fill="#111827" />
          ))}
          {/* labels */}
          <text x={215} y={30} fontSize="11" fontWeight="700" fill="#B91C1C" textAnchor="middle" fontFamily="inherit">
            Niño-3.4 region
          </text>
          <text x={300} y={H - 24} fontSize="10" fill="#6B7280" fontFamily="inherit">
            TAO/TRITON moorings — the floating measuring stations that sample the Pacific
          </text>
        </svg>
      )}
    </div>
  );
}
