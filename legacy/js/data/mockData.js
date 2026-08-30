export const MOCKDATA = {
  nino34: {
    monthly: [],
    current: { value: 2.31, month: 'May 2026' }
  },
  oni: { value: 2.12, label: 'MAM 2026' },
  soi: { value: -18.7, label: '30-day avg May 2026', monthly: [] },
  subsurface: {
    lons: [],
    depths: [],
    values: []
  },
  olr: { grid_lat: [], grid_lon: [], values: [], u_wind: [], v_wind: [] },
  plume: { dates: [], models: [], consensus: [], p10: [], p90: [], current_idx: 0 },
  precip: { grid_lat: [], grid_lon: [], values: [] },
  soi_bars: []
};

// Generate monthly Nino3.4 data: Jan 2019 – May 2026
(function() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let d = new Date(2019, 0, 1);
  const end = new Date(2026, 4, 1);
  let idx = 0;
  const pattern = [
    // 2019: weak neutral
    0.1,0.2,0.1,0.0,-0.1,0.0,0.1,0.2,0.1,0.0,-0.1,0.0,
    // 2020: weak La Nina
    -0.2,-0.3,-0.4,-0.5,-0.6,-0.7,-0.8,-0.9,-0.8,-0.7,-0.8,-0.9,
    // 2021: moderate La Nina
    -1.0,-1.1,-1.0,-0.9,-0.8,-0.7,-0.6,-0.5,-0.4,-0.5,-0.6,-0.7,
    // 2022: weak La Nina to neutral
    -0.6,-0.5,-0.4,-0.3,-0.1,0.0,0.1,0.0,-0.1,0.0,0.1,0.2,
    // 2023: developing El Nino
    0.3,0.5,0.7,0.9,1.1,1.3,1.5,1.7,1.9,2.0,2.1,2.1,
    // 2024: strong El Nino
    2.0,1.9,1.8,1.7,1.6,1.5,1.4,1.3,1.4,1.5,1.6,1.7,
    // 2025: re-intensifying
    1.8,1.9,2.0,2.1,2.1,2.0,1.9,2.0,2.1,2.2,2.3,2.3,
    // 2026: Jan-May
    2.2,2.3,2.3,2.3,2.3
  ];
  for (let y = 2019; y <= 2026; y++) {
    const maxM = (y === 2026) ? 5 : 12;
    for (let m = 0; m < maxM; m++) {
      const v = idx < pattern.length ? pattern[idx] : 0;
      MOCKDATA.nino34.monthly.push({
        date: new Date(y, m, 1),
        value: v,
        label: months[m] + ' ' + y
      });
      idx++;
    }
  }
  MOCKDATA.nino34.current_idx = MOCKDATA.nino34.monthly.length - 1;
})();

// SOI monthly data (Jun 2025 - May 2026)
(function() {
  const vals = [-8.2, -9.5, -11.3, -13.0, -14.2, -15.1, -16.0, -16.8, -17.5, -18.0, -18.5, -18.7];
  const months = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
  const years = [2025,2025,2025,2025,2025,2025,2025,2026,2026,2026,2026,2026];
  for (let i = 0; i < 12; i++) {
    MOCKDATA.soi_bars.push({
      label: months[i] + ' ' + years[i],
      value: vals[i],
      date: new Date(years[i], (months[i]==='Jan'?0:months[i]==='Feb'?1:months[i]==='Mar'?2:months[i]==='Apr'?3:months[i]==='May'?4:months[i]==='Jun'?5:months[i]==='Jul'?6:months[i]==='Aug'?7:months[i]==='Sep'?8:months[i]==='Oct'?9:months[i]==='Nov'?10:11), 1)
    });
  }
  MOCKDATA.soi = { value: -18.7, label: '30-day avg May 2026', monthly: MOCKDATA.soi_bars };
})();

// Subsurface Hovmoller - 120E to 80W, 0-300m
(function() {
  const lons = d3.range(120, 281, 4); // 120E to 80W (280)
  const depths = d3.range(5, 301, 10); // 5 to 295m
  MOCKDATA.subsurface.lons = lons;
  MOCKDATA.subsurface.depths = depths;
  MOCKDATA.subsurface.values = [];
  for (let d of depths) {
    const row = [];
    for (let lon of lons) {
      const lonNorm = (lon - 200) / 80; // -1 to 1 centered on 200E (160W)
      const depthNorm = d / 300;
      // Warm pool in west, cold tongue in east, max anomaly at ~100m
      let val = 3.0 * Math.exp(-Math.pow(depthNorm - 0.35, 2) / 0.04) * Math.exp(-Math.pow(lonNorm + 0.3, 2) / 0.15);
      val += 1.5 * Math.exp(-Math.pow(depthNorm - 0.15, 2) / 0.02) * Math.exp(-Math.pow(lonNorm - 0.2, 2) / 0.2);
      val -= 0.5 * Math.exp(-Math.pow(depthNorm - 0.8, 2) / 0.04);
      row.push(val);
    }
    MOCKDATA.subsurface.values.push(row);
  }
})();

// OLR + Wind - simplified grid
(function() {
  const lats = d3.range(-30, 31, 5);
  const lons = d3.range(120, 291, 5);
  MOCKDATA.olr.grid_lat = lats;
  MOCKDATA.olr.grid_lon = lons;
  MOCKDATA.olr.values = [];
  MOCKDATA.olr.u_wind = [];
  MOCKDATA.olr.v_wind = [];
  for (let la of lats) {
    const row = [];
    const urow = [];
    const vrow = [];
    for (let lo of lons) {
      const x = (lo - 210) / 80;
      const y = la / 30;
      // OLR: negative (convection) in central Pacific, positive (suppressed) in west
      const olr = -25 * Math.exp(-(x*x/0.15 + y*y/0.3)) + 10 * Math.exp(-((x+0.5)*(x+0.5)/0.2 + y*y/0.4));
      row.push(olr);
      // Wind: anomalous westerlies in central/west Pacific
      urow.push(6 * Math.exp(-(x*x/0.25 + y*y/0.35)));
      vrow.push(2 * Math.exp(-(x*x/0.2 + y*y/0.15)) * (y > 0 ? -1 : 1));
    }
    MOCKDATA.olr.values.push(row);
    MOCKDATA.olr.u_wind.push(urow);
    MOCKDATA.olr.v_wind.push(vrow);
  }
})();

// Plume
(function() {
  const dates = [];
  for (let y = 2025; y <= 2027; y++) {
    const maxM = (y === 2027) ? 2 : 12;
    for (let m = 0; m < maxM; m++) {
      dates.push(new Date(y, m, 1));
    }
  }
  MOCKDATA.plume.dates = dates;
  // Models: CFSv2, ECMWF, UKMO, GFDL, NASA, JMA, NMME consensus
  const modelPeeks = {
    CFSv2: { base: 2.71, month: 21 },
    ECMWF: { base: 2.65, month: 21 },
    UKMO: { base: 2.58, month: 20 },
    GFDL: { base: 2.50, month: 22 },
    NASA: { base: 2.55, month: 21 },
    JMA: { base: 2.50, month: 20 },
    'Stat.': { base: 2.45, month: 23 }
  };
  const modelNames = Object.keys(modelPeeks);
  MOCKDATA.plume.models = [];
  for (let mn of modelNames) {
    const pk = modelPeeks[mn];
    const line = dates.map((d, i) => {
      if (i < 12) return 1.5 + Math.random() * 0.5; // 2025 spread
      const dist = i - pk.month;
      const shape = Math.exp(-dist*dist/18);
      return 1.8 + (pk.base - 1.8) * shape + (Math.random() - 0.5) * 0.15;
    });
    MOCKDATA.plume.models.push({ name: mn, values: line });
  }
  // Consensus
  MOCKDATA.plume.consensus = dates.map((d, i) => {
    let sum = 0;
    for (let m of MOCKDATA.plume.models) sum += m.values[i];
    return sum / MOCKDATA.plume.models.length;
  });
  // Percentiles
  MOCKDATA.plume.p10 = dates.map((d, i) => {
    const vals = MOCKDATA.plume.models.map(m => m.values[i]).sort((a,b)=>a-b);
    return d3.quantile(vals, 0.1);
  });
  MOCKDATA.plume.p90 = dates.map((d, i) => {
    const vals = MOCKDATA.plume.models.map(m => m.values[i]).sort((a,b)=>a-b);
    return d3.quantile(vals, 0.9);
  });
  MOCKDATA.plume.current_idx = 16; // May 2026
})();

// Precipitation anomaly - global grid
(function() {
  const lats = d3.range(-60, 61, 4);
  const lons = d3.range(0, 361, 4);
  MOCKDATA.precip.grid_lat = lats;
  MOCKDATA.precip.grid_lon = lons;
  MOCKDATA.precip.values = [];
  for (let la of lats) {
    const row = [];
    for (let lo of lons) {
      const x = (lo - 180) / 60;
      const y = la / 40;
      let val = 0;
      // El Nino typical pattern
      // Wet: eastern Africa (+)
      if (la > -10 && la < 15 && lo > 30 && lo < 60) val += 1.5 * Math.exp(-((lo-45)*(lo-45)/80 + (la-2)*(la-2)/40));
      // Wet: SE US, Peru
      if (la > 25 && la < 40 && lo > 260 && lo < 290) val += 1.8 * Math.exp(-((lo-275)*(lo-275)/60 + (la-32)*(la-32)/50));
      if (la > -20 && la < 0 && lo > 270 && lo < 290) val += 2.0 * Math.exp(-((lo-280)*(lo-280)/40 + (la-8)*(la-8)/30));
      // Dry: Indonesia / Australia
      if (la > -15 && la < 5 && lo > 100 && lo < 150) val -= 2.5 * Math.exp(-((lo-125)*(lo-125)/100 + (la+2)*(la+2)/60));
      // Dry: NE Brazil
      if (la > -15 && la < 0 && lo > 310 && lo < 340) val -= 1.5 * Math.exp(-((lo-325)*(lo-325)/50 + (la-5)*(la-5)/40));
      // Dry: southern Africa
      if (la > -30 && la < -10 && lo > 20 && lo < 40) val -= 1.0 * Math.exp(-((lo-30)*(lo-30)/30 + (la+20)*(la+20)/30));
      row.push(val);
    }
    MOCKDATA.precip.values.push(row);
  }
})();
