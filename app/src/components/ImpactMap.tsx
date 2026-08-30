// ============================================================================
// "What are the consequences?" — interactive flat world map. Every country is
// shaded by its expected El Niño effect (documented signal or, honestly,
// "little change"). Hover a country for its specific outlook.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import { CATEGORY_META, impactFor } from "../impact";
import { msg, useI18n } from "../i18n";

interface CountryFeature {
  type: "Feature";
  id?: string | number;
  properties: { name?: string } & Record<string, unknown>;
  geometry: GeoJSON.Geometry;
}

interface HoverState {
  name: string;
  phrase: string;
  category: string;
  x: number;
  y: number;
}

const W = 880;
const H = 440;

const CAT_KEY: Record<string, string> = {
  drought: "catDrought", flood: "catFlood", wetter: "catWet", muted: "catMuted",
};
const TIP_KEY: Record<string, string> = {
  drought: "tipDrought", flood: "tipFlood", wetter: "tipWet", muted: "tipMuted",
};

export function ImpactMap() {
  const { lang, t } = useI18n();
  const [countries, setCountries] = useState<CountryFeature[] | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((topo: any) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as { features: CountryFeature[] };
        setCountries(fc.features);
      })
      .catch(err => console.warn("[ImpactMap] world atlas:", err));
    return () => { cancelled = true; };
  }, []);

  const shapes = useMemo(() => {
    if (!countries) return [];
    const projection = d3.geoNaturalEarth1().fitExtent(
      [[10, 10], [W - 10, H - 10]],
      { type: "Sphere" } as any,
    );
    const path = d3.geoPath(projection);
    return countries.map(c => {
      const d = path(c as any);
      if (!d) return null;
      const info = impactFor(c.id);
      const meta = CATEGORY_META[info.category];
      return { d, id: c.id, name: c.properties.name || "Unknown", info, meta };
    }).filter(Boolean) as {
      d: string; id?: string | number; name: string; info: ReturnType<typeof impactFor>; meta: typeof CATEGORY_META.drought;
    }[];
  }, [countries]);

  if (!countries) {
    return (
      <div className="mt-4 h-[300px] flex items-center justify-center text-sm text-gray-500">
        {msg(t, "loadingMap")}
      </div>
    );
  }

  return (
    <div className="mt-4 relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Interactive map of expected El Niño effects per country"
        onMouseLeave={() => setHover(null)}
      >
        {shapes.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill={s.meta.fill}
            fillOpacity={s.meta.opacity}
            stroke="#D1D5DB"
            strokeWidth="0.5"
            className="cursor-pointer transition-[filter] duration-75 hover:brightness-95"
            onMouseMove={e => {
              const rect = svgRef.current?.getBoundingClientRect();
              if (!rect) return;
              setHover({
                name: s.name,
                phrase: lang === "en" ? s.info.phrase : msg(t, TIP_KEY[s.info.category]),
                category: msg(t, CAT_KEY[s.info.category]),
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
          />
        ))}
      </svg>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute max-w-xs border border-gray-200 bg-white px-3 py-2 shadow-sm"
          style={{ left: `${Math.min(hover.x, 82)}%`, top: `${Math.max(hover.y - 12, 2)}%`, transform: "translateY(-100%)" }}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
            <span
              className="inline-block h-2.5 w-2.5"
              style={{ backgroundColor: hover.category === msg(t, "catMuted") ? "#E5E7EB" : (hover.category === msg(t, "catDrought") ? "#DC2626" : hover.category === msg(t, "catFlood") ? "#1D4ED8" : "#60A5FA") }}
            />
            {hover.name}
          </div>
          <p className="mt-1 text-xs leading-snug text-gray-600">{hover.phrase}</p>
        </div>
      )}

      {/* legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-8 gap-y-1 text-xs text-gray-700">
        {(["drought", "flood", "wetter", "muted"] as const).map(cat => (
          <span key={cat} className="inline-flex items-center gap-2">
            <span
              className="inline-block h-3 w-6 border border-gray-200"
              style={{ backgroundColor: CATEGORY_META[cat].fill, opacity: CATEGORY_META[cat].opacity }}
            />
            {msg(t, CAT_KEY[cat])}
          </span>
        ))}
      </div>

    </div>
  );
}
