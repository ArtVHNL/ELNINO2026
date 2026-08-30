// ============================================================================
// El Niño 2026 — live monitoring, newsroom layout.
// Flat, white, print-style. Facts first; three functional visualisations only.
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
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
      setError("The data file could not be loaded. Try again in a minute.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 60 * 1000); // hourly refresh
    return () => clearInterval(t);
  }, [load]);

  const d = data;
  const derived = useMemo(() => {
    if (!d) return null;
    const st = d.enso_status;
    const cur = d.current;
    const monthly = d.nino34_monthly;

    // --- previous record year: strongest completed event before the current one
    const completed = d.comparison.events.filter((e: ComparisonEvent) => !e.active);
    const record = completed.reduce<ComparisonEvent | null>(
      (best, e) => (best === null || e.peak > best.peak ? e : best),
      null,
    );
    const refYear = record?.peak_year || (record ? parseInt(record.label.slice(0, 4), 10) || 2015 : 2015);

    // --- headline & lead facts
    const chanceRaw = st.probabilities?.very_strong_chance || null;
    const chance = chanceRaw ? (chanceRaw[0].toLowerCase() + chanceRaw.slice(1)) : null;
    const headline = chance
      ? `El Niño strengthens; ${chance} chance of a very strong event this winter`
      : `El Niño advisory active; ${st.advisory}`;

    const weekly = cur.nino34;
    const weeklyDate = weekly?.date ? formatDate(weekly.date) : null;

    // Single official monthly series (CPC OI-SST) drives the lead, facts and chart
    const monthlyLatest = monthly.length ? monthly[monthly.length - 1] : null;
    const monthlyPrev = monthly.length > 1 ? monthly[monthly.length - 2] : null;
    const mDelta =
      monthlyLatest && monthlyPrev
        ? monthlyLatest.value - monthlyPrev.value
        : null;
    const monthLab = monthlyLatest
      ? MONTH_FULL[new Date(monthlyLatest.date + "T00:00:00Z").getUTCMonth()]
      : "the latest month";
    const monthlyVal = monthlyLatest?.value ?? null;
    const monthlyDateLab = monthlyLatest ? formatDate(monthlyLatest.date) : null;

    let lead =
      `Niño-3.4 sea temperature anomaly stood at ${monthlyVal !== null ? fmtSigned(monthlyVal) : "—"} in ${monthLab} 2026` +
      (mDelta !== null
        ? `, ${mDelta >= 0 ? "up" : "down"} ${Math.abs(mDelta).toFixed(1)}°C on the month before`
        : "") +
      (weekly ? `; the weekly index reached ${fmtSigned(weekly.value)} on ${weeklyDate}.` : ".");
    lead +=
      ` The U.S. Climate Prediction Center keeps an El Niño Advisory (${st.issued}) and estimates ${chance || "a high"} chance of a very strong event in fall and winter 2026-27.`;

    // --- facts grid
    const oni = cur.oni;
    const mei = cur.mei;
    const wwv = cur.wwv;
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

    const facts = [
      { label: `Niño-3.4 anomaly · monthly · ${monthLab}`, value: monthlyVal !== null ? fmtSigned(monthlyVal) : "—", source: `NOAA CPC · ${monthlyDateLab || ""}` },
      { label: "Niño-3.4 anomaly · weekly", value: weekly ? fmtSigned(weekly.value) : "—", source: `NOAA CPC · ${weeklyDate || ""}` },
      { label: `ONI · ${oni ? `${oni.season} ${oni.year}` : ""}`, value: oni ? fmtSigned(oni.value, 2) : "—", source: "NOAA CPC" },
      { label: "MEI v2 · July 2026", value: mei ? (mei.value >= 0 ? "+" : "") + mei.value.toFixed(2) : "—", source: "NOAA PSL" },
      { label: "Warm water volume · July 2026", value: wwv ? fmtSigned(wwv.value, 2) : "—", source: "GODAS (derived)" },
      { label: "Thermocline depth · 100°W", value: thermoVal ?? "—", source: "GODAS (derived)" },
    ];

    // --- chart 1 conclusion (data-driven title)
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
            ? `Niño-3.4 anomaly: 2026 runs ${Math.abs(diff).toFixed(1)}°C above the ${monthLab} ${refYear} value (${refYear} was the strongest previous event)`
            : `Niño-3.4 anomaly: 2026 is ${Math.abs(diff).toFixed(1)}°C below the ${monthLab} ${refYear} value (${refYear} was the strongest previous event)`;
      }
    }

    // --- current season prob for the headline facts
    const nextProb = d.enso_probabilities?.[0];

    return { headline, lead, facts, refYear, cmpText, nextProb,
             st, cur, monthly, weekly, currentYear: new Date(d.generated_at).getFullYear(),
             probs: d.enso_probabilities, sources: d.sources, generatedAt: d.generated_at };
  }, [d]);

  // ---------- loading / error states (no hooks below this point) ----------
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
          <button
            onClick={() => load()}
            className="mt-4 border border-gray-300 px-4 py-2 text-sm font-medium hover:border-gray-900"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const { st, cur, monthly, currentYear, generatedAt } = derived;

  return (
    <main className="bg-white text-gray-900">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* masthead */}
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-gray-200 py-4">
          <span className="text-xs font-extrabold uppercase tracking-[0.2em]">El Niño 2026 — Live monitoring</span>
          <span className="text-xs text-gray-500">
            Updated {formatDate(generatedAt)} · NOAA CPC · NOAA PSL · GODAS
          </span>
        </header>

        <article className="py-10">
          {/* headline */}
          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {derived.headline}
          </h1>
          <p className="mt-6 max-w-3xl text-lg font-semibold leading-snug text-gray-900">
            {derived.lead}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
            <span>Published {formatDate(generatedAt)}</span>
            {st.issued && <span>Official statement: {st.issued}</span>}
            {st.next_discussion && <span>Next official update: {st.next_discussion}</span>}
            <span>Sources live: {Object.values(derived.sources).filter(s => s === "live").length} of 12</span>
            <button onClick={() => load()} className="underline underline-offset-2 hover:text-gray-900">
              Refresh
            </button>
          </div>

          {/* current state facts */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-500">Current state</h2>
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-3">
              {derived.facts.map(f => (
                <div key={f.label}>
                  <div className="h-[3px] w-6 bg-[#DC2626]" />
                  <div className="mt-3 text-xs uppercase tracking-wide text-gray-500">{f.label}</div>
                  <div className="mt-1 text-3xl font-bold tracking-tight">{f.value}</div>
                  <div className="mt-1 text-xs text-gray-500">{f.source}</div>
                </div>
              ))}
            </div>
          </section>

          {/* chart 1: how bad is it */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-bold tracking-tight">{derived.cmpText}</h2>
            <AnomalyChart monthly={monthly} currentYear={currentYear} referenceYear={derived.refYear} />
            <p className="mt-3 max-w-3xl text-sm text-gray-600">
              Monthly Niño-3.4 sea surface temperature anomaly, °C (CPC OI-SST, 1971–2000 base).
              The official diagnostic discussion quotes ERSST-based anomalies (+1.4 °C for July) — both are
              official NOAA products with different baselines.
              The {derived.refYear} series is the strongest previous event on record; 2026 is tracked through {new Date(generatedAt).getMonth() === 0 ? "January" : MONTH_FULL[Math.min(new Date(generatedAt).getMonth(), 11) - 1]}.
              Source: NOAA CPC (sstoi.indices).
            </p>
          </section>

          {/* chart 2: consequences */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-bold tracking-tight">Wetter shift: drought in Australia and Indonesia, flooding on the Pacific coast of South America</h2>
            <ImpactMap />
            <p className="mt-3 max-w-3xl text-sm text-gray-600">
              Canonical land impacts of an active El Niño (NOAA/IRI consensus patterns). Zones show the
              expected weather anomaly, not ocean data.
              The NMME precipitation model forecast is temporarily inaccessible (IRI data library now
              requires login); the pipeline flags this block as fallback. Zone extent is schematic.
            </p>
          </section>

          {/* chart 3: how long */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-bold tracking-tight">
              El Niño persists at {derived.nextProb ? `${derived.nextProb.el_nino}%` : "high"} probability through spring 2027
            </h2>
            <OutlookChart probabilities={derived.probs} generatedAt={generatedAt} />
            <p className="mt-3 max-w-3xl text-sm text-gray-600">
              Official NOAA CPC probability of El Niño per three-month season, published with the ENSO
              Diagnostic Discussion of {st.issued}. Next update: {st.next_discussion}.
            </p>
          </section>

          {/* what this means (canonical, dry) */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-500">What this means</h2>
            <ul className="mt-6 space-y-6 max-w-3xl">
              <li className="border-l-2 border-gray-200 pl-4">
                <h3 className="text-base font-bold">Australia and Indonesia: below-normal rainfall</h3>
                <p className="mt-1 text-base leading-relaxed text-gray-700">
                  Convection moves east of the Maritime Continent. Dry spells typically peak in September–November.
                </p>
              </li>
              <li className="border-l-2 border-gray-200 pl-4">
                <h3 className="text-base font-bold">Peru and Ecuador: heavy rainfall and flooding</h3>
                <p className="mt-1 text-base leading-relaxed text-gray-700">
                  Coastal rainfall above normal during December–February by historical pattern.
                </p>
              </li>
              <li className="border-l-2 border-gray-200 pl-4">
                <h3 className="text-base font-bold">Southern United States: wetter, cooler</h3>
                <p className="mt-1 text-base leading-relaxed text-gray-700">
                  A displaced subtropical jet stream brings above-normal winter precipitation from California
                  to the Gulf coast.
                </p>
              </li>
              <li className="border-l-2 border-gray-200 pl-4">
                <h3 className="text-base font-bold">East Africa: above-normal short rains</h3>
                <p className="mt-1 text-base leading-relaxed text-gray-700">
                  Wet conditions are typical in October–December during El Niño years.
                </p>
              </li>
            </ul>
          </section>

          {/* official statement verbatim */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-500">Official statement</h2>
            <blockquote className="mt-6 max-w-3xl border-l-2 border-gray-900 pl-4 text-lg leading-relaxed text-gray-800">
              “{st.synopsis || "No synopsis available."}”
            </blockquote>
            <p className="mt-3 max-w-3xl text-sm text-gray-500">
              NOAA Climate Prediction Center, ENSO Diagnostic Discussion, {st.issued}.{" "}
              <a href={st.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-900">
                Full discussion
              </a>
            </p>
          </section>

          {/* comparison */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-500">Previous record events</h2>
            <table className="mt-6 w-full max-w-3xl text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 font-semibold">Event</th>
                  <th className="py-2 font-semibold">Peak ONI</th>
                  <th className="py-2 font-semibold">Category</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...data.comparison.events].reverse().slice(0, 5).map(ev => (
                  <tr key={`${ev.label}-${ev.peak_season}`} className="border-b border-gray-100">
                    <td className="py-2.5 font-semibold">{ev.label}</td>
                    <td className="py-2.5">+{ev.peak.toFixed(2)}°C</td>
                    <td className="py-2.5">{ev.category}</td>
                    <td className="py-2.5">{ev.active ? "Active now" : "Past"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 max-w-3xl text-sm text-gray-600">
              ONI = 3-month running mean of Niño-3.4 anomaly; events detected automatically from the full
              CPC ONI series (1950–present). Source: NOAA CPC.
            </p>
          </section>
        </article>

        {/* footer / sources */}
        <footer className="border-t border-gray-200 py-8 text-sm">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-500">Sources</h2>
          <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-gray-600 md:grid-cols-2">
            <li><a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml">NOAA CPC — ENSO Diagnostic Discussion</a></li>
            <li><a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/">NOAA CPC — ENSO probabilities</a></li>
            <li><a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices">NOAA CPC — Niño region indices</a></li>
            <li><a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://psl.noaa.gov/enso/mei/data/meiv2.data">NOAA PSL — MEI v2</a></li>
            <li><a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://psl.noaa.gov/thredds/dodsC/Datasets/godas/pottmp.2026.nc">NOAA PSL — GODAS ocean fields</a></li>
            <li><a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/">IRI — ENSO forecast (plume figure)</a></li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <a className="underline underline-offset-2" href="data.json">data.json</a>
            <a className="underline underline-offset-2" href="meta.json">meta.json (data health)</a>
            <span>Automatically updated twice daily (06:00 and 18:00 UTC).</span>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Independent monitoring project. Data by NOAA/PSL/IRI. Three blocks — model plume table, 850-hPa
            wind field and NMME precipitation forecast — are fallback placeholders until those sources
            reopen anonymous access; they are flagged as such in the pipeline and are not presented as
            measurements.
          </p>
        </footer>
      </div>
    </main>
  );
}
