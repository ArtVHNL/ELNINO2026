import { margin, colors } from './utils.js';

export function drawPlume(data) {
  const container = d3.select('#chart-plume');
  container.html('');
  
  const w = 400 - margin.left - margin.right;
  const h = 320 - margin.top - margin.bottom;
  
  const svgWrapper = container.append('svg')
    .attr('viewBox', `0 0 ${w + margin.left + margin.right} ${h + margin.top + margin.bottom}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const svg = svgWrapper.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const { dates, models, consensus, p10, p90, current_idx } = data;

  if (!dates || dates.length < 5) {
    svg.append('text').attr('x', w/2).attr('y', h/2).attr('text-anchor','middle').attr('fill','var(--text-secondary)').text('Insufficient model data');
    return;
  }

  const x = d3.scaleTime().domain(d3.extent(dates)).range([0, w]);
  const y = d3.scaleLinear().domain([0, 3.5]).range([h, 0]);

  // Uncertainty band (10-90 percentile)
  const bandData = dates.map((d, i) => ({ date: d, p10: p10[i], p90: p90[i] }));
  const bandArea = d3.area()
    .x(d=>x(d.date)).y0(d=>y(d.p10)).y1(d=>y(d.p90))
    .curve(d3.curveMonotoneX);
  svg.append('path').attr('d', bandArea(bandData)).attr('fill', 'rgba(255,107,107,0.08)');

  const lineGroup = svg.append('g').attr('class', 'models-group');

  // Individual model lines
  models.forEach((m, mi) => {
    const lineData = dates.map((d, i) => ({ date: d, value: m.values[i] }));
    const line = d3.line().x(d=>x(d.date)).y(d=>y(d.value)).curve(d3.curveMonotoneX);
    lineGroup.append('path')
      .attr('d', line(lineData))
      .attr('class', 'd3-line-path model-line')
      .attr('data-model-idx', mi)
      .attr('fill','none')
      .attr('stroke', colors[mi % colors.length])
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.5)
      .style('transition', 'opacity 0.2s, stroke-width 0.2s');
  });

  // Consensus line
  const consData = dates.map((d, i) => ({ date: d, value: consensus[i] }));
  const consLine = d3.line().x(d=>x(d.date)).y(d=>y(d.value)).curve(d3.curveMonotoneX);
  
  svg.append('path')
    .attr('d', consLine(consData))
    .attr('class', 'd3-line-path consensus-line')
    .attr('fill','none').attr('stroke','#fff').attr('stroke-width', 3);
  
  svg.append('path')
    .attr('d', consLine(consData))
    .attr('class', 'd3-line-path consensus-line-color')
    .attr('fill','none').attr('stroke','var(--accent-red)').attr('stroke-width', 2);

  // Threshold lines
  [0.5, 1.0, 1.5, 2.0, 2.5].forEach(t => {
    svg.append('line').attr('x1',0).attr('y1',y(t)).attr('x2',w).attr('y2',y(t)).attr('stroke','rgba(255,255,255,0.06)').attr('stroke-dasharray','2,4');
  });

  // Current time line
  const nowDate = dates[current_idx] || dates[dates.length-1];
  svg.append('line').attr('x1', x(nowDate)).attr('y1', 0).attr('x2', x(nowDate)).attr('y2', h)
    .attr('stroke','var(--text-secondary)').attr('stroke-width',1).attr('stroke-dasharray','4,4');
  svg.append('text').attr('x', x(nowDate)).attr('y', -6).attr('text-anchor','middle').attr('fill','var(--text-secondary)').attr('font-size','11px').text('Now');

  // Plume legend (moved to top left to avoid X-axis overlap)
  const legend = svg.append('g').attr('transform', `translate(20, 20)`);
  models.slice(0, 4).forEach((m, i) => {
    const lg = legend.append('g').attr('transform', `translate(0, ${i * 16})`);
    lg.append('line').attr('x1',0).attr('y1',0).attr('x2',16).attr('y2',0).attr('stroke', colors[i]).attr('stroke-width', 2);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', '#8A8F99').attr('font-size', '10px').text(m.name);
  });
  
  // Peak annotation
  const peakVal = d3.max(consensus);
  const peakIdx = consensus.indexOf(peakVal);
  const peakDate = dates[peakIdx];
  
  svg.append('circle').attr('cx', x(peakDate)).attr('cy', y(peakVal)).attr('r', 4).attr('fill', 'var(--accent-red)');
  svg.append('text')
    .attr('x', x(peakDate))
    .attr('y', y(peakVal) - 15)
    .attr('fill', 'var(--accent-red)')
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .attr('text-anchor', 'middle')
    .style('text-shadow', '0px 0px 4px #080C16, 0px 0px 4px #080C16')
    .text(`Peak ~${peakVal.toFixed(1)}°C`);
  svg.append('circle').attr('cx', x(peakDate)).attr('cy', y(peakVal)).attr('r', 4).attr('fill','var(--accent-red)');

  // Axes
  const xAxis = d3.axisBottom(x).ticks(8).tickFormat(d3.timeFormat('%b %y'));
  const yAxis = d3.axisLeft(y).ticks(7);
  svg.append('g').attr('class','d3-axis').attr('transform',`translate(0,${h})`).call(xAxis)
    .selectAll('text').attr('font-size', '11px');
  svg.append('g').attr('class','d3-axis').call(yAxis)
    .selectAll('text').attr('font-size', '11px');


  // Plume crosshair tooltip
  const tooltip = d3.select('#tooltip');
  const bisect = d3.bisector(d => d).left;
  
  const plumeCrosshair = svg.append('line')
    .attr('class', 'crosshair')
    .attr('y1', 0).attr('y2', h)
    .style('display', 'none');
    
  // Model line hover logic (desktop)
  lineGroup.selectAll('.model-line')
    .on('mouseenter', function() {
      lineGroup.selectAll('.model-line').attr('opacity', 0.1).attr('stroke-width', 1);
      d3.select(this).attr('opacity', 1).attr('stroke-width', 3);
    })
    .on('mouseleave', function() {
      lineGroup.selectAll('.model-line').attr('opacity', 0.5).attr('stroke-width', 1.5);
    });

  svg.append('rect').attr('width',w).attr('height',h).attr('fill','none').attr('pointer-events','all')
    .on('mousemove', function(ev) {
      const mx = d3.pointer(ev)[0];
      const date = x.invert(mx);
      const i = Math.min(bisect(dates, date), dates.length-1);
      if (i < 0 || i >= dates.length) return;
      plumeCrosshair.attr('x1', x(dates[i])).attr('x2', x(dates[i])).style('display', null);
      
      let html = `<strong>${d3.timeFormat('%b %Y')(dates[i])}</strong><br>`;
      models.forEach(m => {
        html += `<span style="color:${colors[models.indexOf(m) % colors.length]}">${m.name}: ${m.values[i].toFixed(2)}°C</span><br>`;
      });
      html += `<span style="color:var(--accent-red)">Consensus: ${consensus[i].toFixed(2)}°C</span>`;
      
      tooltip.style('opacity', 1)
        .style('left', (ev.pageX + 12) + 'px').style('top', (ev.pageY - 40) + 'px')
        .html(html);
    })
    .on('mouseleave', function() {
      tooltip.style('opacity', 0);
      plumeCrosshair.style('display', 'none');
    });
}
