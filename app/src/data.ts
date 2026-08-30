// ============================================================================
// El Niño 2026 Dashboard — Data Layer
// ============================================================================
// Alle hardcoded mockdata verwijderd. Data wordt live opgehaald via de
// Flask proxy (server.py) op http://127.0.0.1:8899/api/livedata.
// ============================================================================
// TypeScript Interfaces (dashboard schema)

export interface Nino34Weekly {
  date: string;
  value: number;
}

export interface OniMonthly {
  season: string;
  year: number;
  value: number;
}

export interface SoiMonthly {
  date: string;
  value: number;
}

export interface WwvMonthly {
  date: string;
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

export interface Wind850Anomaly {
  lon: number[];
  lat: number[];
  u: number[][];
  v: number[][];
}

export interface ModelPlume {
  name: string;
  values: number[];
}

export interface EnsemblePlume {
  months: string[];
  models: ModelPlume[];
  consensus: number[];
}

export interface PrecipForecast {
  lon: number[];
  lat: number[];
  anomaly_percent: number[][];
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

export interface CurrentValues {
  nino34?: { date: string; value: number };
  oni?: { season: string; year: number; value: number };
  soi?: { date: string; value: number };
  mei?: { date: string; value: number };
  wwv?: { date: string; value: number };
  nino34_official?: Record<string, number | string>;
}

export interface ComparisonEvent {
  start?: string;
  end?: string;
  peak: number;
  peak_season: string;
  label: string;
  category: string;
  active?: boolean;
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
}

export interface ExpertBriefing {
  generated_at: string;
  model: string;
  headline: string;
  summary: string;
  what_changed: string[];
  outlook: string;
  risks: string[];
  data_confidence: "high" | "medium" | "low";
  news?: { title: string; source: string; url: string; summary: string }[];
  disclaimer: string;
}

export interface EnsoDashboardData {
  schema_version: string;
  generated_at: string;
  nino34_monthly: Nino34Weekly[];
  nino34_weekly: Nino34Weekly[];
  oni_monthly: OniMonthly[];
  soi_monthly: SoiMonthly[];
  mei_monthly: Nino34Weekly[];
  wwv_monthly: WwvMonthly[];
  olr_anomaly: OlrAnomaly;
  subsurface_temp: SubsurfaceTemp;
  wind850_anomaly: Wind850Anomaly;
  ensemble_plume: EnsemblePlume;
  precip_forecast: PrecipForecast;
  enso_status: EnsoStatus;
  current: CurrentValues;
  comparison: { events: ComparisonEvent[] };
  sources: SourceMap;
  changes_since_previous?:
    | { note: string }
    | Record<string, { previous: number; current: number; delta: number }>;
}

// ============================================================================
// Live Data Fetch — same-origin static payload with graceful fallbacks
// ============================================================================

export type DataSource = "live" | "derived" | "synthetic" | "error";

const DATA_URLS = [
  "data.json", // same-origin (GitHub Pages production)
  "https://raw.githubusercontent.com/ArtVHNL/ELNINO2026/main/data.json", // raw fallback
  "/api/livedata", // local dev proxy (Vite -> Flask/Node)
];
const BRIEFING_URLS = [
  "news/latest.json",
  "https://raw.githubusercontent.com/ArtVHNL/ELNINO2026/main/news/latest.json",
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

/**
 * fetchLiveEnsoData() — loads the latest pipeline output (data.json).
 * Tries same-origin first (static hosting), then the GitHub raw mirror,
 * then the local dev proxy. Returns null only if all sources fail.
 */
export async function fetchLiveEnsoData(): Promise<EnsoDashboardData | null> {
  const json = await fetchFirst(DATA_URLS);
  if (!json) return null;
  const data = json as EnsoDashboardData;
  if (!data.nino34_monthly || !data.soi_monthly || !data.enso_status) {
    console.error("[fetchLiveEnsoData] incomplete payload");
    return null;
  }
  return data;
}

/** fetchExpertBriefing() — AI briefing + news digest (optional content). */
export async function fetchExpertBriefing(): Promise<ExpertBriefing | null> {
  const json = await fetchFirst(BRIEFING_URLS);
  if (!json) return null;
  const b = json as ExpertBriefing;
  if (!b.headline || !b.summary) return null;
  return b;
}

// ============================================================================
// Institutionele benchmark-databases (educatieve content, geen mockdata)
// Deze secties bevatten historische context en regionale impact-beschrijvingen
// die niet uit NOAA/IRI API's komen. Het zijn redactionele gegevens.
// ============================================================================

export interface HistoricAnalog {
  year: string;
  oni: string;
  name: string;
  description: string;
  soi: string;
  highlight: string;
}

export const HISTORIC_ANALOGS: HistoricAnalog[] = [
  {
    year: '1997 - 1998',
    oni: '+2.40°C',
    name: 'Classic East-Pacific Super El Niño',
    description:
      "The 'El Niño of the Century'. Triggered absolute collapses in the trade wind fields. Resulted in devastating drought wildfires across Borneo and massive flooding inundations in Peru and Ecuador.",
    soi: '-28.5 pts',
    highlight:
      'Warm pool fully migrated to South American shores, raising equatorial Ocean heat Content to maximum limits.',
  },
  {
    year: '2015 - 2016',
    oni: '+2.60°C',
    name: 'Hybrid Super El Niño',
    description:
      'Extremely strong atmospheric coupling combined with warm Indian Ocean anomalies. Unprecedented bleaching events on Great Barrier Reef and catastrophic droughts in the Horn of Africa.',
    soi: '-25.2 pts',
    highlight:
      'Symmetric ocean heating across Niño 3.4 and Niño 4 regions, showing double-peaked Walker cell division.',
  },
  {
    year: '2023 - 2024',
    oni: '+2.01°C',
    name: 'Recent Core El Niño',
    description:
      'Rapid basin heating during late 2023. Brought severe Amazon droughts, historic low water levels in the Panama Canal, and severe global coral bleaching events.',
    soi: '-18.9 pts',
    highlight:
      'Highly focused mid-basin warming that decoupled global jet streams rapidly.',
  },
];

export interface RegionalImpactItem {
  region: string;
  risk: string;
  severity: string;
  impact: string;
  stats: {
    temp: string;
    precip: string;
    economic: string;
  };
}

export const REGIONAL_IMPACTS: Record<
  'active' | 'neutral' | 'lanina' | 'modoki',
  RegionalImpactItem[]
> = {
  active: [
    {
      region: 'Maritime Continent (Indonesia & Australia)',
      risk: 'Severe Agricultural Drought & Wildfire Risk',
      severity: 'CRITICAL ALERT',
      impact:
        'Suppressed convection over Western Pacific warm pool completely dries out regional monsoons. Yield potentials for palm, rice, and wheat collapse by up to 35% with elevated peat fires.',
      stats: {
        temp: '+1.8°C Anomaly',
        precip: '-85% Convection',
        economic: '$12.4B Projected Damage',
      },
    },
    {
      region: 'Coastal Peru, Ecuador & Chile',
      risk: 'Catastrophic Torrential Rainfall & Marine Ecosystem Collapse',
      severity: 'HIGH DANGER',
      impact:
        'Deep downwelling Kelvin waves lower the marine thermocline, fully halting nutrient upwelling. Fish/Anchovy migrations flee, while massive coastal convection brings historic mudslides.',
      stats: {
        temp: '+3.4°C Anomaly',
        precip: '+450% Inundation',
        economic: 'Marine Bio-Collapse',
      },
    },
    {
      region: 'Southern United States & Northern Mexico',
      risk: 'Subtropical Jet Charge & Storm Systems',
      severity: 'MODERATE RISKS',
      impact:
        'The Pacific jet stream shifts South, continuously steering rain storms across California and Southern states. Reduces heating index but causes severe river basin flooding.',
      stats: {
        temp: '-0.5°C Cooling',
        precip: '+180% Rain Surge',
        economic: 'Water Supply Refill',
      },
    },
  ],
  neutral: [
    {
      region: 'Equatorial Pacific Ocean Basin',
      risk: 'Standard Baseline Balance',
      severity: 'NORMAL VALUE',
      impact:
        'Global climatological baseline remains active. Trade wind speeds and ocean surface conditions match standard multi-decadal averages with stable fisheries.',
      stats: {
        temp: '0.0°C Baseline',
        precip: 'Climatological Mean',
        economic: 'Stable Operations',
      },
    },
  ],
  lanina: [
    {
      region: 'Maritime Continent & Northern Australia',
      risk: 'Epic Monsoon Flooding & Cyclonic Activity',
      severity: 'CRITICAL SWING',
      impact:
        'Intense westward trade winds pack the western warm pool, fueling extreme atmospheric convection. Triggers flash landslides, coal mine flooding, and high tropical cyclone counts.',
      stats: {
        temp: '-0.8°C Anomaly',
        precip: '+300% Precipitation',
        economic: 'Supply Chain Blockages',
      },
    },
    {
      region: 'Western United States (California / Southwest)',
      risk: 'Severe Multidecadal Hydro-Drought Expansion',
      severity: 'HIGH ARIDALERT',
      impact:
        'La Niña diverts key winter storms North toward Washington and Canada. Leaves California, Nevada, and Arizona dry, accelerating wildfire fuels and reservoir strain.',
      stats: {
        temp: '+1.2°C Warming',
        precip: '-60% Rain Yield',
        economic: '$8.5B Water Deficit',
      },
    },
  ],
  modoki: [
    {
      region: 'Maritime Continent & India',
      risk: 'Dual-subsidence Monsoon Failures',
      severity: 'HIGH ARIDALERT',
      impact:
        'The split tri-polar Walker circulation creates duplicate sinking branches over Southeast Asia and Western Pacific, triggering monsoon failure even as mid-Pacific warm cells remain damp.',
      stats: {
        temp: '+0.4°C Anomaly',
        precip: '-40% Rain Fall',
        economic: 'Crop Yield Reductions',
      },
    },
    {
      region: 'Eastern Australia & Queensland',
      risk: 'Localized Sub-Tropical Storm Bursts',
      severity: 'MODERATE FLOOD',
      impact:
        'Unlike standard El Niño, Central Pacific heating triggers anomalous eastern wind loops, sometimes steering convective bands directly onto Central Australia coastlines.',
      stats: {
        temp: '+0.6°C Anomaly',
        precip: '+110% Storm Spikes',
        economic: 'Infrastructure Stress',
      },
    },
  ],
};
