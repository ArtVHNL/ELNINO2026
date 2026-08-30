export const margin = { top: 20, right: 30, bottom: 40, left: 50 };
export const hovMargin = { top: 20, right: 30, bottom: 50, left: 50 };
export const colors = ['#FF6B6B','#4ECDC4','#FFD93D','#6C5CE7','#1E90FF','#FF8C42','#A8E6CF','#FF69B4','#95E1D3','#F38181'];

export function wrapText(text, width) {
  text.each(function() {
    // We assume d3 is available globally as it's loaded via CDN in index.html
    const t = d3.select(this);
    const words = t.text().split(/\s+/);
    if (words.length < 2) return;
    let line = '', lines = [];
    for (let w of words) {
      const test = line + w + ' ';
      if (test.length > width) { lines.push(line); line = w + ' '; }
      else { line = test; }
    }
    lines.push(line);
    t.text(null);
    for (let l of lines) t.append('tspan').text(l).attr('x', 0).attr('dy', '1.2em');
  });
}

// Helper: smooth value transition on matching elements
export function transitionValue(sel, value, decimals=2) {
  sel.transition().duration(800).ease(d3.easeCubicInOut)
    .tween('text', function() {
      const node = this;
      const old = parseFloat(node.textContent) || 0;
      const interpolator = d3.interpolateNumber(old, value);
      return t => { node.textContent = interpolator(t).toFixed(decimals); };
    });
}
