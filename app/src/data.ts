// ============================================================================
// El Niño 2026 — data layer (schema v3+ pipeline contract)
// ============================================================================

export interface IndexValue {
  date: string;
  value: number;
}

export interface OniValue {
  season: string;
  year: number;
  value: number;
}

export interface OlrAnomaly {
  lat: number[];
  lon: number[];
  data: number[][];
  date?: string;
  window_days?: number;
}

export interface SubsurfaceTemp {
  lon: number[];
  depth: number[];
  lat: number[];
  months: string[];
  absolute: number[][][];
  anomaly: number[][][];
  thermocline_depth: (number | null)[][];
  climatology?: string | null;
}

export interface EnsoStatus {
  advisory: string;
  strength: string;
  category?: string | null;
  issued?: string | null;
  next_discussion?: string | null;
  synopsis?: string | null;
  indices?: Record<string, number | string>;
  probabilities?: Record<string, string>;
  url?: string;
}

export interface SeasonProbability {
  season: string;
  la_nina: number;
  neutral: number;
  el_nino: number;
}

export interface ComparisonEvent {
  start?: string;
  end?: string;
  peak: number;
  peak_season: string;
  peak_year?: number;
  label: string;
  category: string;
  active?: boolean;
}

export interface CurrentValues {
  nino34?: IndexValue;
  oni?: OniValue;
  soi?: IndexValue;
  mei?: IndexValue;
  wwv?: IndexValue;
  nino34_official?: Record<string, number | string>;
}

export interface SourceMap {
  nino34: string;
  nino34_weekly: string;
  oni: string;
  soi: string;
  mei: string;
  subsurface: string;
  olr: string;
  plume: string;
  wind850: string;
  precip: string;
  enso_status: string;
  enso_probabilities?: string;
}

export interface EnsoDashboardData {
  schema_version: string;
  generated_at: string;
  nino34_monthly: IndexValue[];
  nino34_weekly: IndexValue[];
  oni_monthly: OniValue[];
  soi_monthly: IndexValue[];
  mei_monthly: IndexValue[];
  wwv_monthly: IndexValue[];
  olr_anomaly: OlrAnomaly;
  subsurface_temp: SubsurfaceTemp;
  wind850_anomaly: unknown;
  ensemble_plume: unknown;
  precip_forecast: unknown;
  enso_status: EnsoStatus;
  enso_probabilities: SeasonProbability[];
  current: CurrentValues;
  comparison: { events: ComparisonEvent[] };
  sources: SourceMap;
  changes_since_previous?: unknown;
}

// ============================================================================
// Fetch — same-origin static payload with fallbacks
// ============================================================================

const DATA_URLS = [
  "data.json",
  "https://raw.githubusercontent.com/ArtVHNL/ELNINO2026/main/data.json",
  "/api/livedata",
];
const FETCH_TIMEOUT_MS = 8000;

async function fetchFirst(urls: string[]): Promise<unknown | null> {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!resp.ok) {
        console.warn(`[fetchFirst] ${resp.status} ${url}`);
        continue;
      }
      return await resp.json();
    } catch (err) {
      console.warn(`[fetchFirst] failed ${url}:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

export async function fetchLiveEnsoData(): Promise<EnsoDashboardData | null> {
  const json = await fetchFirst(DATA_URLS);
  if (!json) return null;
  const data = json as EnsoDashboardData;
  if (!data.nino34_monthly || !data.enso_status || !data.current) {
    console.error("[fetchLiveEnsoData] incomplete payload");
    return null;
  }
  return data;
}
