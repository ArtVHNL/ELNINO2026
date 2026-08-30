// ============================================================================
// "How long does this last?" — official CPC El Niño probability for the next
// six 3-month windows. Plain month labels, no season codes. Flat bars.
// ============================================================================
import { useMemo } from "react";
import type { SeasonProbability } from "../data";
import { msg, useI18n } from "../i18n";

interface Props {
  probabilities: SeasonProbability[];
  generatedAt: string;
}

// month offsets (0 = Jan) per CPC season code
// first calendar month (Jan = 0) and last month offset of each CPC season code
const SEASON_MONTHS: Record<string, number> = {
  JAS: 6, ASO: 7, SON: 8, OND: 9, NDJ: 10, DJF: 11, JFM: 0, FMA: 1, MAM: 2,
};

export interface OutlookRow {
  season: string;
  label: string;
  el_nino: number;
}

export function buildOutlookRows(probabilities: SeasonProbability[], generatedAt: string): OutlookRow[] {
  {
    // pipeline order: JAS, ASO, SON, OND, NDJ, DJF, JFM, FMA, MAM
    const ordered = ["JAS", "ASO", "SON", "OND", "NDJ", "DJF", "JFM", "FMA", "MAM"];
    const cm = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const bySeason = new Map(probabilities.map(p => [p.season, p]));
    const now = new Date(generatedAt);
    const curMonth = now.getUTCMonth();
    // start at the season in progress; show the whole official table (through May 2027)
    const startIdx = ordered.findIndex(s => SEASON_MONTHS[s] === curMonth);
    const idx = startIdx >= 0 ? startIdx : 0;

    const yy = (d: Date) => String(d.getUTCFullYear() % 100).padStart(2, "0");

    return ordered.slice(idx, idx + 9).map(season => {
      const prob = bySeason.get(season);
      if (!prob) return null;
      const k = ordered.indexOf(season) - idx;
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k + 2, 1));
      const label =
        start.getUTCFullYear() === end.getUTCFullYear()
          ? `${cm[start.getUTCMonth()]}–${cm[end.getUTCMonth()]} ${yy(start)}`
          : `${cm[start.getUTCMonth()]} ${yy(start)}–${cm[end.getUTCMonth()]} ${yy(end)}`;
      return { season, label, el_nino: prob.el_nino };
    }).filter(Boolean) as OutlookRow[];
  }
}

export function OutlookChart({ probabilities, generatedAt }: Props) {
  const { t } = useI18n();
  const rows = useMemo(() => buildOutlookRows(probabilities, generatedAt), [probabilities, generatedAt]);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-600">{msg(t, "noForecast")}</p>;
  }

  const max = Math.max(...rows.map(r => r.el_nino), 100);

  return (
    <div className="mt-4">
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.season} className="flex items-center gap-4">
            <div className="w-32 shrink-0 text-right text-sm font-semibold text-gray-900">
              {r.label}
            </div>
            <div className="relative h-5 flex-1 border border-gray-200">
              <div
                className="absolute inset-y-0 left-0 bg-[#DC2626]"
                style={{ width: `${(r.el_nino / max) * 100}%` }}
              />
            </div>
            <div className="w-14 shrink-0 text-sm font-bold text-gray-900">
              {r.el_nino}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
