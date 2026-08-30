import { hovMargin } from './utils.js';

export function drawHovmoller(data) {
  const container = d3.select('#chart-hovmoller');
  container.html('');
  
  const w = 400 - hovMargin.left - hovMargin.right;
  const h = 300 - hovMargin.top - hovMargin.bottom;
  
  const svgWrapper = container.append('svg')
    .attr('viewBox', `0 0 ${w + hovMargin.left + hovMargin.right} ${h + hovMargin.top + hovMargin.bottom}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const svg = svgWrapper.append('g')
    .attr('transform', `translate(${hovMargin.left},${hovMargin.top})`);

  const { lons, depths, values } = data;
  const x = d3.scaleLinear().domain([120, 280]).range([0, w]);
  const y = d3.scaleLinear().domain([300, 0]).range([0, h]);

  const allVals = values.flat();
  const maxAbs = d3.max(allVals, d=>Math.abs(d)) || 3;
  const color = d3.scaleDiverging(d3.interpolateRdBu).domain([-maxAbs, 0, maxAbs]);

  const cellW = w / (lons.length - 1);
  const cellH = h / (depths.length - 1);

  // Heatmap — no gaps, crisp edges
  const heatGroup = svg.append('g').attr('shape-rendering', 'crispEdges');
  for (let i = 0; i < depths.length - 1; i++) {
    for (let j = 0; j < lons.length - 1; j++) {
      const v = (values[i][j] + values[i][j+1] + values[i+1][j] + values[i+1][j+1]) / 4;
      heatGroup.append('rect')
        .attr('x', x(lons[j])).attr('y', y(depths[i+1]))
        .attr('width', cellW + 1).attr('height', cellH + 1)
        .attr('fill', color(v));
    }
  }

  // Thermocline depth overlay (20°C isotherm proxy)
  const thermoDepth = lons.map(lon => {
    const ln = (lon - 200) / 80;
    return 80 + 60 * (ln + 0.5) + 20 * Math.sin(ln * 1.5);
  });
  const thermoLine = d3.line()
    .x((d, i) => x(lons[i]))
    .y(d => y(Math.min(Math.max(d, 5), 295)))
    .curve(d3.curveMonotoneX);
  svg.append('path')
    .datum(thermoDepth)
    .attr('d', thermoLine)
    .attr('fill', 'none')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '6,3')
    .attr('opacity', 0.5);
    
  // Thermocline label with drop-shadow
  svg.append('text')
    .attr('x', x(lons[lons.length-1]) - 5)
    .attr('y', y(thermoDepth[thermoDepth.length-1]) - 4)
    .attr('text-anchor', 'end')
    .attr('fill', '#ffffff')
    .attr('font-size', '10px')
    .attr('font-weight', '600')
    .attr('letter-spacing', '0.05em')
    .text('thermocline')
    .style('text-shadow', '0 1px 4px rgba(0,0,0,0.8)');

  svg.append('text').attr('x', 4).attr('y', -8).attr('fill','var(--text-secondary)').attr('font-size','12px').text('°C');

  // Axes
  const xAxis = d3.axisBottom(x).tickValues([120,140,160,180,200,220,240,260,280]).tickFormat(d=>{
    if (d === 180) return '180°';
    if (d > 180) return (360 - d) + '°W';
    return d + '°E';
  });
  const yAxis = d3.axisLeft(y).ticks(6);
  svg.append('g').attr('class','d3-axis').attr('transform',`translate(0,${h})`).call(xAxis)
    .selectAll('text').attr('font-size', '11px');
  svg.append('g').attr('class','d3-axis').call(yAxis)
    .selectAll('text').attr('font-size', '11px');
  svg.append('text').attr('x', -24).attr('y', -8).attr('fill','var(--text-secondary)').attr('font-size','12px').text('Depth (m)');

  // Color bar
  const cbH = 10, cbW = 100;
  const cbX = w - cbW - 10, cbY = -16;
  const defs = svg.append('defs');
  const gradId = 'hov-grad';
  const grad = defs.append('linearGradient').attr('id', gradId).attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','0%');
  
  for (let p = 0; p <= 10; p++) {
    const t = p / 10;
    // RdBu-like: blue(-3) → white(0) → red(+3)
    let r, g, b;
    if (t < 0.5) { r = 0; g = 0 + t*2*150; b = 100 + t*2*155; }
    else { r = (t-0.5)*2*255; g = (t-0.5)*2*100; b = 50 - (t-0.5)*2*50; }
    r = Math.min(Math.max(r, 0), 200);
    g = Math.min(Math.max(g, 0), 200);
    b = Math.min(Math.max(b, 0), 200);
    grad.append('stop').attr('offset', `${t*100}%`).attr('stop-color', `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
  }
  
  svg.append('rect').attr('x', cbX).attr('y', cbY).attr('width', cbW).attr('height', cbH).attr('fill',`url(#${gradId})`).attr('rx',3);
  svg.append('text').attr('x', cbX).attr('y', cbY-4).attr('fill','var(--text-secondary)').attr('font-size','10px').text(`${(-maxAbs).toFixed(1)}°C`);
  svg.append('text').attr('x', cbX+cbW).attr('y', cbY-4).attr('fill','var(--text-secondary)').attr('font-size','10px').attr('text-anchor','end').text(`${maxAbs.toFixed(1)}°C`);

  // Title annotation
  svg.append('text').attr('x', w/2).attr('y', h+40).attr('text-anchor','middle').attr('fill','var(--text-secondary)').attr('font-size','12px').text('Longitude →');
}
