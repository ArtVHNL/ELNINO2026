// ============================================================================
// "How long does this last?" — official CPC El Niño probability by 3-month
// season (SON 2026 … FMA 2027). Flat horizontal bars, no decoration.
// ============================================================================
import { useMemo } from "react";
import type { SeasonProbability } from "../data";

interface Props {
  probabilities: SeasonProbability[];
  generatedAt: string;
}

const SEASON_LABEL: Record<string, string> = {
  JAS: "Jul–Sep", ASO: "Aug–Oct", SON: "Sep–Nov", OND: "Oct–Dec",
  NDJ: "Nov–Jan", DJF: "Dec–Feb", JFM: "Jan–Mar", FMA: "Feb–Apr", MAM: "Mar–May",
};

export function OutlookChart({ probabilities, generatedAt }: Props) {
  const rows = useMemo(() => {
    // order seasons as the CPC table does and keep the next six from the current month
    const ordered = ["ASO", "SON", "OND", "NDJ", "DJF", "JFM", "FMA", "MAM"];
    const bySeason = new Map(probabilities.map(p => [p.season, p]));
    const now = new Date(generatedAt);
    const curMonth = now.getMonth(); // 0-based, e.g. 7 = August
    const startIdx = ordered.findIndex(s => SEASON_LABEL[s].startsWith(
      MONTH_ABBR[(curMonth + 1) % 12]
    ));
    const idx = startIdx >= 0 ? startIdx : 0;
    return ordered.slice(idx, idx + 6).map(s => bySeason.get(s)).filter(Boolean) as SeasonProbability[];
  }, [probabilities, generatedAt]);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-600">No official probability forecast published.</p>;
  }

  const max = Math.max(...rows.map(r => r.el_nino), 100);

  return (
    <div className="mt-4">
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.season} className="flex items-center gap-4">
            <div className="w-28 shrink-0 text-right">
              <span className="text-sm font-semibold text-gray-900">{r.season}</span>
              <span className="block text-xs text-gray-500">{SEASON_LABEL[r.season]}</span>
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

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
