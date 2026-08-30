import { loadData, fetchWorldTopology, getData } from './data/dataService.js?v=4';
import { transitionValue } from './charts/utils.js?v=4';
import { drawSparkline } from './charts/sparkline.js?v=4';
import { drawNino34TS } from './charts/timeSeries.js?v=4';
import { drawHovmoller } from './charts/hovmoller.js?v=4';
import { drawOLRWind, drawPrecip } from './charts/maps.js?v=4';
import { drawSOIBars } from './charts/barChart.js?v=4';
import { drawPlume } from './charts/plume.js?v=4';

async function init() {
  // Pre-load map data and application data concurrently
  const [mapResponse, dataResponse] = await Promise.allSettled([
    fetchWorldTopology(),
    loadData()
  ]);

  const isLive = dataResponse.status === 'fulfilled' ? dataResponse.value.isLive : false;
  console.log('[DEBUG] Data loaded: ' + (isLive ? 'LIVE' : 'MOCK'));
  
  const topoData = mapResponse.status === 'fulfilled' ? mapResponse.value : null;
  const data = getData();

  renderAllCharts(data, topoData);

  if (isLive) {
    updateDomElements(data);
  }
  
  setupTabs();

  console.log('[DEBUG] All charts rendered');
}

function setupTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => {
        c.classList.remove('active');
        // Reset animations by forcing a reflow
        c.style.animation = 'none';
        c.offsetHeight; // trigger reflow
        c.style.animation = null; 
      });

      // Add active to clicked
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
      
      // Trigger D3 chart redrawing if they are SVG viewBox (they scale automatically, 
      // but re-triggering entrance animations is a nice touch if desired).
    });
  });
}

function renderAllCharts(data, topoData) {
  // 1. Sparklines
  const sparkNinoData = data.nino34.monthly.slice(-12);
  drawSparkline('#spark-nino', sparkNinoData, 'var(--accent-red)', [-3, 3]);
  
  const sparkSoiData = data.soi_bars;
  drawSparkline('#spark-soi', sparkSoiData, 'var(--accent-cyan)', [-25, 5]);

  // 2. Time Series
  drawNino34TS(data.nino34.monthly);
  
  // 3. Hovmöller
  drawHovmoller(data.subsurface);
  
  // 4. Bar Chart
  drawSOIBars(data.soi_bars);
  
  // 5. Ensemble Plume
  drawPlume(data.plume);
  
  // 6. Maps
  drawOLRWind(topoData, data);
  drawPrecip(topoData, data);
}

function updateDomElements(data) {
  // 1. KPI cards
  if (data.nino34_weekly && data.nino34_weekly.length > 0) {
    const latest = data.nino34_weekly[data.nino34_weekly.length - 1];
    if (latest.value !== undefined) {
      transitionValue(d3.select('#kpi-nino .kpi-value'), latest.value, 2);
    }
  }

  if (data.oni_monthly && data.oni_monthly.length > 0) {
    const latest = data.oni_monthly[data.oni_monthly.length - 1];
    if (latest.value !== undefined) {
      transitionValue(d3.select('#kpi-oni .kpi-value'), latest.value, 2);
    }
  }

  if (data.soi_monthly && data.soi_monthly.length > 0) {
    const latest = data.soi_monthly[data.soi_monthly.length - 1];
    if (latest.value !== undefined) {
      transitionValue(d3.select('#kpi-soi .kpi-value'), latest.value, 1);
    }
  }

  // 2. ENSO status badge
  if (data.enso_status) {
    const badge = d3.select('.badge');
    const statusText = data.enso_status.strength === 'Super El Niño'
      ? '⚠ SUPER EL NIÑO WATCH'
      : `${data.enso_status.advisory}`;
    badge.text(statusText);
  }

  // 3. Probability bar
  if (data._probabilities) {
    if (data._probabilities.el_nino !== undefined) {
      d3.select('.prob-el').transition().duration(800)
        .style('width', data._probabilities.el_nino + '%')
        .text(`El Niño ${data._probabilities.el_nino}%`);
    }
    if (data._probabilities.neutral !== undefined) {
      d3.select('.prob-neu').transition().duration(800)
        .style('width', data._probabilities.neutral + '%');
    }
    if (data._probabilities.la_nina !== undefined) {
      d3.select('.prob-la').transition().duration(800)
        .style('width', data._probabilities.la_nina + '%');
    }
  }

  // 4. Model table peaks
  if (data._models_table) {
    const rows = d3.selectAll('.historical-table tr');
    data._models_table.forEach((m, i) => {
      // Offset by 1 because of header row
      const row = rows.filter((d, j) => j === i + 1);
      if (row.size() > 0) {
        row.selectAll('td').each(function(d, ci) {
          if (ci === 0) this.textContent = m.model;
          if (ci === 1) this.textContent = m.peak_month;
          if (ci === 2) this.textContent = `+${m.peak}`;
        });
      }
    });
  }
}

// Ensure DOM is fully loaded before initializing
document.addEventListener('DOMContentLoaded', init);
