import { margin } from './utils.js';

export function drawNino34TS(data) {
  const container = d3.select('#chart-nino34-ts');
  container.html('');
  
  // Use a fixed internal coordinate system and viewBox for scaling
  const w = 800 - margin.left - margin.right;
  const h = 300 - margin.top - margin.bottom;
  
  const svgWrapper = container.append('svg')
    .attr('viewBox', `0 0 ${w + margin.left + margin.right} ${h + margin.top + margin.bottom}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const svg = svgWrapper.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, w]);
  const y = d3.scaleLinear().domain([-3, 3]).range([h, 0]);

  // Background zones
  svg.append('rect').attr('x',0).attr('y', y(0.5)).attr('width',w).attr('height', y(-0.5)-y(0.5)).attr('fill','rgba(255,107,107,0.06)').attr('rx',2);
  svg.append('rect').attr('x',0).attr('y', y(-0.5)).attr('width',w).attr('height', y(0.5)-y(-0.5)).attr('fill','rgba(255,255,255,0.02)').attr('rx',2);
  svg.append('rect').attr('x',0).attr('y', y(0.5)).attr('width',w).attr('height', h - y(0.5)).attr('fill','rgba(255,107,107,0.03)');
  svg.append('rect').attr('x',0).attr('y', 0).attr('width',w).attr('height', y(-0.5)).attr('fill','rgba(78,205,196,0.03)');

  // Zero line
  svg.append('line').attr('x1',0).attr('y1',y(0)).attr('x2',w).attr('y2',y(0)).attr('stroke','var(--border-card)').attr('stroke-dasharray','4,4');

  // Threshold lines
  [0.5, -0.5, 1.5, 2.0, 2.5].forEach(t => {
    svg.append('line').attr('x1',0).attr('y1',y(t)).attr('x2',w).attr('y2',y(t)).attr('stroke','rgba(255,255,255,0.08)').attr('stroke-dasharray','2,4');
  });

  // Area fill
  const area = d3.area().x(d=>x(d.date)).y0(y(0)).y1(d=>y(d.value)).curve(d3.curveMonotoneX);
  svg.append('path').attr('d', area(data)).attr('fill','rgba(255,107,107,0.12)');

  // Line
  const line = d3.line().x(d=>x(d.date)).y(d=>y(d.value)).curve(d3.curveMonotoneX);
  svg.append('path').attr('d', line(data)).attr('fill','none').attr('stroke','var(--accent-red)').attr('stroke-width',2);

  // Current point (pulsing)
  const cur = data[data.length - 1];
  svg.append('circle').attr('cx', x(cur.date)).attr('cy', y(cur.value)).attr('r',6)
    .attr('fill','var(--accent-red)').attr('stroke','var(--bg-card)').attr('stroke-width',2)
    .style('animation', 'pulse-badge 2s ease-in-out infinite');

  // ENSO event labels
  const events = [
    { label: '2023-24 El Niño', start: new Date(2023,4,1), end: new Date(2024,5,1), color: 'var(--accent-red)' },
    { label: '2025-26 Super El Niño', start: new Date(2025,0,1), end: new Date(2026,5,1), color: 'var(--accent-orange)' }
  ];
  events.forEach(ev => {
    const x1 = x(ev.start), x2 = x(ev.end);
    const midX = (x1 + x2) / 2;
    svg.append('rect')
      .attr('x', x1).attr('y', h + 24)
      .attr('width', x2 - x1).attr('height', 20)
      .attr('fill', ev.color === 'var(--accent-red)' ? 'rgba(255,107,107,0.1)' : 'rgba(255,140,66,0.1)')
      .attr('rx', 3);
    svg.append('text')
      .attr('x', midX).attr('y', h + 36)
      .attr('text-anchor','middle')
      .attr('fill', ev.color)
      .attr('font-size','10px')
      .attr('font-weight','700')
      .text(ev.label);
  });

  // "Now" label
  svg.append('line').attr('x1', x(cur.date)).attr('y1', y(cur.value)+12).attr('x2', x(cur.date)).attr('y2', h+4)
    .attr('stroke','var(--text-secondary)').attr('stroke-width',1).attr('stroke-dasharray','3,3');
  svg.append('text').attr('x', x(cur.date)).attr('y', h+18).attr('text-anchor','middle').attr('fill','var(--text-secondary)').attr('font-size','12px').text('Now');

  // Axes
  const xAxis = d3.axisBottom(x).ticks(8).tickFormat(d3.timeFormat('%Y'));
  const yAxis = d3.axisLeft(y).ticks(7);
  svg.append('g').attr('class','d3-axis').attr('transform',`translate(0,${h})`).call(xAxis)
     .selectAll('text').attr('font-size', '12px');
  svg.append('g').attr('class','d3-axis').call(yAxis)
     .selectAll('text').attr('font-size', '12px');

  // Y label
  svg.append('text').attr('x', -32).attr('y', -8).attr('fill','var(--text-secondary)').attr('font-size','12px').attr('text-anchor','start').text('°C anomaly');

  // Overlay for tooltip with crosshair
  const tooltip = d3.select('#tooltip');
  const bisect = d3.bisector(d=>d.date).left;
  
  const crosshair = svg.append('line')
    .attr('class', 'crosshair')
    .attr('y1', 0).attr('y2', h)
    .style('display', 'none');
    
  svg.append('rect').attr('width',w).attr('height',h).attr('fill','none').attr('pointer-events','all')
    .on('mousemove', function(ev) {
      const mx = d3.pointer(ev)[0];
      const date = x.invert(mx);
      const i = Math.min(bisect(data, date), data.length-1);
      const d = data[i];
      crosshair.attr('x1', x(d.date)).attr('x2', x(d.date)).style('display', null);
      tooltip.style('opacity', 1)
        .style('left', (ev.pageX + 12) + 'px').style('top', (ev.pageY - 40) + 'px')
        .html(`<strong>${d.label}</strong><br>Niño 3.4: <span style="color:var(--accent-red)">${d.value.toFixed(2)}°C</span>`);
    })
    .on('mouseleave', function() {
      tooltip.style('opacity', 0);
      crosshair.style('display', 'none');
    });
}
