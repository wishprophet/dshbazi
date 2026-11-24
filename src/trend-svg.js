// Also embedded in standalone HTML. Inputs are the numeric public timeline projection.
export function trendMarkup(years, scores, selected, width, height, interactive = false) {
  const left = 38, right = width - 22, top = 25, bottom = height - 42;
  const values = scores.filter(Number.isFinite);
  if (!values.length) return '<text x="38" y="40">该分项暂无年度数据</text>';
  let low = Math.max(0, Math.floor((Math.min(...values) - 5) / 5) * 5);
  let high = Math.min(100, Math.ceil((Math.max(...values) + 5) / 5) * 5);
  if (high - low < 20) {
    low = Math.max(0, Math.floor(((low + high) / 2 - 10) / 5) * 5);
    high = Math.min(100, low + 20);
    low = Math.max(0, high - 20);
  }
  const first = years[0].year, last = years.at(-1).year;
  const x = year => first === last ? (left + right) / 2 : left + (year - first) / (last - first) * (right - left);
  const y = value => top + (high - value) / (high - low) * (bottom - top);
  const label = (cx, cy, text, anchor) =>
    `<text x="${cx}" y="${cy}" text-anchor="${anchor}" fill="#6c7a85" font-size="${interactive ? 10 : 14}">${text}</text>`;
  const parts = [label(left, 15, '年度分', 'start')];
  for (let i = 0; i <= 4; i++) {
    const score = low + (high - low) * i / 4;
    parts.push(`<line x1="${left}" x2="${right}" y1="${y(score)}" y2="${y(score)}" stroke="#e1e7e9"/>`, label(left - 8, y(score) + 4, score, 'end'));
  }
  const currentX = x(years[selected].year);
  parts.push(`<line x1="${currentX}" x2="${currentX}" y1="${top}" y2="${bottom}" stroke="#accbc3" stroke-dasharray="4 5"/>`);
  let path = '', previousYear;
  for (const [index, row] of years.entries()) {
    if (!Number.isFinite(scores[index])) { previousYear = undefined; continue; }
    path += `${row.year === previousYear + 1 ? 'L' : 'M'} ${x(row.year)} ${y(scores[index])} `;
    previousYear = row.year;
  }
  parts.push(`<path class="trend-line" d="${path.trim()}" fill="none" stroke="#246b60" stroke-width="2"/>`);
  const stride = Math.max(1, Math.ceil(years.length / Math.max(2, Math.floor((right - left) / 90))));
  const halfHit = first === last ? 25 : Math.max(4, Math.min(18, (right - left) / (last - first) / 2));
  for (const [index, row] of years.entries()) {
    const year = row.year, score = scores[index], cx = x(year), active = index === selected;
    if (Number.isFinite(score)) {
      const controls = interactive ? ` role="button" tabindex="${active ? 0 : -1}" aria-pressed="${active}" aria-label="查看 ${year} 年，年度分 ${score}" style="cursor:pointer"` : '';
      const target = interactive ? `<rect x="${cx - halfHit}" y="${top}" width="${halfHit * 2}" height="${bottom - top}" fill="transparent"/>` : '';
      parts.push(`<g data-index="${index}" data-year="${year}" data-score="${score}"${controls}>${target}<circle class="trend-point" cx="${cx}" cy="${y(score)}" r="${active ? 5.5 : 3.5}" fill="${active ? '#246b60' : '#fff'}" stroke="#246b60" stroke-width="1.8"/><title>${year} 年 · ${score}</title></g>`);
    }
    if (index === years.length - 1 || (index % stride === 0 && (index === 0 || x(last) - cx >= 44))) {
      parts.push(label(cx, height - 18, year, 'middle'));
    }
  }
  return parts.join('');
}
