import { margin as originalMargin } from './utils.js';

export function drawSOIBars(data) {
  const container = d3.select('#chart-soi-bars');
  container.html('');
  
  const margin = { ...originalMargin, bottom: 60 };
  const w = 400 - margin.left - margin.right;
  const h = 260 - margin.top - margin.bottom;
  
  const svgWrapper = container.append('svg')
    .attr('viewBox', `0 0 ${w + margin.left + margin.right} ${h + margin.top + margin.bottom}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const svg = svgWrapper.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map(d=>d.label)).range([0, w]).padding(0.15);
  const y = d3.scaleLinear().domain([-25, 5]).range([h, 0]);

  // Threshold lines
  svg.append('line').attr('x1',0).attr('y1',y(-7)).attr('x2',w).attr('y2',y(-7)).attr('stroke','rgba(78,205,196,0.2)').attr('stroke-dasharray','4,4');
  svg.append('text').attr('x', w).attr('y', y(-7)-4).attr('text-anchor','end').attr('fill','rgba(78,205,196,0.5)').attr('font-size','10px').text('El Niño threshold (-7)');
  svg.append('line').attr('x1',0).attr('y1',y(7)).attr('x2',w).attr('y2',y(7)).attr('stroke','rgba(255,140,66,0.2)').attr('stroke-dasharray','4,4');

  // Bars
  svg.selectAll('.bar')
    .data(data)
    .join('rect')
    .attr('class','bar')
    .attr('x', d=>x(d.label))
    .attr('y', d=>d.value < 0 ? y(d.value) : y(0))
    .attr('width', x.bandwidth())
    .attr('height', d=>Math.abs(y(d.value) - y(0)))
    .attr('fill', d=>d.value < 0 ? 'var(--accent-cyan)' : 'var(--accent-orange)')
    .attr('opacity', 0.8)
    .attr('rx', 2);

  // Moving average line (3-month)
  const avgData = data.map((d,i) => {
    if (i < 2) return null;
    return { date: d.date, value: (data[i-2].value + data[i-1].value + d.value) / 3 };
  }).filter(d=>d);
  
  const xLine = d3.scaleLinear().domain([0, data.length-1]).range([0 + x.bandwidth()/2, w - x.bandwidth()/2]);
  const lineGen = d3.line().x((d,i)=>xLine(i+2)).y(d=>y(d.value)).curve(d3.curveMonotoneX);
  
  svg.append('path')
    .attr('d', lineGen(avgData))
    .attr('fill','none')
    .attr('stroke','var(--accent-red)')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray','4,3');

  // Axes with rotated labels for non-overlap
  const xAxis = d3.axisBottom(x).tickFormat(d=>d.split(' ')[0]);
  const yAxis = d3.axisLeft(y).ticks(6);
  
  svg.append('g').attr('class','d3-axis').attr('transform',`translate(0,${h})`).call(xAxis)
    .selectAll('text')
    .attr('font-size','11px')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)');
    
  svg.append('g').attr('class','d3-axis').call(yAxis)
    .selectAll('text').attr('font-size','11px');

  svg.append('text').attr('x', -28).attr('y', -8).attr('fill','var(--text-secondary)').attr('font-size','12px').text('SOI');
}
