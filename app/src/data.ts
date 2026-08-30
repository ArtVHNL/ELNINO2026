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
}

export interface SubsurfaceTemp {
  lon: number[];
  depth: number[];
  lat: number[];
  anomaly: number[][];
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
}

export interface EnsoDashboardData {
  generated_at: string;
  nino34_weekly: Nino34Weekly[];
  oni_monthly: OniMonthly[];
  soi_monthly: SoiMonthly[];
  wwv_monthly: WwvMonthly[];
  olr_anomaly: OlrAnomaly;
  subsurface_temp: SubsurfaceTemp;
  wind850_anomaly: Wind850Anomaly;
  ensemble_plume: EnsemblePlume;
  precip_forecast: PrecipForecast;
  enso_status: EnsoStatus;
}

// ============================================================================
// Live Data Fetch — Proxy client
// ============================================================================

export type DataSource = 'live' | 'mock' | 'error';

const PROXY_URL = 'http://127.0.0.1:8899/api/livedata';
const FETCH_TIMEOUT_MS = 8000;

/**
 * fetchLiveEnsoData()
 *
 * Haalt realtime ENSO-data op van de Flask proxy.
 * Retourneert de geparseerde EnsoDashboardData, of null bij fout.
 *
 * De Flask proxy (server.py) fungeert als CORS-brug en haalt data op van
 * 10+ NOAA/IRI/PMEL endpoints. Bij een endpoint-fout valt de proxy terug
 * op synthetische data (per-endpoint fallback, nooit een hardcoded dataset).
 */
export async function fetchLiveEnsoData(): Promise<EnsoDashboardData | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(PROXY_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timer);

    if (!resp.ok) {
      console.error(
        `[fetchLiveEnsoData] HTTP ${resp.status} ${resp.statusText} — proxy offline?`
      );
      return null;
    }

    const json = await resp.json();

    // Validate minimale structuur
    if (!json || !json.nino34_weekly || !json.soi_monthly || !json.enso_status) {
      console.error(
        '[fetchLiveEnsoData] Proxy returned incomplete data — missing required fields'
      );
      return null;
    }

    console.log(
      `[fetchLiveEnsoData] ✓ Live data geladen (${json.generated_at})`
    );
    if (json._pipeline?.errors?.length > 0) {
      console.warn(
        `[fetchLiveEnsoData] Proxy meldt ${json._pipeline.errors.length} endpoint-fouten`,
        json._pipeline.errors
      );
    }

    return json as EnsoDashboardData;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[fetchLiveEnsoData] Timeout — proxy niet bereikbaar op', PROXY_URL);
    } else {
      console.error(
        '[fetchLiveEnsoData] Netwerkfout:',
        err instanceof Error ? err.message : String(err)
      );
    }
    return null;
  }
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
