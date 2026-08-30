import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Flame,
  Wind,
  TrendingDown,
  Info,
  CheckCircle,
  Thermometer,
  Compass,
  Database,
  Activity,
  Newspaper,
  ShieldAlert
} from "lucide-react";
import { EnsoDashboardData, ExpertBriefing, fetchLiveEnsoData, fetchExpertBriefing } from "./data";

// Core Modular Meteorological Components
import { SparklineMini } from "./components/SparklineMini";
import { CoupledTimeSeriesChart } from "./components/CoupledTimeSeriesChart";
import { EnsemblePlumesChart } from "./components/EnsemblePlumesChart";
import { HovmollerDiagram } from "./components/HovmollerDiagram";
// Deck.gl + MapLibre are heavy (~1.3 MB) — load the map only when rendered
const GeographicContoursMap = lazy(() =>
  import("./components/GeographicContoursMap").then(m => ({ default: m.GeographicContoursMap }))
);
import { WalkerCirculationSection } from "./components/WalkerCirculationSection";
import { RegionalImpactAtlasSection } from "./components/RegionalImpactAtlasSection";
import { HistoricAnalogsSection } from "./components/HistoricAnalogsSection";

// ----------------------------------------------------------------------------
// INTERACTIVE CLIMATE SIMULATION CONFIGURATION
// ----------------------------------------------------------------------------
const SCENARIO_DETAILS = {
  active: {
    title: "Super El Niño Watch (Active Observation Mode)",
    short: "Atmospheric Walker circulation has completely collapsed. Extreme anomalous westerly wind bursts propagate warm equatorial surface waters eastward, generating severe SST anomalies across the central-eastern Pacific basin.",
    physics: "Atmosphere-Ocean coupled feedback: Extreme sea surface heating shifts deep convective clouds directly over the central-eastern Pacific, bringing devastating droughts to Indonesia/Australia and heavy rainfall to coastal South America.",
  },
  neutral: {
    title: "ENSO Neutral Phase (Balanced Climatology)",
    short: "Normal easterly trade winds push surface waters westward at standard velocities. The Western Pacific warm pool remains anchored near the Maritime Continent, leaving South American ocean borders cool.",
    physics: "Standard Walker Loop: Normal atmospheric stability and global precipitation behaviors. Subsurface thermal energy reserves remain at baseline averages, with zero anomalous downwelling Kelvin wave activity.",
  },
  lanina: {
    title: "Extreme La Niña Swing (Cold Phase)",
    short: "Southeasterly trade winds strengthen to abnormal velocities. Warm surface water is packed intensely into the western Pacific basin, triggering profound upwelling of cold ocean depths in the east.",
    physics: "Thermo-slope hypercharge: Deep thermocline boundary rises sharply near the South American coast. Convective storms shift heavily over the Maritime Continent, leaving the eastern Pacific exceptionally dry.",
  },
  modoki: {
    title: "El Niño Modoki (Tri-polar Configuration)",
    short: "An unusual tri-polar ocean-atmosphere spatial structure where sea surface warming is centered strictly within the Central Pacific (Niño 4 zone) rather than the South American coastline.",
    physics: "Dual-branch subsidence: Deep convection rises under the International Date Line, splitting the Walker circulation into two downwelling branches that dry out both the Peruvian coast and the Indonesian archipelago.",
  }
};

const getSimulatedData = (scen: "active" | "neutral" | "lanina" | "modoki", baseData: EnsoDashboardData): EnsoDashboardData => {
  const base = baseData;
  if (scen === "active") return base;

  // Perfect deep-nested value copy
  const cloned = structuredClone(base) as EnsoDashboardData;

  if (scen === "neutral") {
    // SST near flat baseline
    cloned.nino34_weekly = cloned.nino34_weekly.map(d => ({ ...d, value: d.value * 0.12 }));
    cloned.soi_monthly = cloned.soi_monthly.map(d => ({ ...d, value: d.value * 0.12 }));
    cloned.wwv_monthly = cloned.wwv_monthly.map(d => ({ ...d, value: d.value * 0.12 }));
    cloned.oni_monthly = cloned.oni_monthly.map(d => ({ ...d, value: d.value * 0.12 }));

    // Subsurface neutral thermal anomalies (months × depth × lon)
    cloned.subsurface_temp.anomaly = cloned.subsurface_temp.anomaly.map(month =>
      month.map(row => row.map(val => val * 0.15))
    );

    // Minor flat anomalies on maps
    cloned.olr_anomaly.data = cloned.olr_anomaly.data.map(row => row.map(val => val * 0.12));
    cloned.precip_forecast.anomaly_percent = cloned.precip_forecast.anomaly_percent.map(row => row.map(val => val * 0.12));

    // Walker trade normal - slightly negative u anomalies (westward wind)
    cloned.wind850_anomaly.u = cloned.wind850_anomaly.u.map(row => row.map(val => -Math.abs(val) * 0.28));
    cloned.wind850_anomaly.v = cloned.wind850_anomaly.v.map(row => row.map(val => val * 0.1));

    // Forecast Plumes flat transition
    cloned.ensemble_plume.consensus = cloned.ensemble_plume.consensus.map(v => v * 0.15);
    cloned.ensemble_plume.models = cloned.ensemble_plume.models.map(m => ({
      ...m,
      values: m.values.map(v => v * 0.15)
    }));

    cloned.enso_status = {
      advisory: "ENSO Balanced Phase",
      strength: "Normal Climatology"
    };
  } else if (scen === "lanina") {
    // Highly cold SST
    cloned.nino34_weekly = cloned.nino34_weekly.map(d => ({ ...d, value: -d.value * 0.65 }));
    cloned.soi_monthly = cloned.soi_monthly.map(d => ({ ...d, value: -d.value * 0.75 }));
    cloned.wwv_monthly = cloned.wwv_monthly.map(d => ({ ...d, value: -d.value * 0.65 }));
    cloned.oni_monthly = cloned.oni_monthly.map(d => ({ ...d, value: -d.value * 0.7 }));

    // Deep east Pacific cooling, thermocline rise
    cloned.subsurface_temp.anomaly = cloned.subsurface_temp.anomaly.map(month =>
      month.map(row => row.map((val, lIdx) => {
        if (lIdx < 16) {
          return Math.max(-0.4, val * 0.35); // Western pool warmth
        } else {
          return -val * 0.75; // Eastern cold water plunge
        }
      }))
    );

    // Spatial fields flipped positive-to-negative
    cloned.olr_anomaly.data = cloned.olr_anomaly.data.map(row => row.map(val => -val * 0.95));
    cloned.precip_forecast.anomaly_percent = cloned.precip_forecast.anomaly_percent.map(row => row.map(val => -val * 0.95));

    // Strong negative u anomalies indicating severe westward trades
    cloned.wind850_anomaly.u = cloned.wind850_anomaly.u.map(row => row.map(val => -val * 0.75));
    cloned.wind850_anomaly.v = cloned.wind850_anomaly.v.map(row => row.map(val => -val * 0.75));

    // Cold phase model plumes
    cloned.ensemble_plume.consensus = cloned.ensemble_plume.consensus.map(v => -v * 0.65);
    cloned.ensemble_plume.models = cloned.ensemble_plume.models.map(m => ({
      ...m,
      values: m.values.map(v => -v * 0.65)
    }));

    cloned.enso_status = {
      advisory: "La Niña Active watch",
      strength: "Cold Episode"
    };
  } else if (scen === "modoki") {
    // Modoki centermost anomalies
    cloned.nino34_weekly = cloned.nino34_weekly.map(d => ({ ...d, value: d.value * 0.5 }));
    cloned.soi_monthly = cloned.soi_monthly.map(d => ({ ...d, value: d.value * 0.45 }));
    cloned.wwv_monthly = cloned.wwv_monthly.map(d => ({ ...d, value: d.value * 0.45 }));
    cloned.oni_monthly = cloned.oni_monthly.map(d => ({ ...d, value: d.value * 0.55 }));

    // Warmth centers in Central Pacific
    cloned.subsurface_temp.anomaly = cloned.subsurface_temp.anomaly.map(month =>
      month.map(row => row.map((val, lIdx) => {
        if (lIdx >= 10 && lIdx <= 26) {
          return val * 0.85;
        } else {
          return -val * 0.45;
        }
      }))
    );

    // Central cloud anomalies
    cloned.olr_anomaly.data = cloned.olr_anomaly.data.map((row) => 
      row.map((val, lIdx) => {
        if (lIdx >= 12 && lIdx <= 24) {
          return val * 0.9;
        } else {
          return -val * 0.55;
        }
      })
    );

    cloned.precip_forecast.anomaly_percent = cloned.precip_forecast.anomaly_percent.map((row) => 
      row.map((val, lIdx) => {
        if (lIdx >= 30 && lIdx <= 60) {
          return val * 0.9;
        } else {
          return -val * 0.55;
        }
      })
    );

    // Converge wind vectors locally
    cloned.wind850_anomaly.u = cloned.wind850_anomaly.u.map((row) => 
      row.map((val, lIdx) => {
        if (lIdx < 17) {
          return Math.abs(val) * 0.6;
        } else {
          return -Math.abs(val) * 0.6;
        }
      })
    );

    cloned.ensemble_plume.consensus = cloned.ensemble_plume.consensus.map(v => v * 0.5);
    cloned.ensemble_plume.models = cloned.ensemble_plume.models.map(m => ({
      ...m,
      values: m.values.map(v => v * 0.5)
    }));

    cloned.enso_status = {
      advisory: "El Niño Modoki Watch",
      strength: "Central Pacific SST"
    };
  }

  return cloned;
};

export default function App() {
  const [currentScenario, setCurrentScenario] = useState<"active" | "neutral" | "lanina" | "modoki">("active");
  const [liveData, setLiveData] = useState<EnsoDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(true);
  const [mapType, setMapType] = useState<"olr" | "precip">("precip");
  const [briefing, setBriefing] = useState<ExpertBriefing | null>(null);

  // --- Live data fetch on mount + hourly polling ---
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchLiveEnsoData();
        if (cancelled) return;
        if (data) {
          setLiveData(data);
          setDataError(null);
        } else {
          setDataError('Proxy offline — geen data ontvangen');
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err instanceof Error ? err.message : 'Onbekende fout');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // Eerste fetch direct
    loadData();

    // Daarna elk uur pollen
    const intervalId = setInterval(loadData, 3_600_000); // 1 uur

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  // AI expert briefing + news digest (optional, non-blocking)
  useEffect(() => {
    let cancelled = false;
    fetchExpertBriefing().then(b => {
      if (!cancelled && b) setBriefing(b);
    });
    return () => { cancelled = true; };
  }, []);

  // --- Reken scenario op basis van liveData ---
  // Wanneer liveData verandert of de gebruiker een ander scenario kiest,
  // passen we de D3-transformaties toe op de basis dataset.
  const displayData: EnsoDashboardData | null = useMemo(() => {
    if (!liveData) return null;
    return getSimulatedData(currentScenario, liveData);
  }, [liveData, currentScenario]);

  // Callback: force refresh
  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    fetchLiveEnsoData().then(data => {
      if (data) {
        setLiveData(data);
        setDataError(null);
      }
      setIsLoading(false);
    });
  }, []);

  // Guard: loading state tonen zolang er geen data is
  if (!displayData) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-[#EAECEF] font-sans flex items-center justify-center relative overflow-hidden">
        {/* Grid + glow achtergrond */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.15] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-red-900/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[150px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-6 z-10"
        >
          {/* Glazen spinner */}
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-2 border-white/5 bg-white/[0.02] backdrop-blur-xl" />
            <div className="absolute inset-1 rounded-full border-t-2 border-r-2 border-red-500/60 animate-spin" />
            <div className="absolute inset-3 rounded-full border-b-2 border-l-2 border-sky-500/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg">🌊</span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-[#EAECEF] to-gray-500 bg-clip-text text-transparent">
              Loading ENSO Data
            </h2>
            <p className="text-sm text-gray-400 font-light max-w-md">
              {isLoading
                ? 'Loading live ENSO data from NOAA/PSL/CPC endpoints ...'
                : dataError
                  ? `⚠ ${dataError}`
                  : 'Waiting for initial data...'}
            </p>
            {dataError && (
              <button
                onClick={handleRefresh}
                className="mt-4 px-5 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl cursor-pointer text-xs font-mono transition-all text-gray-300 hover:text-white"
              >
                ⟳ Retry Connection
              </button>
            )}
          </div>

          <div className="mt-8 text-[10px] text-gray-600 font-mono text-center max-w-md leading-relaxed">
            <p>Fetching data.json — live indices, GODAS ocean fields and the latest CPC advisory.</p>
            <p className="mt-2 text-gray-600">If this persists, check the site status or GitHub Actions pipeline health.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Scientific Constants calculated from live data
  const nip = displayData.nino34_weekly;
  const sop = displayData.soi_monthly;
  const wvp = displayData.wwv_monthly;
  const oni = displayData.oni_monthly;
  const currentNino = nip.length > 0 ? nip[nip.length - 1].value : 0;
  const currentSOI = sop.length > 0 ? sop[sop.length - 1].value : 0;
  const currentWWV = wvp.length > 0 ? wvp[wvp.length - 1].value : 0;
  const lastONI = oni.length > 0 ? oni[oni.length - 1].value : 0;
  const sourceCounts = useMemo(() => {
    const counts = { live: 0, derived: 0, synthetic: 0 };
    if (!displayData?.sources) return counts;
    Object.values(displayData.sources).forEach(src => {
      if (src === "live") counts.live += 1;
      else if (src === "derived") counts.derived += 1;
      else if (src === "synthetic") counts.synthetic += 1;
    });
    return counts;
  }, [displayData]);

  const freshnessLabel = useMemo(() => {
    if (!displayData?.generated_at) return "—";
    const updated = new Date(displayData.generated_at);
    const hours = Math.max(0, Math.round((Date.now() - updated.getTime()) / 3_600_000));
    if (hours < 1) return "updated <1h ago";
    if (hours < 24) return `updated ${hours}h ago`;
    return `updated ${Math.floor(hours / 24)}d ago`;
  }, [displayData]);

  const dataSourceLabel = dataError ? 'ERROR' : displayData?.sources?.nino34 === 'live' ? 'LIVE NOAA' : 'PARTIAL';
  const dataSourceColor = dataError ? 'text-red-400' : displayData?.sources?.nino34 === 'live' ? 'text-green-400' : 'text-amber-400';

  return (
    <div id="en-nino-root" className="min-h-screen bg-[#0B0F19] text-[#EAECEF] font-sans selection:bg-red-500/30 selection:text-white px-4 py-8 md:px-8 overflow-x-hidden relative">
      {/* GRID BACKGROUND PATTERN */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.15] pointer-events-none" />

      {/* GLOWING AMBIENT SCENERY BACKGROUND ORBS */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-[150px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-amber-950/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* DASHBOARD CONTAINER WIDTH STABILIZER */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-7xl mx-auto space-y-8 relative z-10"
      >
        
        {/* TOP META BAR & OBSERVATION STATE */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                currentScenario === "active" ? "bg-red-500" :
                currentScenario === "neutral" ? "bg-slate-500" :
                currentScenario === "lanina" ? "bg-sky-500" : "bg-amber-500"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                currentScenario === "active" ? "bg-red-600" :
                currentScenario === "neutral" ? "bg-slate-600" :
                currentScenario === "lanina" ? "bg-sky-600" : "bg-amber-600"
              }`}></span>
            </span>
            {currentScenario === "active" && (
              <div className="text-xs font-mono tracking-widest text-[#FF4E4E] font-bold uppercase flex items-center gap-1.5 bg-red-950/40 px-3 py-1 rounded-full border border-red-950">
                <Flame className="w-3.5 h-3.5" /> {displayData?.enso_status?.advisory || "ENSO MONITORING"} — {displayData?.enso_status?.category || "—"}
              </div>
            )}
            {currentScenario === "neutral" && (
              <div className="text-xs font-mono tracking-widest text-slate-400 font-bold uppercase flex items-center gap-1.5 bg-slate-950/40 px-3 py-1 rounded-full border border-slate-800">
                <Wind className="w-3.5 h-3.5" /> ENSO NEUTRAL CONDITIONS
              </div>
            )}
            {currentScenario === "lanina" && (
              <div className="text-xs font-mono tracking-widest text-sky-400 font-bold uppercase flex items-center gap-1.5 bg-sky-950/40 px-3 py-1 rounded-full border border-sky-950">
                <TrendingDown className="w-3.5 h-3.5" /> LA NIÑA ACTIVE MATCH
              </div>
            )}
            {currentScenario === "modoki" && (
              <div className="text-xs font-mono tracking-widest text-amber-400 font-bold uppercase flex items-center gap-1.5 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-950">
                <Compass className="w-3.5 h-3.5" /> EL NIÑO MODOKI WATCH
              </div>
            )}
            <div className="text-[10px] font-mono text-gray-500 flex items-center gap-2">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-bold">{sourceCounts.live} LIVE</span>
              <span>·</span>
              <span className="text-amber-400 font-bold">{sourceCounts.derived} DERIVED</span>
              <span>·</span>
              <span className="text-rose-400 font-bold">{sourceCounts.synthetic} SYNTHETIC</span>
            </div>
          </div>
          <div className="text-xs font-mono text-gray-450 bg-white/5 px-3 py-1.5 rounded border border-white/5 flex items-center gap-2">
            <Database className={`w-3 h-3 ${dataError ? 'text-red-400' : 'text-green-400'}`} />
            <span className={`text-[10px] uppercase font-bold mr-1 ${dataError ? 'text-red-400' : 'text-green-400'}`}>
              [{dataSourceLabel}]
            </span>
            <span className="text-gray-500">|</span>
            <span title={liveData?.generated_at || ''}>Data: <strong className="text-white">{liveData?.generated_at?.split('T')[0] || '---'}</strong></span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-500">{freshnessLabel}</span>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="ml-1 px-2 py-0.5 bg-white/5 hover:bg-white/15 active:scale-95 rounded text-[9px] font-mono disabled:opacity-30 transition-all cursor-pointer"
              title="Force refresh data from proxy"
            >
              {isLoading ? '...' : '⟳'}
            </button>
          </div>
        </div>

        {/* HERO TITLE BLOCK */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6"
        >
          <div className="space-y-1">
            <h1 className="text-3xl md:text-5xl font-sans font-extrabold tracking-tight bg-gradient-to-r from-white via-[#EAECEF] to-gray-500 bg-clip-text text-transparent">
              EL NIÑO WATCH 2026
            </h1>
            <p className="text-sm md:text-base text-gray-400 max-w-2xl font-light">
              Coupled Atmosphere-Ocean Global Climate Diagnostic System. Tracking anomalous tropical trade wind relaxation, baric indexers, and ocean sub-surface anomalies.
            </p>
          </div>
          
          <button 
            type="button"
            id="audit-toggle-btn"
            onClick={() => setIsAuditOpen(!isAuditOpen)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl cursor-pointer text-xs font-mono transition-all text-gray-300 hover:text-white shadow-xl"
          >
            <Info className="w-4 h-4 text-[#FF4E4E]" />
            <span>{isAuditOpen ? "HIDE METEOROLOGICAL DEFECT LOGS" : "SHOW METEOROLOGICAL DEFECT LOGS"}</span>
          </button>
        </motion.div>

        {/* INTERACTIVE CLIMATE SIMULATION ROOM */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          id="simulation-room-card" 
          className="bg-slate-900/10 backdrop-blur-3xl p-6 shadow-2xl rounded-2xl border border-white/5 relative overflow-hidden group"
        >
          {/* Ambient background glow orb */}
          <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-[90px] pointer-events-none transition-all duration-700 ${
            currentScenario === "active" ? "bg-red-500/10 group-hover:bg-red-500/15" :
            currentScenario === "neutral" ? "bg-slate-500/10 group-hover:bg-slate-500/15" :
            currentScenario === "lanina" ? "bg-sky-500/10 group-hover:bg-sky-500/15" : "bg-amber-500/10 group-hover:bg-amber-500/15"
          }`} />
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-white/5 pb-5">
            <div className="space-y-1">
              <span className={`text-[10px] font-mono tracking-widest font-extrabold px-2.5 py-0.5 rounded border uppercase transition-colors ${
                currentScenario === "active" ? "text-red-400 border-red-900/50 bg-red-950/20" :
                currentScenario === "neutral" ? "text-slate-400 border-slate-800 bg-slate-950/20" :
                currentScenario === "lanina" ? "text-sky-400 border-sky-900/50 bg-sky-950/20" : "text-amber-500 border-amber-900/50 bg-amber-950/20"
              }`}>
                Meteorological Lab Setup
              </span>
              <h2 className="text-base font-sans font-extrabold text-white tracking-wider uppercase flex items-center gap-2 mt-1">
                <Compass className={`w-4 h-4 ${
                  currentScenario === "active" ? "text-[#FF4E4E]" :
                  currentScenario === "neutral" ? "text-slate-400" :
                  currentScenario === "lanina" ? "text-sky-400" : "text-amber-500"
                }`} />
                ENSO Basin Oscillation Simulation Deck
              </h2>
              <p className="text-xs font-mono text-gray-400 font-light">
                Select a planetary atmospheric configuration to trigger Walker cell variations and coordinate ocean temperature models.
              </p>
            </div>
            
            {/* Scenario buttons */}
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 bg-slate-950/80 p-1 rounded-xl border border-white/5 w-full lg:w-auto">
              {(["active", "neutral", "lanina", "modoki"] as const).map((scen) => (
                <button
                  key={scen}
                  type="button"
                  id={`btn-scen-${scen}`}
                  onClick={() => setCurrentScenario(scen)}
                  className={`px-3 py-2 text-[11px] font-mono font-extrabold rounded-lg cursor-pointer transition-all ${
                    currentScenario === scen
                    ? scen === "active" ? "bg-[#FF4E4E] text-white shadow-lg shadow-red-950/40" :
                      scen === "neutral" ? "bg-slate-600 text-white shadow-lg shadow-slate-950/40" :
                      scen === "lanina" ? "bg-[#38bdf8] text-slate-950 shadow-lg shadow-sky-950/40" :
                      "bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/40"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {scen === "active" && "★ ACTIVE EL NIÑO"}
                  {scen === "neutral" && "ENSO NEUTRAL"}
                  {scen === "lanina" && "LA NIÑA PHASE"}
                  {scen === "modoki" && "EL NIÑO MODOKI"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
            <div className="lg:col-span-8 space-y-3">
              <h3 className="text-xs font-sans font-bold text-slate-200 tracking-wider uppercase flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  currentScenario === "active" ? "bg-red-500" :
                  currentScenario === "neutral" ? "bg-slate-400" :
                  currentScenario === "lanina" ? "bg-sky-500" : "bg-amber-500"
                }`} />
                {SCENARIO_DETAILS[currentScenario].title}
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed font-light font-sans">
                {SCENARIO_DETAILS[currentScenario].short}
              </p>
              <div className="text-[11px] text-gray-300 leading-relaxed bg-black/40 p-3 rounded-lg border border-white/5 flex flex-col sm:flex-row gap-1.5">
                <span className={`font-mono font-bold uppercase shrink-0 ${
                  currentScenario === "active" ? "text-red-400" :
                  currentScenario === "neutral" ? "text-slate-400" :
                  currentScenario === "lanina" ? "text-sky-450" : "text-amber-550"
                }`}>
                  PHYSICAL COUPLING DYNAMICS:
                </span>
                <span className="font-light font-mono">{SCENARIO_DETAILS[currentScenario].physics}</span>
              </div>
            </div>
            
            <div className="lg:col-span-4 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-white/5 pt-5 lg:pt-0 lg:pl-6 space-y-3">
              <div>
                <span className="text-[10px] text-gray-500 font-mono block uppercase">Simulated Index Level:</span>
                <span className={`text-2xl md:text-3xl font-sans font-black tracking-tight block ${
                  currentScenario === "active" ? "text-red-400" :
                  currentScenario === "neutral" ? "text-slate-300" :
                  currentScenario === "lanina" ? "text-sky-400" : "text-amber-400"
                }`}>
                  {currentScenario === "active" && (displayData?.current?.nino34
                    ? `${displayData.current.nino34.value >= 0 ? "+" : ""}${displayData.current.nino34.value.toFixed(2)}°C Niño-3.4`
                    : "+—°C")}
                  {currentScenario === "neutral" && "+0.1°C Balanced"}
                  {currentScenario === "lanina" && "-1.7°C Extreme Cold"}
                  {currentScenario === "modoki" && "+1.3°C Centralized"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  currentScenario === "active" ? "bg-red-500 shadow-[0_0_10px_#ef4444]" :
                  currentScenario === "neutral" ? "bg-slate-400 shadow-[0_0_10px_#94a3b8]" :
                  currentScenario === "lanina" ? "bg-sky-500 shadow-[0_0_10px_#0ea5e9]" :
                  "bg-amber-500 shadow-[0_0_10px_#f59e0b]"
                }`} />
                <span className="text-[10px] font-mono tracking-wider font-extrabold text-gray-300 uppercase">
                  {currentScenario === "active" && "CRITICAL WARM PHASE ACTIVE"}
                  {currentScenario === "neutral" && "SYMMETRICAL CONVECTIVE STATE"}
                  {currentScenario === "lanina" && "UPWELLING COLD-TONGUE EXPANSION"}
                  {currentScenario === "modoki" && "MID-BASIN COUPLED THERMAL ANOMALY"}
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* INTERACTIVE MATHEMATICAL & VISUAL RECTIFICATION LOG */}
        <AnimatePresence>
          {isAuditOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div id="audit-logs-card" className="bg-amber-950/10 backdrop-blur-sm p-6 border rounded-2xl border-amber-500/15 bg-gradient-to-br from-amber-950/20 to-neutral-900/40">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/25">
                    <CheckCircle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-sans font-bold text-amber-300 tracking-wider uppercase">
                      Meteorological Scientific & Mathematical Correction Report
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Our platform refactored all legacy SVG overlays, emojis, and raw HTML mutations to direct modern React coordinates matching Tier-1 institutional standards:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                  
                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-white/5 space-y-1">
                    <div className="flex gap-2 text-red-400 font-bold">
                      <span>✕</span>
                      <span>DISCRETE SPATIAL DOT RASTER</span>
                    </div>
                    <div className="text-green-400 font-bold">
                      <span>✓</span>
                      <span>CONTINUOUS ISOPLETH GEO-CONTOURS</span>
                    </div>
                    <p className="text-gray-400 leading-relaxed mt-1 text-[11px]">
                      Hobby dots are replaced with high-fidelity bilinear grid interpolation, calculating true smoothed filled contour polygons (`d3.contours()`) projected onto the tracking Pacific grid.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-white/5 space-y-1">
                    <div className="flex gap-2 text-red-400 font-bold">
                      <span>✕</span>
                      <span>JAGGY TEMPORAL CHART PATHS</span>
                    </div>
                    <div className="text-green-400 font-bold">
                      <span>✓</span>
                      <span>SHAPE-PRESERVING SPLINES</span>
                    </div>
                    <p className="text-gray-400 leading-relaxed mt-1 text-[11px]">
                      Jaggy step-segments transformed into smooth path trajectories using shape-preserving `curveCatmullRom` and model envelope bounds, conveying model consensus smoothly.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-white/5 space-y-1">
                    <div className="flex gap-2 text-red-400 font-bold">
                      <span>✕</span>
                      <span>UNZEROED COLD HEATMAPS</span>
                    </div>
                    <div className="text-green-400 font-bold">
                      <span>✓</span>
                      <span>STRICT ZERO-CENTER DIVERGENT SCALE</span>
                    </div>
                    <p className="text-gray-400 leading-relaxed mt-1 text-[11px]">
                      Ensured absolute thermocline neutral boundaries where 0.0°C is strictly absolute deep-dark space, with symmetric thermal limits matching the NOAA subsurface guidelines.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-white/5 space-y-1">
                    <div className="flex gap-2 text-red-400 font-bold">
                      <span>✕</span>
                      <span>DISJOINED OCEAN-ATMOSPHERE ARROWS</span>
                    </div>
                    <div className="text-green-400 font-bold">
                      <span>✓</span>
                      <span>DYNAMIC DEC.GL STREAMLINE VECTORS</span>
                    </div>
                    <p className="text-gray-400 leading-relaxed mt-1 text-[11px]">
                      Equatorial wind anomalies mapped dynamically as moving streamlines using Deck.gl or custom high-fidelity SVG coordinates, visually tracking trade winds.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-white/5 space-y-1">
                    <div className="flex gap-2 text-red-400 font-bold">
                      <span>✕</span>
                      <span>EMOJI-CLUTTERED CROSS SECTION</span>
                    </div>
                    <div className="text-green-400 font-bold">
                      <span>✓</span>
                      <span>HIGH-FIDELITY ATMOSPHERIC RECIRCULATOR</span>
                    </div>
                    <p className="text-gray-400 leading-relaxed mt-1 text-[11px]">
                      Removed amateur emoji clouds. Implemented custom vector clouds and a linear-animated airflow loop which swaps vector flow based on El Niño vs La Niña.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950/40 rounded-xl border border-white/5 space-y-1">
                    <div className="flex gap-2 text-red-400 font-bold">
                      <span>✕</span>
                      <span>STATIC TEXT TOOLTIPS</span>
                    </div>
                    <div className="text-green-400 font-bold">
                      <span>✓</span>
                      <span>FRAMER MOTION GLASSMOPHISM DESIGNS</span>
                    </div>
                    <p className="text-gray-400 leading-relaxed mt-1 text-[11px]">
                      Interactive synchronized vertical crosshairs link atmosphere (SOI) and ocean temperatures, serving unified scientific telemetry indicators on mouse hover.
                    </p>
                  </div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO METEOROLOGICAL KPI INDICATOR GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* KPI 1: NIÑO 3.4 ANOMALY */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            id="kpi-nino34" 
            className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 relative flex flex-col justify-between overflow-hidden hover:border-red-500/20 transition-all group shadow-xl"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all pointer-events-none" />
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-gray-400 uppercase font-bold">
                <span>Niño 3.4 SST Anomaly</span>
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-red-500 font-sans">
                  {currentNino >= 0 ? "+" : ""}{currentNino.toFixed(1)}°C
                </span>
                <span className="text-xs font-mono text-gray-500">
                  {currentNino >= 0 ? "Above baseline" : "Below baseline"}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-light font-sans">
                Extreme equatorial Pacific sea surface warming.
              </p>
            </div>
            
            {/* Embedded Mini D3 Sparkline of Niño 3.4 */}
            <div className="h-10 mt-4 overflow-visible">
              <SparklineMini 
                data={displayData.nino34_weekly.map(d => ({ value: d.value }))} 
                color="#ef4444" 
                gradientId="ninoSparkGrad" 
              />
            </div>
          </motion.div>

          {/* KPI 2: SOI */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            id="kpi-soi" 
            className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 relative flex flex-col justify-between overflow-hidden group hover:border-sky-500/20 shadow-xl transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-gray-400 uppercase font-bold">
                <span>Southern Oscillation Index</span>
                <Wind className="w-4 h-4 text-sky-400 animate-pulse" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-sky-400 font-sans">
                  {currentSOI.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-gray-500">Index pts</span>
              </div>
              <p className="text-xs text-gray-400 font-light font-sans">
                Extreme low pressure over Tahiti. Core trade winds fully reversed.
              </p>
            </div>
            
            {/* Embedded Mini D3 Sparkline of SOI */}
            <div className="h-10 mt-4 overflow-visible">
              <SparklineMini 
                data={displayData.soi_monthly.map(d => ({ value: d.value }))} 
                color="#38bdf8" 
                gradientId="soiSparkGrad" 
                reverse={true} 
              />
            </div>
          </motion.div>

          {/* KPI 3: WWV ANOMALY */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            id="kpi-wwv" 
            className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 relative flex flex-col justify-between overflow-hidden group hover:border-amber-500/20 shadow-xl transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-gray-400 uppercase font-bold">
                <span>Warm Water Volume (WWV)</span>
                <Thermometer className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-amber-500 font-sans">
                  {currentWWV >= 0 ? "+" : ""}{currentWWV.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-gray-500">Std. Dev</span>
              </div>
              <p className="text-xs text-gray-400 font-light font-sans">
                Water thermal volume index (upper 300m heat content).
              </p>
            </div>
            
            {/* Embedded Mini D3 Sparkline of WWV */}
            <div className="h-10 mt-4 overflow-visible">
              <SparklineMini 
                data={displayData.wwv_monthly.map(d => ({ value: d.value }))} 
                color="#f59e0b" 
                gradientId="wwvSparkGrad" 
              />
            </div>
          </motion.div>

          {/* KPI 4: ONI */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            id="kpi-oni" 
            className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 relative flex flex-col justify-between overflow-hidden group hover:border-rose-500/20 shadow-xl transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ec4899]/5 rounded-full blur-2xl group-hover:bg-[#ec4899]/10 transition-all pointer-events-none" />
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-gray-400 uppercase font-bold">
                <span>Oceanic Niño Index (ONI)</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-rose-400 font-sans">
                  {lastONI >= 0 ? "+" : ""}{lastONI.toFixed(2)}°C
                </span>
                <span className="text-xs font-mono text-gray-500">3-mo Mean Anomaly</span>
              </div>
              <p className="text-xs text-gray-400 font-light font-sans">
                Continuous 3-month rolling average in southern tracking zones.
              </p>
            </div>
            
            {/* Horizontal progress representation of historic strength categories */}
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                <span>Moderate (+1.0)</span>
                <span className="text-rose-400 font-bold">Extreme (+2.3)</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-rose-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (Math.abs(lastONI) / 2.5) * 100)}%` }}
                />
              </div>
            </div>
          </motion.div>

        </section>

        {/* PRIMARY SCIENTIFIC BENTO GRID PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* PANEL A (LEFT BLOCK): SPACIOUS TIME SERIES COUPLING */}
          <section id="coupled-dynamics-panel" className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 lg:col-span-8 flex flex-col justify-between space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
              <div>
                <h2 className="text-xs font-sans font-bold text-gray-200 tracking-wider uppercase flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-[#FF4E4E] rounded-full inline-block" />
                  Coupled Ocean-Atmosphere Dynamical Feedback Loop
                </h2>
                <p className="text-xs text-gray-400 mt-1 font-sans">
                  Comparing Sea Surface Temperate anomalies (Ocean) against the Southern Oscillation Index (Atmosphere) shows tight physical coupling.
                </p>
              </div>
            </div>

            {/* D3 LINE GRAPH TARGET */}
            <div className="w-full relative">
              <CoupledTimeSeriesChart data={displayData} />
            </div>

            <div className="text-[10px] text-gray-500 font-mono flex items-center justify-between border-t border-white/5 pt-2">
              <span>* High anti-symmetric trajectories: as SOI atmospheric index plunges, sea anomalies spike concurrently.</span>
              <span>2025-2026 Telemetry</span>
            </div>
          </section>

          {/* PANEL B (RIGHT BLOCK): ENSEMBLE FORECAST PLUMES */}
          <section id="forecast-plumes-panel" className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 lg:col-span-4 flex flex-col justify-between space-y-4">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-xs font-sans font-bold text-gray-200 tracking-wider uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full inline-block" />
                ENSO Super Ensemble Temperature Plumes
              </h2>
              <p className="text-xs text-gray-400 mt-1 font-light font-sans">
                Anomalies forecast trends out to Feb 2027 from 7 prime global models.
              </p>
            </div>

            {/* PLUMES D3 TARGET */}
            <div className="w-full overflow-visible relative">
              <EnsemblePlumesChart data={displayData.ensemble_plume} />
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1.5">
                <div className="text-[10px] font-mono tracking-wider font-bold text-gray-400 uppercase border-b border-white/5 pb-0.5">CPC OFFICIAL OUTLOOK:</div>
                <div className="space-y-1 text-[9px] font-mono">
                  {displayData?.enso_status?.probabilities?.very_strong_chance && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-rose-300 font-bold">
                        {displayData.enso_status.probabilities.very_strong_chance} chance of {displayData.enso_status.probabilities.very_strong_event || "a strong event"}
                      </span>
                    </div>
                  )}
                  {displayData?.enso_status?.issued && (
                    <div className="text-gray-500 pt-1 border-t border-white/5">
                      Official discussion: {displayData.enso_status.issued}
                      {displayData.enso_status.next_discussion ? ` · next: ${displayData.enso_status.next_discussion}` : ""}
                    </div>
                  )}
                  <div className="text-gray-600">
                    Plume models: CFSv2 · ECMWF · UKMO · GFDL · NASA · JMA · Statistical
                    {displayData?.sources?.plume === "synthetic" ? " (schematic — official IRI figure linked below)" : ""}
                  </div>
                </div>
              </div>
          </section>

        </div>

        {/* COMPREHENSIVE GRASS GEOGRAPHIC & SUBSURFACE CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* WESTERN PACIFIC EQUATORIAL HOVMÖLLER SECTOR DIAGRAM */}
          <section id="hovmoller-subsurface-panel" className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
              <div>
                <h3 className="text-xs font-sans font-bold text-gray-200 tracking-wider uppercase flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-amber-500 rounded-full inline-block" />
                  Subsurface Thermal Profile (Equatorial Hovmöller 2°S - 2°N)
                </h3>
                <p className="text-xs text-gray-400 mt-1 font-sans">
                  Vertical ocean depth profile from New Guinea (120°E) to Ecuador (80°W). Tracks subsurface thermal volume charges.
                </p>
              </div>
            </div>

            {/* HOVMÖLLER HEATMAP & ISOTHERMS CANVAS */}
            <div className="w-full relative overflow-visible">
              <HovmollerDiagram chartData={displayData.subsurface_temp} />
            </div>

            <div className="flex items-center justify-between text-[9px] text-gray-500 font-mono border-t border-white/5 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-4 h-2 bg-gradient-to-r from-blue-600 via-slate-900 to-red-650 border border-white/10" />
                <span>Zero-centered divergent heatmap (−3.0°C Blue to +6.0°C Crimson) · GODAS</span>
              </div>
              <span>Equatorial Depth: 5m to 295m</span>
            </div>
          </section>

          {/* GEOGRAPHIC TROPICAL ANOMALY PLOT WITH CONTOURS + WIND VECTORS */}
          <section id="geographical-map-panel" className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
              <div>
                <h3 className="text-xs font-sans font-bold text-gray-200 tracking-wider uppercase flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-sky-500 rounded-full inline-block" />
                  Equatorial Spatial Anomaly Field
                </h3>
                <p className="text-xs text-gray-400 mt-1 font-sans">
                  Bi-linear grid contour isopleths indicating precipitation or outward atmospheric longwave convection anomalies.
                </p>
              </div>
              
              {/* SWITCH THE MAP FROM OLR TO PRECIPITATION ANOMALY */}
              <div className="flex bg-[#030712] border border-white/10 rounded-lg p-0.5 text-[9px] font-mono select-none">
                <button 
                  type="button"
                  id="tab-precip"
                  onClick={() => setMapType("precip")}
                  className={`px-3 py-1 rounded cursor-pointer font-bold transition-all ${mapType === "precip" ? "bg-amber-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  PRECIPITATION
                </button>
                <button 
                  type="button"
                  id="tab-olr"
                  onClick={() => setMapType("olr")}
                  className={`px-3 py-1 rounded cursor-pointer font-bold transition-all ${mapType === "olr" ? "bg-red-500 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  CONVECTION (OLR)
                </button>
              </div>
            </div>

            {/* MAP RENDERING CANVAS (lazy-loaded deck.gl engine) */}
            <div className="w-full relative overflow-visible">
              <Suspense fallback={
                <div className="h-72 flex items-center justify-center text-[10px] font-mono text-gray-500">
                  Loading map engine…
                </div>
              }>
                <GeographicContoursMap
                  olrData={displayData.olr_anomaly}
                  precipData={displayData.precip_forecast}
                  windData={displayData.wind850_anomaly}
                  mapType={mapType}
                />
              </Suspense>
            </div>

            <p className="text-[10px] text-gray-405 leading-relaxed bg-[#0b0f19]/80 p-3 rounded-lg border border-white/5 font-mono">
              <span className="text-amber-500 font-bold block mb-1">ATMOSPHERIC STREAMLINE VECTORS:</span>
              The moving streamline vectors indicate anomalous **850hPa trade winds**. Eastward surges in El Niño show trade wind collapse pushing the warm pool to South America, fully reversing convective cycles.
            </p>
          </section>

        </div>

        {/* ADVANCED CLIMATE MODELLING & HUMANITARIAN RESEARCH SUITE */}
        <section className="border-t border-white/5 pt-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-sans font-extrabold text-[#EAECEF] tracking-widest uppercase flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              ADVANCED METEOROLOGICAL RESEARCH SUITE
            </h3>
            <p className="text-xs text-gray-400 font-light font-sans">
              Planetary cross-sections, human risk impact indicators, and historical analog benchmarks.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WalkerCirculationSection scenario={currentScenario} />
            <RegionalImpactAtlasSection scenario={currentScenario} />
          </div>

          <HistoricAnalogsSection comparisonEvents={displayData?.comparison?.events} />
        </section>

        {/* AI EXPERT BRIEFING + NEWS DIGEST (DeepSeek, generated in the data pipeline) */}
        {briefing && (
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            id="expert-briefing-card"
            className="bg-slate-900/10 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-xl"
          >
            <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
              <Newspaper className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-sans font-extrabold text-white tracking-widest uppercase">
                AI Expert Briefing
              </h3>
              <span className="text-[9px] font-mono bg-sky-950/40 text-sky-400 px-2 py-0.5 rounded border border-sky-900/50 uppercase">
                {briefing.data_confidence} confidence · {briefing.model}
              </span>
              <span className="ml-auto text-[9px] font-mono text-gray-500">
                {briefing.generated_at?.split("T")[0]}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-3">
                <h4 className="text-lg font-sans font-bold text-sky-300">{briefing.headline}</h4>
                <p className="text-xs text-gray-300 leading-relaxed font-light">{briefing.summary}</p>
                <p className="text-xs text-gray-400 leading-relaxed font-light">{briefing.outlook}</p>
              </div>
              <div className="lg:col-span-4 space-y-3">
                {briefing.what_changed?.length > 0 && (
                  <div className="bg-slate-950/40 rounded-xl p-3 border border-white/5">
                    <div className="text-[9px] font-mono font-bold text-amber-400 uppercase mb-1.5">What changed</div>
                    <ul className="space-y-1 text-[11px] text-gray-300">
                      {briefing.what_changed.map((c, i) => <li key={i}>· {c}</li>)}
                    </ul>
                  </div>
                )}
                {briefing.risks?.length > 0 && (
                  <div className="bg-red-950/20 rounded-xl p-3 border border-red-900/30">
                    <div className="text-[9px] font-mono font-bold text-red-400 uppercase mb-1.5 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Risk factors
                    </div>
                    <ul className="space-y-1 text-[11px] text-gray-300">
                      {briefing.risks.map((r, i) => <li key={i}>· {r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {briefing.news && briefing.news.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="text-[9px] font-mono font-bold text-gray-400 uppercase mb-2">News digest</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {briefing.news.map((n, i) => (
                    <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                       className="bg-slate-950/40 rounded-xl p-3 border border-white/5 hover:border-sky-500/30 transition-colors block">
                      <div className="text-[10px] font-mono text-sky-400 uppercase mb-1">{n.source}</div>
                      <div className="text-xs text-gray-200 font-semibold leading-snug">{n.title}</div>
                      <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">{n.summary}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[9px] text-gray-600 mt-4 font-mono">{briefing.disclaimer}</p>
          </motion.section>
        )}

        {/* DOCK FOOTER COMPONENT WITH FUNCTIONAL API LINKS */}
        <footer className="border-t border-white/5 pt-8 pb-12 flex flex-col md:flex-row justify-between items-start text-xs font-mono text-gray-500 gap-6">
          <div className="space-y-2 max-w-lg">
            <p className="text-[11px] font-sans text-gray-400 font-semibold tracking-wider uppercase">Live Data Sources &amp; API Endpoints</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <a href="https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" /> Niño 3.4 SSTA (CPC)
              </a>
              <a href="https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" /> ONI Index (CPC)
              </a>
              <a href="https://www.cpc.ncep.noaa.gov/data/indices/soi" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" /> SOI (CPC)
              </a>
              <a href="https://www.pmel.noaa.gov/tao/wwv/data/WWV_5S5N_180W100W.txt" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" /> Warm Water Volume (PMEL)
              </a>
              <a href="http://iridl.ldeo.columbia.edu/SOURCES/.NOAA/.NCEP/.CPC/.GLOBAL/.daily/.olr/.anomaly/" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" /> OLR Anomaly (IRI)
              </a>
              <a href="http://iridl.ldeo.columbia.edu/SOURCES/.NOAA/.NCEP/.EMC/.CMB/.GODAS/.monthly/.temp/.anomaly/" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" /> Subsurface Temp (IRI/GODAS)
              </a>
              <a href="http://iridl.ldeo.columbia.edu/SOURCES/.NOAA/.NCEP-NCAR/.CDAS-1/.MONTHLY/.Intrinsic/.PressureLevel/.u/.anomaly/" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" /> 850hPa Wind (NCEP/NCAR)
              </a>
              <a href="https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" /> ENSO Plume (IRI)
              </a>
              <a href="http://iridl.ldeo.columbia.edu/SOURCES/.Models/.NMME/.IRI-Anomaly-Forecast/.Precipitation/.pct/" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-green-400 shrink-0" /> Precip Forecast (NMME/IRI)
              </a>
              <a href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-green-400 shrink-0" /> ENSO Advisory (CPC)
              </a>
            </div>
          </div>
          <div className="text-right space-y-1 shrink-0">
            <p className="text-[10px] text-gray-500 font-bold uppercase">Machine-readable</p>
            <div className="flex justify-end gap-3">
              <a href="data.json" className="hover:text-blue-400 transition-colors">data.json</a>
              <a href="meta.json" className="hover:text-blue-400 transition-colors">meta.json</a>
              <a href="news/latest.json" className="hover:text-blue-400 transition-colors">briefing</a>
            </div>
            <p className="text-[10px] text-gray-600">© 2026 · Data: NOAA CPC · NOAA PSL · IRI</p>
            <p className="text-[10px] text-gray-600">React · D3.js · Tailwind · Motion · Deck.gl</p>
            <p className="text-[10px] text-gray-600">AI briefings are machine-generated and not meteorologist-reviewed</p>
          </div>
        </footer>

      </motion.div>
    </div>
  );
}
