// ============================================================================
// El Niño 2026 — live monitoring, newsroom layout.
// Facts first. Three question-led visualisations. No decoration.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { EnsoDashboardData, fetchLiveEnsoData, ComparisonEvent } from "./data";
import { AnomalyChart } from "./components/AnomalyChart";
import { ImpactMap } from "./components/ImpactMap";
import { OutlookChart } from "./components/OutlookChart";

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtSigned(v: number, digits = 1): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}°C`;
}

export default function App() {
  const [data, setData] = useState<EnsoDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetchLiveEnsoData();
    if (d) {
      setData(d);
      setError(null);
    } else {
      setError("The data file could not be loaded.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const d = data;
  const derived = useMemo(() => {
    if (!d) return null;
    const st = d.enso_status;
    const cur = d.current;
    const monthly = d.nino34_monthly;

    // --- previous record event (by peak ONI)
    const completed = d.comparison.events.filter((e: ComparisonEvent) => !e.active);
    const record = completed.reduce<ComparisonEvent | null>(
      (best, e) => (best === null || e.peak > best.peak ? e : best),
      null,
    );
    const refYear = record?.peak_year || 2015;

    // --- headline & lead (official facts only)
    const chanceRaw = st.probabilities?.very_strong_chance || null;
    const chance = chanceRaw ? (chanceRaw[0].toLowerCase() + chanceRaw.slice(1)) : null;
    const headline = chance
      ? `El Niño strengthens; ${chance} chance of a very strong event this winter`
      : `El Niño advisory active`;

    const monthlyLatest = monthly.length ? monthly[monthly.length - 1] : null;
    const monthlyPrev = monthly.length > 1 ? monthly[monthly.length - 2] : null;
    const mDelta =
      monthlyLatest && monthlyPrev ? monthlyLatest.value - monthlyPrev.value : null;
    const monthLab = monthlyLatest
      ? MONTH_FULL[new Date(monthlyLatest.date + "T00:00:00Z").getUTCMonth()]
      : "";
    const monthlyVal = monthlyLatest?.value ?? null;

    let lead = `The Niño-3.4 sea temperature anomaly reached ${monthlyVal !== null ? fmtSigned(monthlyVal) : "—"} in ${monthLab} 2026` +
      (mDelta !== null
        ? `, ${mDelta >= 0 ? "up" : "down"} ${Math.abs(mDelta).toFixed(1)}°C on the month before.`
        : ".");
    lead += ` The U.S. Climate Prediction Center puts the chance of a very strong El Niño this fall and winter ${chance || "high"}.`;

    // --- key figures
    const oni = cur.oni;
    const mei = cur.mei;
    const wwv = cur.wwv;
    const weekly = cur.nino34;
    const weeklyDate = weekly?.date
      ? `${new Date(weekly.date + "T00:00:00Z").getUTCDate()} ${MONTH_FULL[new Date(weekly.date + "T00:00:00Z").getUTCMonth()].slice(0, 3)}`
      : "";
    const thermo = d.subsurface_temp.thermocline_depth;
    let thermoVal: string | null = null;
    if (thermo?.length) {
      const last = thermo[thermo.length - 1];
      const lonIdx = d.subsurface_temp.lon.reduce(
        (best, lon, i) => (Math.abs(lon - 260) < Math.abs(d.subsurface_temp.lon[best] - 260) ? i : best),
        0,
      );
      if (last && last[lonIdx] != null) thermoVal = `${Math.round(last[lonIdx] as number)} m`;
    }

    // -- plain-language statements for a general audience;
    //    technical names stay, small, underneath.
    const statements = [
      {
        head: "Warmer than normal",
        value: monthlyVal !== null ? fmtSigned(monthlyVal) : "—",
        sub: `Sea temperature in the eastern Pacific, ${monthLab} 2026 (Niño-3.4 region)`,
      },
      {
        head: "Officially: El Niño - moderate and building",
        value: oni ? fmtSigned(oni.value, 2) : "—",
        sub: `3-month index, ${oni ? `${oni.season} ${oni.year}` : ""} (ONI)`,
      },
      {
        head: "Extra heat stored under the surface",
        value: wwv ? fmtSigned(wwv.value, 2) : "—",
        sub: `Upper 300 m of the eastern Pacific, ${wwv ? MONTH_FULL[new Date(wwv.date + "T00:00:00Z").getUTCMonth()] : ""} 2026 (warm water volume)`,
      },
    ];

    const techLine = [
      weekly ? `weekly index +${weekly.value.toFixed(1)}°C (${weeklyDate})` : null,
      mei ? `ocean heat index (MEI) ${mei.value >= 0 ? "+" : ""}${mei.value.toFixed(2)}` : null,
      thermoVal ? `warm-water ceiling ${thermoVal} at 100°W` : null,
    ].filter(Boolean).join(" · ");

    // --- chart 1 conclusion (same official series on both sides)
    const refSeries = new Map<number, number>();
    monthly.forEach(r => {
      const m = r.date.match(/^(\d{4})-(\d{2})/);
      if (m && parseInt(m[1], 10) === refYear) refSeries.set(parseInt(m[2], 10), r.value);
    });
    let cmpText = `${refYear} record-year comparison`;
    if (monthlyLatest) {
      const mIdx = new Date(monthlyLatest.date + "T00:00:00Z").getUTCMonth() + 1;
      const refVal = refSeries.get(mIdx);
      if (refVal !== undefined) {
        const diff = monthlyLatest.value - refVal;
        cmpText =
          diff >= 0
            ? `2026 runs ${Math.abs(diff).toFixed(1)}°C above the ${monthLab} ${refYear} value (${refYear}: strongest previous event)`
            : `2026 is ${Math.abs(diff).toFixed(1)}°C below the ${monthLab} ${refYear} value (${refYear}: strongest previous event)`;
      }
    }

    // --- statement: first two sentences only
    const synopsis = (st.synopsis || "").replace(/\s+/g, " ").trim();
    const sents = synopsis.split(/(?<=[.!?])\s+/).filter(Boolean);
    const quote = sents.slice(0, 2).join(" ") + (sents.length > 2 ? " …" : "");

    return { headline, lead, statements, techLine, refYear, cmpText, quote, st, monthly, currentYear: new Date(d.generated_at).getFullYear(),
             probs: d.enso_probabilities, generatedAt: d.generated_at };
  }, [d]);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading data…</p>
      </main>
    );
  }
  if (!data || !derived) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-base text-gray-900 font-semibold">{error || "No data available."}</p>
          <button onClick={() => load()} className="mt-4 border border-gray-300 px-4 py-2 text-sm font-medium hover:border-gray-900">
            Retry
          </button>
        </div>
      </main>
    );
  }

  const { st, monthly, currentYear, generatedAt } = derived;

  return (
    <main className="bg-white text-gray-900">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <article className="py-10">
          {/* headline + lead */}

          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {derived.headline}
          </h1>
          <p className="mt-6 max-w-3xl text-lg font-semibold leading-snug text-gray-900">
            {derived.lead}
          </p>

          {/* where things stand — plain language, technical names underneath */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Where things stand</h2>
            <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
              {derived.statements.map(st_ => (
                <div key={st_.head}>
                  <div className="h-[3px] w-6 bg-[#DC2626]" />
                  <div className="mt-3 text-xs text-gray-500">{st_.head}</div>
                  <div className="mt-1 text-3xl font-bold tracking-tight">{st_.value}</div>
                  <div className="mt-1 text-xs text-gray-400">{st_.sub}</div>
                </div>
              ))}
            </div>
            {derived.techLine && (
              <p className="mt-8 max-w-3xl text-xs text-gray-400">{derived.techLine}</p>
            )}
          </section>

          {/* 1 — how bad is it */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">How bad is it?</h2>
            <p className="mt-1 text-base text-gray-600">{derived.cmpText}</p>
            <AnomalyChart monthly={monthly} currentYear={currentYear} referenceYear={derived.refYear} />
            <p className="mt-3 max-w-3xl text-sm text-gray-500">
              Monthly Niño-3.4 anomaly, °C (official CPC ERSST series, 1991–2020 mean). {derived.refYear} was the strongest previous event.
            </p>
          </section>

          {/* 2 — what are the consequences */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">What are the consequences?</h2>
            <p className="mt-1 max-w-3xl text-base text-gray-600">
              Drought in Australia, Southeast Asia, India and southern Africa; heavy rain and flooding on the Pacific coast of South America; more rain in East Africa and southern South America.
              El Niño’s effect on Europe is weak and indirect, with no consistent seasonal signal.
            </p>
            <ImpactMap />
            <p className="mt-3 max-w-3xl text-sm text-gray-500">
              Well-documented El Niño effects (NOAA/IRI consensus). The precipitation model forecast is currently unavailable, so the zones are drawn schematically.
            </p>
          </section>

          {/* 3 — how long does this last */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">How long does this last?</h2>
            <p className="mt-1 text-base text-gray-600">
              100% probability of El Niño through January–March, easing to 97% in February–April.
            </p>
            <OutlookChart probabilities={derived.probs} generatedAt={generatedAt} />
            <p className="mt-3 max-w-3xl text-sm text-gray-500">
              Official NOAA CPC probability per three-month season, {st.issued}.
            </p>
          </section>

          {/* official statement */}
          <section className="mt-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Official statement</h2>
            <blockquote className="mt-6 max-w-3xl border-l-2 border-gray-900 pl-4 text-lg leading-relaxed text-gray-800">
              “{derived.quote}”
            </blockquote>
            <p className="mt-3 text-sm text-gray-500">
              NOAA Climate Prediction Center, {st.issued}.{" "}
              <a href={st.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-900">
                Full statement
              </a>
            </p>
          </section>
        </article>

        {/* footer */}
        <footer className="mt-16 border-t border-gray-200 py-8 text-sm text-gray-500">
          <p>
            Data: NOAA CPC · NOAA PSL · GODAS — updated twice a day.{" "}
            <a className="underline underline-offset-2" href="data.json">raw data</a> ·{" "}
            <a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml">official discussion</a> ·{" "}
            <a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/">model forecast</a>
          </p>
          <p className="mt-2 text-xs text-gray-400">Independent monitoring project, not affiliated with NOAA.</p>
        </footer>
      </div>
    </main>
  );
}
