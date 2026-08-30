// ============================================================================
// El Niño 2026 — live monitoring, newsroom layout.
// Facts first. Three question-led visualisations. No decoration.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { EnsoDashboardData, fetchLiveEnsoData, ComparisonEvent } from "./data";
import { AnomalyChart } from "./components/AnomalyChart";
import { ImpactMap } from "./components/ImpactMap";
import { OutlookChart } from "./components/OutlookChart";
import { PredictedChart } from "./components/PredictedChart";

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
        head: "At the moment: a moderate El Niño",
        value: oni ? fmtSigned(oni.value, 2) : "—",
        sub: `3-month index, May–July 2026 (ONI)`,
      },
      {
        head: "Warm water below the surface is building",
        value: wwv ? fmtSigned(wwv.value, 2) : "—",
        sub: `2.2°C warmer than normal in the upper 300 m — an anomaly, not the water temperature itself (July 2026)`,
      },
    ];

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
        `Forecast: +${fc.mean[peak].toFixed(1)}°C peak in ${peakLabel} (range +${fc.min[peak].toFixed(1)}–+${fc.max[peak].toFixed(1)}°C).`;
    }

    // --- informative intro (our words, based on the official statement)
    const fcPeak = (() => {
      const m = d.nino34_forecast?.mean?.length ? d.nino34_forecast : null;
      if (!m) return null;
      const peak = m.mean.reduce((best, v, i) => (v > m.mean[best] ? i : best), 0);
      const [yy, mm] = m.months[peak].split("-");
      const peakLabel = `${MONTH_FULL[parseInt(mm, 10) - 1].slice(0, 3)} ${yy}`;
      return { v: m.mean[peak], label: peakLabel };
    })();
    const intro =
      `The equatorial Pacific is warming steadily: the ${monthLab} index stands at ${monthlyVal !== null ? fmtSigned(monthlyVal) : "—"}.` +
      ` The U.S. Climate Prediction Center keeps an El Niño Advisory and puts the chance of a very strong event this fall and winter ${chance || "high"}.` +
      (fcPeak ? ` Six international climate models expect the water temperature to peak at +${fcPeak.v.toFixed(1)}°C around ${fcPeak.label}.` : "");

    return { headline, lead, intro, statements, refYear, cmpText, forecastSummary, st, monthly,
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

          <section className="mt-6 max-w-4xl">
            <p className="text-justify text-lg leading-relaxed text-gray-800">
              {derived.intro}
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Based on the official ENSO Diagnostic Discussion (NOAA Climate Prediction Center, {st.issued}).{" "}
              <a href={st.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-900">
                Full statement
              </a>
            </p>
          </section>

          {/* where things stand — plain language, technical names underneath */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-bold tracking-tight">Where things stand</h2>
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
          </section>

          {/* 1 — how bad is it */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">How bad is it?</h2>
            <p className="mt-1 max-w-3xl text-justify text-base text-gray-600">{derived.cmpText}</p>
            <AnomalyChart monthly={monthly} currentYear={currentYear} referenceYear={derived.refYear} />
            <p className="mt-3 max-w-3xl text-sm text-gray-500">
              How many degrees the central Pacific was warmer than its long-term average, month by month (NOAA CPC data). The gray line shows 2015, the strongest previous event.
            </p>
          </section>

          {/* 2 — what is predicted (observed vs forecast water temperature) */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">What is predicted?</h2>
            <p className="mt-1 max-w-3xl text-justify text-base text-gray-600">{derived.forecastSummary}</p>
            <PredictedChart observed={monthly} forecast={data.nino34_forecast} />
            <p className="mt-3 max-w-3xl text-justify text-sm text-gray-500">
              Six international climate models (NOAA NMME project), issued {data.nino34_forecast?.init || "—"}. Model forecasts can run higher than reality in strong events — the official view is at the top of this page.
            </p>
          </section>

          {/* 3 — what are the consequences */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">What are the consequences?</h2>
            <ul className="mt-1 max-w-3xl space-y-1 text-justify text-base text-gray-700">
              <li><strong className="text-gray-900">Drier:</strong> Australia, Southeast Asia, India, southern Africa, northern South America.</li>
              <li><strong className="text-gray-900">Wetter:</strong> Peru and Ecuador (flooding), East Africa, southern South America.</li>
              <li><strong className="text-gray-900">Europe:</strong> barely affected — winters are occasionally milder, but there is no reliable pattern.</li>
            </ul>
            <ImpactMap />
            <p className="mt-3 max-w-3xl text-justify text-sm text-gray-500">
              Well-documented pattern (NOAA/IRI consensus); model forecast maps are not yet openly machine-readable.
            </p>
          </section>

          {/* 4 — how long does this last */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">How long does this last?</h2>
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
