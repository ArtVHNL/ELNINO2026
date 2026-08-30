/**
 * Generic sparkline drawing function using viewBox for responsiveness
 */
export function drawSparkline(containerId, data, colorVar, yDomain) {
  const container = d3.select(containerId);
  container.html(''); // clear previous

  // Fixed internal coordinate system
  const w = 240;
  const h = 40;
  
  // Use viewBox for automatic CSS scaling
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const defs = svg.append('defs');
  const gradId = `spark-grad-${containerId.replace('#', '')}`;
  const grad = defs.append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '0%').attr('y2', '100%');
    
  // Extract rgb values for gradient from CSS var assuming it's passed as rgba or hex
  // For simplicity, we assume colorVar corresponds to the RGB glow variables
  let rgbaColorStr;
  if (colorVar.includes('red')) rgbaColorStr = '255,107,107';
  else if (colorVar.includes('cyan')) rgbaColorStr = '78,205,196';
  else rgbaColorStr = '255,255,255'; // fallback

  grad.append('stop').attr('offset', '0%').attr('stop-color', `rgba(${rgbaColorStr},0.3)`);
  grad.append('stop').attr('offset', '100%').attr('stop-color', `rgba(${rgbaColorStr},0)`);

  const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, w]);
  const y = d3.scaleLinear().domain(yDomain).range([h - 6, 6]);

  const area = d3.area()
    .x((d, i) => x(i))
    .y0(y(0))
    .y1(d => y(d.value))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .attr('d', area(data))
    .attr('fill', `url(#${gradId})`);

  const line = d3.line()
    .x((d, i) => x(i))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .attr('d', line(data))
    .attr('fill', 'none')
    .attr('stroke', colorVar)
    .attr('stroke-width', 2);

  svg.append('circle')
    .attr('cx', x(data.length - 1))
    .attr('cy', y(data[data.length - 1].value))
    .attr('r', 3)
    .attr('fill', colorVar);
}
