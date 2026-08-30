import { MOCKDATA } from './mockData.js';

let DATA = null;
let worldTopology = null;

export async function fetchWorldTopology() {
  if (worldTopology) return worldTopology;
  try {
    const url = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    worldTopology = await response.json();
    return worldTopology;
  } catch (error) {
    console.error('Failed to fetch world topology:', error);
    throw error;
  }
}

export async function loadData() {
  const url = 'https://raw.githubusercontent.com/jouwuser/enso-live-data/main/data.json';
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const liveData = await resp.json();
      console.log('[DEBUG] SUCCESS: Live data loaded from GitHub');
      DATA = mergeData(liveData, MOCKDATA);
      return { data: DATA, isLive: true };
    }
  } catch(e) {
    console.log('[DEBUG] FAILED: Live data fetch (' + e.message + '), using mockdata');
  }
  DATA = MOCKDATA;
  return { data: DATA, isLive: false };
}

export function getData() {
  return DATA;
}

function mergeData(live, mock) {
  // Use live data where available, fall back to mock for missing fields
  const result = JSON.parse(JSON.stringify(mock)); // deep clone mock

  if (live.nino34_weekly && live.nino34_weekly.length > 0) {
    result.nino34.monthly = live.nino34_weekly.map(d => ({
      date: new Date(d.date),
      value: d.value,
      label: d.date
    }));
    result.nino34.current = live.nino34_weekly[live.nino34_weekly.length - 1];
  }

  if (live.soi_monthly && live.soi_monthly.length > 0) {
    result.soi_bars = live.soi_monthly.map(d => ({
      date: new Date(d.date),
      value: d.value,
      label: d.date.substring(0, 7)
    }));
    result.soi = { value: live.soi_monthly[live.soi_monthly.length - 1].value, label: 'Live' };
  }

  if (live.olr_anomaly && live.olr_anomaly.lon) {
    result.olr.grid_lon = live.olr_anomaly.lon;
    result.olr.grid_lat = live.olr_anomaly.lat;
    result.olr.values = live.olr_anomaly.data;
  }

  if (live.subsurface_temp && live.subsurface_temp.lon) {
    result.subsurface.lons = live.subsurface_temp.lon;
    result.subsurface.depths = live.subsurface_temp.depth;
    result.subsurface.values = live.subsurface_temp.anomaly;
  }

  if (live.ensemble_plume && live.ensemble_plume.models) {
    const pl = live.ensemble_plume;
    result.plume.dates = (pl.months || []).map(m => new Date(m + '-01'));
    result.plume.models = pl.models || [];
    result.plume.consensus = pl.consensus || [];
  }

  if (live.precip_forecast && live.precip_forecast.lon) {
    result.precip.grid_lon = live.precip_forecast.lon;
    result.precip.grid_lat = live.precip_forecast.lat;
    result.precip.values = live.precip_forecast.anomaly_percent;
  }

  return result;
}
