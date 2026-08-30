// ============================================================================
// El Niño 2026 — live monitoring, newsroom layout.
// Facts first. Three question-led visualisations. No decoration.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { EnsoDashboardData, fetchLiveEnsoData, ComparisonEvent } from "./data";
import { LANGS, msg, useI18n } from "./i18n";
import { useState as _useState, useRef as _useRef } from "react";
import { AlignedComparison } from "./components/AlignedComparison";
import { MiniThermometer } from "./components/MiniThermometer";
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
  const { lang, setLang, t } = useI18n();
  const T = (key: string, vars?: Record<string, string>) => msg(t, key, vars);
  const [langOpen, setLangOpen] = _useState(false);
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
    const headline = chance ? T("headlineStrong") : T("headlineFallback");

    const monthlyLatest = monthly.length ? monthly[monthly.length - 1] : null;
    const monthlyPrev = monthly.length > 1 ? monthly[monthly.length - 2] : null;
    const mDelta =
      monthlyLatest && monthlyPrev ? monthlyLatest.value - monthlyPrev.value : null;
    const monthLab = monthlyLatest
      ? (t as any).months[new Date(monthlyLatest.date + "T00:00:00Z").getUTCMonth()]
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

    const thermos = [
      {
        label: T("thermoWarmer"),
        value: monthlyVal ?? 0,
        suffix: "°C",
        decimals: 1,
        caption: T("captionWater", { month: monthLab, temp: sstNowLab }),
      },
      {
        label: T("thermoModerate"),
        value: oni?.value ?? 0,
        suffix: "°C",
        decimals: 2,
        caption: T("captionOni"),
      },
      {
        label: T("thermoWarmLayer"),
        value: wwv?.value ?? 0,
        suffix: "°C",
        decimals: 2,
        caption: T("captionWarm", { value: "+2.2°C" }),
      },
    ];

    // --- forecast summary (what the models predict)
    const fc = d.nino34_forecast;
    let forecastSummary = "The water temperature forecast is not available right now.";
    if (fc?.mean?.length && fc.months?.length) {
      const peak = fc.mean.reduce((best, v, i) => (v > fc.mean[best] ? i : best), 0);
      const mm = fc.months[peak].split("-");
      const MONTHS_SHORT_FC = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const peakLabel = `${MONTHS_SHORT_FC[parseInt(mm[1], 10) - 1]} ${mm[0]}`;
      forecastSummary = T("forecastSummary", {
        value: `+${fc.mean[peak].toFixed(1)}`,
        month: peakLabel,
        min: `+${fc.min[peak].toFixed(1)}`,
        max: `+${fc.max[peak].toFixed(1)}`,
      });
    }

    // --- informative intro (our words, based on the official statement)
    const fcPeak = (() => {
      const m = d.nino34_forecast?.mean?.length ? d.nino34_forecast : null;
      if (!m) return null;
      const peak = m.mean.reduce((best, v, i) => (v > m.mean[best] ? i : best), 0);
      const [yy, mm] = m.months[peak].split("-");
      const peakLabel = `${(t as any).monthsShort[parseInt(mm, 10) - 1]} ${yy}`;
      return { v: m.mean[peak], label: peakLabel };
    })();
    const intro =
      T("introWarm", { month: monthLab, value: monthlyVal !== null ? fmtSigned(monthlyVal) : "—" }) +
      " " +
      T("introCpc", { chance: chance || "high" }) +
      (fcPeak ? " " + T("introModels", { value: `+${fcPeak.v.toFixed(1)}`, month: fcPeak.label }) : "");

    return { headline, lead, intro, thermos, forecastSummary, st, monthly,
             monthlyVal, sstNowLab, monthLab,
             currentYear: new Date(d.generated_at).getFullYear(),
             probs: d.enso_probabilities, generatedAt: d.generated_at };
  }, [d, t]);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-600">{T("loading")}</p>
      </main>
    );
  }
  if (!data || !derived) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-base text-gray-900 font-semibold">{error || T("noData")}</p>
          <button onClick={() => load()} className="mt-4 border border-gray-300 px-4 py-2 text-sm font-medium hover:border-gray-900">
            {T("retry")}
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
          {/* language selector — minimal, top right */}
          <div className="relative flex justify-end">
            <button
              type="button"
              onClick={() => setLangOpen(o => !o)}
              className="border border-gray-300 px-2.5 py-1 text-xs font-medium hover:border-gray-900"
              aria-haspopup="listbox"
            >
              {LANGS.find(l => l.code === lang)?.short}
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                <div className="absolute end-0 z-20 mt-8 border border-gray-200 bg-white py-1 text-sm shadow-sm">
                  {LANGS.map(l => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => { setLang(l.code); setLangOpen(false); }}
                      className={`block w-full px-4 py-1.5 text-start hover:bg-gray-50 ${l.code === lang ? "font-bold text-gray-900" : "text-gray-600"}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* headline + official statement as the intro */}
          <h1 className="mt-6 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {derived.headline}
          </h1>

          <section className="mt-6 max-w-4xl">
            <p className="text-justify text-lg leading-relaxed text-gray-800">
              {derived.intro}
            </p>
            <p className="mt-3 text-sm text-gray-500">
              {T("attribution", { date: st.issued || "" })}{" "}
              <a href={st.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-900">
                {T("fullStatement")}
              </a>
            </p>
          </section>

          {/* where things stand — plain language, technical names underneath */}
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-bold tracking-tight">{T("whereStands")}</h2>
            <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
              {derived.thermos.map((t, i) => (
                <div key={i}>
                  <MiniThermometer
                    label={t.label}
                    value={t.value}
                    suffix={t.suffix}
                    decimals={t.decimals}
                    caption={t.caption}
                  />
                </div>
              ))}
            </div>

          </section>

          {/* 1 — how bad is it */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">{T("howBad")}</h2>
            <AlignedComparison monthly={monthly} events={data.comparison.events} />
            <p className="mt-3 max-w-3xl text-justify text-sm text-gray-500">
              {T("badCaption")}
            </p>
          </section>

          {/* 2 — what is predicted (observed vs forecast water temperature) */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">{T("predicted")}</h2>
            <p className="mt-1 max-w-3xl text-justify text-base text-gray-600">{derived.forecastSummary}</p>
            <PredictedChart observed={monthly} forecast={data.nino34_forecast} />
            <p className="mt-3 max-w-3xl text-justify text-sm text-gray-500">
              {T("predictedCaption", { date: data.nino34_forecast?.init || "—" })}
            </p>
          </section>

          {/* 3 — what are the consequences */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">{T("consequences")}</h2>
            <ImpactMap />

          </section>

          {/* 4 — how long does this last */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">{T("howLong")}</h2>
            <OutlookChart probabilities={derived.probs} generatedAt={generatedAt} />
            <p className="mt-3 max-w-3xl text-justify text-sm text-gray-500">
              {T("outlookCaption", { date: derived.st.issued || "" })}
            </p>
          </section>

        </article>

        {/* footer */}
        <footer className="mt-16 border-t border-gray-200 py-8 text-sm text-gray-500">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>{T("footer1")}</span>
            <a className="underline underline-offset-2 hover:text-gray-900" href="data.json">{T("footerRaw")}</a>
            <a className="underline underline-offset-2 hover:text-gray-900" target="_blank" rel="noopener noreferrer" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml">{T("footerDisc")}</a>
            <a className="underline underline-offset-2 hover:text-gray-900" target="_blank" rel="noopener noreferrer" href="https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/">{T("footerModel")}</a>
            <span className="text-gray-400">{T("footerNote")}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
