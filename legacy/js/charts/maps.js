import { margin } from './utils.js';

export function drawOLRWind(topoData, data) {
  const container = d3.select('#chart-olr-wind');
  container.html('');
  
  if (!topoData) {
    container.html('<div class="loading">Map data not available</div>');
    return;
  }

  const w = 900;
  const h = 500;

  const svgWrapper = container.append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const svg = svgWrapper.append('g');

  // 3D Orthographic Projection centered on the Pacific
  const projection = d3.geoOrthographic()
    .scale(h / 2.3) // Slightly smaller so it fits better
    .translate([w / 2, h / 2 + 20]) // Shift globe down by 20px so top legend clears it
    .clipAngle(90)
    .rotate([160, 0, 0]); // Look at Pacific

  const path = d3.geoPath().projection(projection);

  // Background sphere (ocean depth color)
  svg.append('path')
    .datum({type: 'Sphere'})
    .attr('class', 'globe-sphere')
    .attr('d', path);

  // Graticule
  svg.append('path')
    .datum(d3.geoGraticule().step([30, 30]))
    .attr('class', 'globe-graticule')
    .attr('d', path);

  // Parse TopoJSON
  const countries = topojson.feature(topoData, topoData.objects.countries).features;

  const { grid_lat, grid_lon, values } = data.olr;
  const allOlr = values.flat();
  const maxOlr = d3.max(allOlr, d=>Math.abs(d)) || 30;
  const olrColor = d3.scaleDiverging(d3.interpolateRdYlBu).domain([-maxOlr, 0, maxOlr]);

  // Convert grid data into GeoJSON features
  const cellFeatures = [];
  for (let i = 0; i < grid_lat.length - 1; i++) {
    for (let j = 0; j < grid_lon.length - 1; j++) {
      const v = (values[i][j] + values[i][j+1] + values[i+1][j] + values[i+1][j+1]) / 4;
      if (Math.abs(v) < 3.0) continue; // High threshold so only significant anomalies are visible, keeping ocean blue
      const nw = [grid_lon[j], grid_lat[i]];
      const ne = [grid_lon[j+1], grid_lat[i]];
      const se = [grid_lon[j+1], grid_lat[i+1]];
      const sw = [grid_lon[j], grid_lat[i+1]];
      cellFeatures.push({
        type: 'Feature',
        properties: { value: v },
        geometry: {
          type: 'Polygon',
          coordinates: [[nw, sw, se, ne, nw]]
        }
      });
    }
  }

  // Groups for layering
  const gHeatmap = svg.append('g');
  const gCountries = svg.append('g');
  const gWind = svg.append('g');
  const gOverlays = svg.append('g');

  function renderMap() {
    // Render heatmap
    gHeatmap.selectAll('path')
      .data(cellFeatures)
      .join('path')
      .attr('d', path)
      .attr('fill', d => olrColor(d.properties.value))
      .attr('opacity', d => {
        // Dynamic opacity: values near 0 become almost transparent
        const val = Math.abs(d.properties.value);
        return Math.min(0.8, (val / (maxOlr * 0.3)) * 0.8);
      })
      .attr('stroke', 'none');

    // Render countries
    gCountries.selectAll('path')
      .data(countries)
      .join('path')
      .attr('class', 'globe-country')
      .attr('d', path);

    // Render wind vectors
    gWind.selectAll('*').remove();
    const skip = 3; // Render fewer arrows for 3D globe clarity
    for (let i = 0; i < grid_lat.length; i += skip) {
      for (let j = 0; j < grid_lon.length; j += skip) {
        // Calculate visibility on globe
        const pt = [grid_lon[j], grid_lat[i]];
        // Only draw if point is visible on the current hemisphere
        const d = d3.geoDistance(pt, projection.invert([w/2, h/2 + 20]));
        if (d > Math.PI / 2) continue;

        const px = projection(pt);
        if (!px) continue;
        
        const u = data.olr.u_wind[i][j];
        const v_wind = data.olr.v_wind[i][j];
        const mag = Math.sqrt(u*u + v_wind*v_wind);
        if (mag < 0.5) continue;

        const scale = 0.5;
        const dx = u * scale;
        const dy = -v_wind * scale;
        const angle = Math.atan2(dy, dx);
        const len = Math.sqrt(dx*dx + dy*dy);
        
        gWind.append('line')
          .attr('x1', px[0]).attr('y1', px[1])
          .attr('x2', px[0] + dx).attr('y2', px[1] + dy)
          .attr('stroke', 'rgba(255,255,255,0.6)')
          .attr('stroke-width', 1.0 + mag/8)
          .attr('stroke-linecap', 'round');
          
        const headLen = Math.min(4, len * 0.3);
        gWind.append('line')
          .attr('x1', px[0] + dx).attr('y1', px[1] + dy)
          .attr('x2', px[0] + dx - headLen * Math.cos(angle - 0.4))
          .attr('y2', px[1] + dy - headLen * Math.sin(angle - 0.4))
          .attr('stroke', 'rgba(255,255,255,0.8)')
          .attr('stroke-width', 1.0);
      }
    }

    // Equator
    gOverlays.selectAll('.equator')
      .data([{ type: 'LineString', coordinates: [[-180,0],[180,0]] }])
      .join('path')
      .attr('class', 'equator')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-dasharray', '4,4');
  }

  // Initial render
  renderMap();

  // Drag behavior for rotating the globe
  const drag = d3.drag()
    .on('drag', (event) => {
      const rotate = projection.rotate();
      // Sensitivity factor
      const k = 75 / projection.scale();
      projection.rotate([
        rotate[0] + event.dx * k,
        rotate[1] - event.dy * k
      ]);
      // Re-render everything
      svg.select('.globe-sphere').attr('d', path);
      svg.select('.globe-graticule').attr('d', path);
      renderMap();
    });

  svgWrapper.call(drag);

  // Legend & Overlays (Fixed UI elements, not dragged)
  const uiGroup = svgWrapper.append('g').attr('transform', 'translate(10, 10)');
  uiGroup.append('rect').attr('width', 140).attr('height', 50).attr('rx', 6).attr('fill', 'rgba(11,15,25,0.7)').attr('stroke', 'rgba(255,255,255,0.1)');
  uiGroup.append('text').attr('x', 10).attr('y', 16).attr('fill','#8A8F99').attr('font-size','11px').attr('font-weight','600').attr('letter-spacing','0.05em').text('OLR ANOMALY');
  
  const defs = uiGroup.append('defs');
  const grad = defs.append('linearGradient').attr('id','olr-grad').attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','0%');
  grad.append('stop').attr('offset','0%').attr('stop-color','#d73027');
  grad.append('stop').attr('offset','50%').attr('stop-color','#ffffbf');
  grad.append('stop').attr('offset','100%').attr('stop-color','#4575b4');
  
  uiGroup.append('rect').attr('x', 10).attr('y', 26).attr('width', 120).attr('height', 8).attr('fill','url(#olr-grad)').attr('rx',2);
  uiGroup.append('text').attr('x', 10).attr('y', 44).attr('fill','#8A8F99').attr('font-size','10px').text(`-${maxOlr.toFixed(0)} W/m²`);
  uiGroup.append('text').attr('x', 130).attr('y', 44).attr('fill','#8A8F99').attr('font-size','10px').attr('text-anchor','end').text(`+${maxOlr.toFixed(0)} W/m²`);
  
  // Drag instruction
  uiGroup.append('text').attr('x', w/2).attr('y', h - 30).attr('fill','rgba(255,255,255,0.4)').attr('font-size','12px').attr('text-anchor','middle').text('↔ Drag globe to rotate');
}

export function drawPrecip(topoData, data) {
  const container = d3.select('#chart-precip');
  container.html('');
  
  if (!topoData) {
    container.html('<div class="loading">Map data not available</div>');
    return;
  }

  const w = 900;
  const h = 500;

  const svgWrapper = container.append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const svg = svgWrapper.append('g');

  const projection = d3.geoOrthographic()
    .scale(h / 2.2)
    .translate([w / 2, h / 2])
    .clipAngle(90)
    .rotate([120, -10, 0]); // Look slightly more at Americas for precip

  const path = d3.geoPath().projection(projection);

  // Background
  svg.append('path').datum({type: 'Sphere'}).attr('class', 'globe-sphere').attr('d', path);
  svg.append('path').datum(d3.geoGraticule().step([30, 30])).attr('class', 'globe-graticule').attr('d', path);

  const countries = topojson.feature(topoData, topoData.objects.countries).features;
  const { grid_lat, grid_lon, values } = data.precip;
  const allP = values.flat();
  const maxP = d3.max(allP, d=>Math.abs(d)) || 3;
  const precipColor = d3.scaleDiverging(d3.interpolateBrBG).domain([-maxP, 0, maxP]);

  const cellFeatures = [];
  for (let i = 0; i < grid_lat.length - 1; i++) {
    for (let j = 0; j < grid_lon.length - 1; j++) {
      const v = (values[i][j] + values[i][j+1] + values[i+1][j] + values[i+1][j+1]) / 4;
      if (Math.abs(v) < 0.5) continue; // Keep only significant precip anomalies
      cellFeatures.push({
        type: 'Feature',
        properties: { value: v },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [grid_lon[j], grid_lat[i]],
            [grid_lon[j], grid_lat[i+1]],
            [grid_lon[j+1], grid_lat[i+1]],
            [grid_lon[j+1], grid_lat[i]],
            [grid_lon[j], grid_lat[i]]
          ]]
        }
      });
    }
  }

  const gHeatmap = svg.append('g');
  const gCountries = svg.append('g');
  
  function renderMap() {
    gHeatmap.selectAll('path')
      .data(cellFeatures)
      .join('path')
      .attr('d', path)
      .attr('fill', d => precipColor(d.properties.value))
      .attr('opacity', d => {
        const val = Math.abs(d.properties.value);
        return Math.min(0.8, (val / 1.0) * 0.8); // 1.0 is the typical max for precip
      })
      .attr('stroke', 'none');

    gCountries.selectAll('path')
      .data(countries)
      .join('path')
      .attr('class', 'globe-country')
      .attr('d', path);
  }

  renderMap();

  const drag = d3.drag()
    .on('drag', (event) => {
      const rotate = projection.rotate();
      const k = 75 / projection.scale();
      projection.rotate([
        rotate[0] + event.dx * k,
        rotate[1] - event.dy * k
      ]);
      svg.select('.globe-sphere').attr('d', path);
      svg.select('.globe-graticule').attr('d', path);
      renderMap();
    });

  svgWrapper.call(drag);

  // Legend
  const uiGroup = svgWrapper.append('g').attr('transform', 'translate(16, 16)');
  uiGroup.append('rect').attr('width', 160).attr('height', 50).attr('rx', 6).attr('fill', 'rgba(11,15,25,0.7)').attr('stroke', 'rgba(255,255,255,0.1)');
  
  const defs = uiGroup.append('defs');
  const grad = defs.append('linearGradient').attr('id','precip-grad').attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','0%');
  grad.append('stop').attr('offset','0%').attr('stop-color','#8c510a');
  grad.append('stop').attr('offset','50%').attr('stop-color','#f5f5f5');
  grad.append('stop').attr('offset','100%').attr('stop-color','#01665e');
  
  uiGroup.append('text').attr('x', 10).attr('y', 16).attr('fill','#8A8F99').attr('font-size','11px').attr('font-weight','600').attr('letter-spacing','0.05em').text('PRECIP ANOMALY (JJA)');
  uiGroup.append('rect').attr('x', 10).attr('y', 26).attr('width', 140).attr('height', 8).attr('fill','url(#precip-grad)').attr('rx',2);
  uiGroup.append('text').attr('x', 10).attr('y', 44).attr('fill','#8A8F99').attr('font-size','9px').text(`Dry ${(-maxP).toFixed(1)}`);
  uiGroup.append('text').attr('x', 150).attr('y', 44).attr('fill','#8A8F99').attr('font-size','9px').attr('text-anchor','end').text(`Wet ${maxP.toFixed(1)}`);
  
  uiGroup.append('text').attr('x', w/2 - 16).attr('y', h - 40).attr('fill','rgba(255,255,255,0.4)').attr('font-size','12px').attr('text-anchor','middle').text('↔ Drag globe to rotate');
}
