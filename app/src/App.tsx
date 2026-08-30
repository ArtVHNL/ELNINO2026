// ============================================================================
// El Niño 2026 — live monitoring, newsroom layout.
// Facts first. Three question-led visualisations. No decoration.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { EnsoDashboardData, fetchLiveEnsoData, ComparisonEvent } from "./data";
import { AnomalyChart } from "./components/AnomalyChart";
import { ImpactMap } from "./components/ImpactMap";
import { OutlookChart, buildOutlookRows, OutlookRow } from "./components/OutlookChart";
import { PredictedChart } from "./components/PredictedChart";

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function outlookSummary(rows: OutlookRow[]): string {
  if (rows.length === 0) return "No official probability forecast published.";
  const full = rows.filter(r => r.el_nino === 100);
  const easing = rows.find(r => r.el_nino < 100);
  if (full.length === rows.length) return `100% probability of El Niño through ${full[full.length - 1].label}.`;
  if (easing && full.length > 0) {
    return `100% probability of El Niño through ${full[full.length - 1].label}, easing to ${easing.el_nino}% in ${easing.label}.`;
  }
  return `Probability peaks at ${rows[0].el_nino}% (${rows[0].label}).`;
}

function chancePhrase(st: { probabilities?: Record<string, string> }): string {
  const raw = st.probabilities?.very_strong_chance || "greater than 90%";
  const lower = raw[0].toLowerCase() + raw.slice(1);
  return lower;
}

function derivedCurOni(d: EnsoDashboardData): number {
  return d.current.oni?.value ?? 1.39;
}

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
      ? `El Niño strengthens; a very strong event is expected this winter`
      : `El Niño advisory active`;

    const monthlyLatest = monthly.length ? monthly[monthly.length - 1] : null;
    const monthlyPrev = monthly.length > 1 ? monthly[monthly.length - 2] : null;
    const mDelta =
      monthlyLatest && monthlyPrev ? monthlyLatest.value - monthlyPrev.value : null;
    const monthLab = monthlyLatest
      ? MONTH_FULL[new Date(monthlyLatest.date + "T00:00:00Z").getUTCMonth()]
      : "";
    const monthlyVal = monthlyLatest?.value ?? null;

    const lead = "";  // replaced by the official statement as the intro

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
    // absolute sea temperature NOW (official ERSST series) with °F for general readers
    const sstNow = d.nino34_sst_monthly?.length
      ? d.nino34_sst_monthly[d.nino34_sst_monthly.length - 1]
      : null;
    const sstNowLab = sstNow ? `${sstNow.value.toFixed(1)}°C (${((sstNow.value * 9) / 5 + 32).toFixed(1)}°F)` : "—";

    const statements = [
      {
        head: "Warmer than normal",
        value: monthlyVal !== null ? fmtSigned(monthlyVal) : "—",
        sub: `Eastern Pacific now ${sstNowLab} · ${monthLab} 2026 (Niño-3.4 region)`,
      },
      {
        head: "Officially: a moderate El Niño",
        value: oni ? fmtSigned(oni.value, 2) : "—",
        sub: `3-month index, May–July 2026 (ONI)`,
      },
      {
        head: "Extra heat stored below the surface",
        value: wwv ? fmtSigned(wwv.value, 2) : "—",
        sub: `Warm water volume, July 2026 (upper 300 m)`,
      },
    ];

    const techLine = [
      weekly ? `Weekly index +${weekly.value.toFixed(1)}°C (${weeklyDate})` : null,
      mei ? `MEI +${mei.value >= 0 ? "" : "−"}${Math.abs(mei.value).toFixed(2)}` : null,
      thermoVal ? `Thermocline ${thermoVal} (100°W)` : null,
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

    // --- forecast summary (what the models predict)
    const fc = d.nino34_forecast;
    let forecastSummary = "The water temperature forecast is not available right now.";
    if (fc?.mean?.length && fc.months?.length) {
      const peak = fc.mean.reduce((best, v, i) => (v > fc.mean[best] ? i : best), 0);
      const mm = fc.months[peak].split("-");
      const MONTHS_SHORT_FC = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const peakLabel = `${MONTHS_SHORT_FC[parseInt(mm[1], 10) - 1]} ${mm[0]}`;
      forecastSummary =
        `Forecast: +${fc.mean[peak].toFixed(1)}°C peak in ${peakLabel} (${fc.model_count}-model mean, range +${fc.min[peak].toFixed(1)}–+${fc.max[peak].toFixed(1)}°C).`;
    }

    // --- statement: first two sentences only
    const synopsis = (st.synopsis || "").replace(/\s+/g, " ").trim();
    const sents = synopsis.split(/(?<=[.!?])\s+/).filter(Boolean);
    const quote = sents.slice(0, 4).join(" ") + (sents.length > 4 ? " …" : "");

    return { headline, lead, statements, techLine, refYear, cmpText, forecastSummary, quote, st, monthly,
             outlookRows: buildOutlookRows(d.enso_probabilities, d.generated_at),
             currentYear: new Date(d.generated_at).getFullYear(),
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
          {/* headline + official statement as the intro */}
          <h1 className="max-w-4xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {derived.headline}
          </h1>

          <section className="mt-8 max-w-3xl">
            <blockquote className="border-l-2 border-gray-900 pl-4 text-justify text-lg leading-relaxed text-gray-800">
              “{derived.quote}”
            </blockquote>
            <p className="mt-3 text-sm text-gray-500">
              NOAA Climate Prediction Center, {st.issued}.{" "}
              <a href={st.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-900">
                Full statement
              </a>
            </p>
          </section>

          {/* where things stand — plain language, technical names underneath */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Where things stand</h2>
            <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
              {derived.statements.map(st_ => (
                <div key={st_.head} className="flex flex-col">
                  <div className="h-[3px] w-6 bg-[#DC2626]" />
                  <div className="mt-3 min-h-5 text-sm font-semibold text-gray-900">{st_.head}</div>
                  <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{st_.value}</div>
                  <div className="mt-2 min-h-8 text-justify text-xs leading-4 text-gray-500">{st_.sub}</div>
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
            <p className="mt-1 max-w-3xl text-justify text-base text-gray-600">{derived.cmpText}</p>
            <AnomalyChart monthly={monthly} currentYear={currentYear} referenceYear={derived.refYear} />
            <p className="mt-3 max-w-3xl text-sm text-gray-500">
              Monthly Niño-3.4 anomaly, °C vs 1991–2020 (official CPC ERSST series).
            </p>
          </section>

          {/* 2 — what is predicted (observed vs forecast water temperature) */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">What is predicted?</h2>
            <p className="mt-1 max-w-3xl text-justify text-base text-gray-600">{derived.forecastSummary}</p>
            <PredictedChart observed={monthly} forecast={data.nino34_forecast} />
            <p className="mt-3 max-w-3xl text-justify text-sm text-gray-500">
              NOAA CPC NMME model ensemble, issued {data.nino34_forecast?.init || "—"} ({data.nino34_forecast?.model_count ?? 0} models); raw values, see the statement above.
            </p>
          </section>

          {/* 3 — what are the consequences */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">What are the consequences?</h2>
            <ul className="mt-1 max-w-3xl space-y-1 text-justify text-base text-gray-700">
              <li><strong className="text-gray-900">Drier:</strong> Australia, Southeast Asia, India, southern Africa, northern South America.</li>
              <li><strong className="text-gray-900">Wetter:</strong> Peru and Ecuador (flooding), East Africa, southern South America.</li>
              <li><strong className="text-gray-900">Europe:</strong> no consistent seasonal effect.</li>
            </ul>
            <ImpactMap />
            <p className="mt-3 max-w-3xl text-justify text-sm text-gray-500">
              Well-documented pattern (NOAA/IRI consensus); model forecast maps are not yet openly machine-readable.
            </p>
          </section>

          {/* 4 — how long does this last */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">How long does this last?</h2>
            <p className="mt-1 max-w-3xl text-justify text-base text-gray-600">{outlookSummary(derived.outlookRows)}</p>
            <OutlookChart probabilities={derived.probs} generatedAt={generatedAt} />
            <p className="mt-3 max-w-3xl text-justify text-sm text-gray-500">
              Official NOAA CPC probability of El Niño per three-month season, {derived.st.issued}.
            </p>
          </section>

        </article>

        {/* footer */}
        <footer className="mt-16 border-t border-gray-200 py-8 text-sm text-gray-500">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>Data: NOAA CPC · NOAA PSL · GODAS — updated twice a day.</span>
            <a className="underline underline-offset-2 hover:text-gray-900" href="data.json">raw data</a>
            <a className="underline underline-offset-2 hover:text-gray-900" target="_blank" rel="noopener noreferrer" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml">official discussion</a>
            <a className="underline underline-offset-2 hover:text-gray-900" target="_blank" rel="noopener noreferrer" href="https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/">model forecast</a>
            <span className="text-gray-400">— independent project, not affiliated with NOAA</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
