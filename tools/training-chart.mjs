#!/usr/bin/env node
// Builds the training chart in the racing section of index.html from tools/training-weeks.csv.
// Add the new weeks to the CSV, then run:  node tools/training-chart.mjs
// It rewrites only what sits between the training-chart markers in index.html, and warns
// when a label would land on a bar so the layout can be checked before pushing.

import { readFileSync, writeFileSync } from 'node:fs';

const CSV = new URL('./training-weeks.csv', import.meta.url);
const PAGE = new URL('../index.html', import.meta.url);
const START = '<!-- training-chart:start -->';
const END = '<!-- training-chart:end -->';

// ---------- what the chart covers and marks; change these when the season changes ----------

const FROM = '2026-01-05'; // first week drawn; earlier rows in the CSV only feed the 4-week average
const PHASES = [ // brackets over the bars, each labelled with its weekly average
  { from: '2026-03-02', to: '2026-07-06', label: 'build', short: 'build' },
  { from: '2026-10-19', label: 'winter rebuild', short: 'rebuild' }, // no "to": runs to the latest week
];
const NOTES = [ // a word at the top of the plot with a hairline down to one week's bar
  { week: '2026-07-13', label: 'nationals' },
  { week: '2026-09-21', label: 'XCC win' },
];

// ---------- data ----------

const SERIES = [
  { key: 'ride', label: 'ride' },
  { key: 'run', label: 'run' },
  { key: 'other', label: 'other: gym, hikes, rowing' },
];
const DAY = 86400000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const fail = (msg) => { console.error(`training-chart: ${msg}`); process.exit(1); };
const warnings = [];
const warn = (msg) => warnings.push(msg);

const lines = readFileSync(CSV, 'utf8').split('\n').map((text, i) => ({ text: text.trim(), n: i + 1 }))
  .filter(l => l.text && !l.text.startsWith('#'));
const header = lines.shift();
if (header?.text !== 'week,ride_min,run_min,other_min') fail(`unexpected CSV header "${header?.text}"`);
const all = lines.map(({ text, n }) => {
  const [week, ...mins] = text.split(',');
  const d = new Date(`${week}T00:00:00Z`);
  if (Number.isNaN(+d) || d.getUTCDay() !== 1) fail(`line ${n}: ${week} is not a Monday`);
  if (mins.length !== 3 || !mins.every(m => /^\d+$/.test(m.trim()))) fail(`line ${n}: minutes must be three whole numbers`);
  const [ride, run, other] = mins.map(Number);
  return { week, date: d, ride: ride / 60, run: run / 60, other: other / 60 };
});
all.forEach((w, i) => {
  if (i && w.date - all[i - 1].date !== 7 * DAY) fail(`week ${w.week} does not follow ${all[i - 1].week}: one row per week, no gaps`);
  w.total = w.ride + w.run + w.other;
  w.avg = i >= 3 ? (all[i].total + all[i - 1].total + all[i - 2].total + all[i - 3].total) / 4 : null;
});
const weeks = all.filter(w => w.week >= FROM);
if (!weeks.length) fail(`no weeks from ${FROM}`);
const N = weeks.length;
const last = weeks[N - 1];
const lastSunday = new Date(+last.date + 6 * DAY);

// ---------- formatting ----------

const h1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const n1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '');
const c = (x) => (Math.round(x * 10) / 10).toString(); // svg coordinates
const day = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const dayShort = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mean = (ws) => ws.reduce((s, w) => s + w.total, 0) / ws.length;

const phases = PHASES.map(p => {
  const ws = weeks.filter(w => w.week >= p.from && (!p.to || w.week <= p.to));
  if (!ws.length) { warn(`phase "${p.label}" has no weeks in the chart; left out`); return null; }
  return { ...p, ws, i0: weeks.indexOf(ws[0]), i1: weeks.indexOf(ws[ws.length - 1]), avg: mean(ws) };
}).filter(Boolean);
const notes = NOTES.map(n => {
  const i = weeks.findIndex(w => w.week === n.week);
  if (i < 0) { warn(`note "${n.label}" is outside the chart; left out`); return null; }
  return { ...n, i };
}).filter(Boolean);

const total = weeks.reduce((s, w) => s + w.total, 0);
const years = new Set(weeks.map(w => w.date.getUTCFullYear()).concat(lastSunday.getUTCFullYear()));
const title = years.size === 1 ? `Training hours per week, ${[...years][0]}` : `Training hours per week, ${MONTHS[weeks[0].date.getUTCMonth()]} ${weeks[0].date.getUTCFullYear()} to ${MONTHS[lastSunday.getUTCMonth()]} ${lastSunday.getUTCFullYear()}`;
const phaseText = phases.map(p => p.to
  ? `${n1(p.avg)} through the ${MONTHS[p.ws[0].date.getUTCMonth()]} to ${MONTHS[p.ws[p.ws.length - 1].date.getUTCMonth()]} ${p.label}`
  : `${n1(p.avg)} since the ${p.label} began on ${day(p.ws[0].date)}`);
const summary = `${Math.round(total)} hours from ${day(weeks[0].date)} to ${day(lastSunday)}: ${n1(total / N)} a week on average`
  + (phaseText.length ? `, ${phaseText.join(', ').replace(/, ([^,]*)$/, ' and $1')}` : '') + '.';
const peak = weeks.reduce((a, b) => (b.total > a.total ? b : a));
const low = weeks.reduce((a, b) => (b.total < a.total ? b : a));
const desc = `Stacked weekly bars of riding, running and other training from ${day(weeks[0].date)} to ${day(lastSunday)}, with a line for the 4-week average. `
  + `${summary.replace(/\.$/, '')}. The biggest week was ${h1(peak.total)} hours, from ${day(peak.date)}, and the smallest ${h1(low.total)}, from ${day(low.date)}. `
  + `The latest week, from ${day(last.date)}, was ${h1(last.total)} hours.`;
const weekTitle = (w) => `Week of ${dayShort(w.date)}: ${h1(w.total)} h (ride ${h1(w.ride)}, run ${h1(w.run)}, other ${h1(w.other)})`
  + (w.avg == null ? '' : `, 4-week average ${h1(w.avg)}`);

// ---------- the plot, drawn once wide and once for phones ----------

const CHAR = 6.62;     // Hack's advance width at 11px
const GAP = 2;         // surface gap between stacked segments
const RADIUS = 3;      // rounded data-end
const STEP = 5;        // hours between gridlines
const yMax = Math.max(STEP, Math.ceil(Math.max(...weeks.map(w => Math.max(w.total, w.avg ?? 0))) / STEP) * STEP);

const VARIANTS = [
  { id: 'wide', W: 600, H: 262, m: { t: 40, r: 6, b: 22, l: 26 }, barMax: 10 },
  { id: 'compact', W: 360, H: 262, m: { t: 40, r: 4, b: 22, l: 24 }, barMax: 6, short: true },
];

function plot(v) {
  const { W, H, m } = v;
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const slot = pw / N;
  const bw = Math.min(v.barMax, Math.round(slot * 0.66 * 2) / 2);
  const off = (slot - bw) / 2;
  const k = ph / yMax;
  const y0 = m.t + ph;
  const y = (hrs) => y0 - hrs * k;
  const sx = (i) => m.l + i * slot;
  const cx = (i) => sx(i) + slot / 2;
  const tops = [];
  const out = [];
  const sfx = v.id === 'wide' ? '' : `-${v.id}`;

  out.push(`<svg class="viz-plot viz-${v.id}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="training-title${sfx} training-desc${sfx}">`);
  out.push(`  <title id="training-title${sfx}">${esc(title)}</title>`);
  out.push(`  <desc id="training-desc${sfx}">${esc(desc)}</desc>`);

  for (let t = 0; t <= yMax; t += STEP) {
    out.push(`  <line class="viz-grid" x1="${m.l}" x2="${W - m.r}" y1="${c(y(t))}" y2="${c(y(t))}"/>`);
    out.push(`  <text class="viz-tick" x="${m.l - 6}" y="${c(y(t) + 3.5)}" text-anchor="end">${t}</text>`);
  }
  // a month is named under its first week, when the name fits before the next one (a month
  // just begun at the right edge waits for a second week or so)
  const months = [];
  weeks.forEach((w, i) => {
    if (!i || w.date.getUTCMonth() !== weeks[i - 1].date.getUTCMonth()) months.push({ x: sx(i) + off, name: MONTHS[w.date.getUTCMonth()].slice(0, 3) });
  });
  months.forEach((mo, j) => {
    const limit = j + 1 < months.length ? months[j + 1].x - 4 : W - m.r;
    if (mo.x + mo.name.length * CHAR <= limit) out.push(`  <text class="viz-tick" x="${c(mo.x)}" y="${H - 6}">${mo.name}</text>`);
  });

  weeks.forEach((w, i) => {
    const x = sx(i) + off;
    out.push(`  <g class="viz-week" data-week="${w.week}" data-ride="${h1(w.ride)}" data-run="${h1(w.run)}" data-other="${h1(w.other)}" data-total="${h1(w.total)}"${w.avg == null ? '' : ` data-avg="${h1(w.avg)}"`}><title>${esc(weekTitle(w))}</title>`);
    out.push(`    <rect class="viz-hit" x="${c(sx(i))}" y="${m.t}" width="${c(slot)}" height="${ph}"/>`);
    // stack bottom-up; the gap comes out of the upper segment so the bar's height stays the week's total
    const segs = [];
    let base = y0;
    for (const s of SERIES) {
      const hgt = w[s.key] * k - (segs.length ? GAP : 0);
      if (hgt < 1) continue; // too thin to see: the tooltip and the table still carry it
      const top = base - (segs.length ? GAP : 0) - hgt;
      segs.push({ s, top, hgt });
      base = top;
    }
    segs.forEach((g, j) => {
      if (j === segs.length - 1) {
        const r = Math.min(RADIUS, g.hgt, bw / 2);
        const yb = g.top + g.hgt;
        out.push(`    <path class="viz-${g.s.key}" d="M${c(x)},${c(yb)}V${c(g.top + r)}Q${c(x)},${c(g.top)} ${c(x + r)},${c(g.top)}H${c(x + bw - r)}Q${c(x + bw)},${c(g.top)} ${c(x + bw)},${c(g.top + r)}V${c(yb)}Z"/>`);
      } else {
        out.push(`    <rect class="viz-${g.s.key}" x="${c(x)}" y="${c(g.top)}" width="${bw}" height="${c(g.hgt)}"/>`);
      }
    });
    out.push('  </g>');
    tops[i] = segs.length ? segs[segs.length - 1].top : y0;
  });

  // 4-week average, with a surface-coloured halo so it reads across the bars
  const pts = weeks.map((w, i) => (w.avg == null ? null : `${c(cx(i))},${c(y(w.avg))}`)).filter(Boolean);
  if (pts.length > 1) {
    const d = `M${pts.join('L')}`;
    out.push(`  <path class="viz-avg-halo" d="${d}"/>`);
    out.push(`  <path class="viz-avg" d="${d}"/>`);
  }
  const lineY = (i) => (weeks[i].avg == null ? Infinity : y(weeks[i].avg));

  // anything drawn in the plot keeps clear of bars and the line: check a box against both
  const clear = (x1, x2, yTop, yBottom) => {
    for (let i = 0; i < N; i++) {
      if (sx(i) + slot <= x1 || sx(i) >= x2) continue;
      if (tops[i] < yBottom || lineY(i) - 2 < yBottom) return false;
    }
    return yTop >= 0;
  };

  // phases: a bracket above the plot, labelled with the phase's weekly average
  const by = m.t - 12;
  for (const p of phases) {
    const x1 = sx(p.i0) + off, x2 = sx(p.i1) + off + bw;
    const text = `${v.short ? p.short : p.label} ${n1(p.avg)} h${v.short ? '/wk' : ' a week'}`;
    const tw = text.length * CHAR;
    const right = x1 + tw > W - m.r; // an open phase at the right edge takes its label leftwards
    out.push(`  <path class="viz-bracket" d="M${c(x1)},${by + 5}V${by}H${c(x2)}V${by + 5}"/>`);
    out.push(`  <text class="viz-note" x="${c(right ? x2 : x1)}" y="${by - 5}"${right ? ' text-anchor="end"' : ''}>${esc(text)}</text>`);
    p[`box${v.id}`] = right ? [x2 - tw, x2] : [x1, x1 + tw];
  }
  for (let a = 0; a < phases.length; a++) for (let b = a + 1; b < phases.length; b++) {
    const [p, q] = [phases[a][`box${v.id}`], phases[b][`box${v.id}`]];
    if (p[0] < q[1] + 8 && q[0] < p[1] + 8) warn(`${v.id}: the "${phases[a].label}" and "${phases[b].label}" bracket labels overlap`);
  }

  // notes: the word sits just under the top gridline, beside a hairline that drops to the bar;
  // it takes the first spot, right or left and then a row lower, that touches nothing else
  const placed = [];
  for (const n of notes) {
    const x = cx(n.i), tw = n.label.length * CHAR;
    const spots = [0, 1].flatMap(row => [false, true].map(left => {
      const [x1, x2] = left ? [x - 4 - tw, x - 4] : [x + 4, x + 4 + tw];
      return { row, left, x1, x2, ly: m.t + 11 + row * 13 };
    }));
    const free = (s) => s.x1 >= m.l && s.x2 <= W - m.r && clear(s.x1, s.x2, s.ly - 9, s.ly + 3)
      && placed.every(p => !(p.row === s.row && s.x1 < p.x2 + 6 && p.x1 < s.x2 + 6) && !(p.x > s.x1 - 3 && p.x < s.x2 + 3))
      && placed.every(p => !(x > p.x1 - 3 && x < p.x2 + 3)); // this hairline must not cross a word already placed
    const s = spots.find(free) || spots[0];
    if (!free(s)) warn(`${v.id}: the "${n.label}" note touches a bar, the line or another note`);
    placed.push({ ...s, x });
    out.push(`  <line class="viz-axis" x1="${c(x)}" x2="${c(x)}" y1="${m.t + 2}" y2="${c(tops[n.i] - 3)}"/>`);
    out.push(`  <text class="viz-note" x="${c(s.left ? s.x2 : s.x1)}" y="${s.ly}"${s.left ? ' text-anchor="end"' : ''}>${esc(n.label)}</text>`);
  }

  out.push(`  <line class="viz-axis" x1="${m.l}" x2="${W - m.r}" y1="${c(y0)}" y2="${c(y0)}"/>`);
  out.push('</svg>');
  return out.join('\n');
}

// ---------- the figure ----------

const legend = [
  ...SERIES.map(s => `    <li><span class="swatch viz-${s.key}"></span>${esc(s.label)}</li>`),
  '    <li><span class="swatch-line"></span>4-week average</li>',
];
const rows = weeks.map(w => `    <tr><td>${dayShort(w.date)}</td><td>${h1(w.ride)}</td><td>${h1(w.run)}</td><td>${h1(w.other)}</td><td>${h1(w.total)}</td><td>${w.avg == null ? '' : h1(w.avg)}</td></tr>`);
const updated = lastSunday.toISOString().slice(0, 10);
const figure = [
  START,
  '<!-- made by tools/training-chart.mjs from tools/training-weeks.csv: change those, not this -->',
  '<figure class="viz" aria-labelledby="training-cap">',
  '  <figcaption id="training-cap">',
  `    <strong>${esc(title)}</strong>`,
  `    <span class="note">${Math.round(total)} hours from ${day(weeks[0].date)} to <time datetime="${updated}">${day(lastSunday)}</time>, ${n1(total / N)} a week on average. Moving time from my Strava.</span>`,
  '  </figcaption>',
  '  <ul class="viz-legend">',
  ...legend,
  '  </ul>',
  ...VARIANTS.map(plot).map(s => s.replace(/^/gm, '  ')),
  '  <details>',
  '    <summary>Show the numbers</summary>',
  '    <table>',
  '    <thead><tr><th scope="col">week of</th><th scope="col">ride</th><th scope="col">run</th><th scope="col">other</th><th scope="col">total h</th><th scope="col">4-week avg</th></tr></thead>',
  '    <tbody>',
  ...rows,
  '    </tbody>',
  '    </table>',
  '  </details>',
  '</figure>',
  END,
].join('\n');

// ---------- write it into the page ----------

const html = readFileSync(PAGE, 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) fail(`index.html needs the ${START} and ${END} markers around the chart`);
const indent = html.slice(html.lastIndexOf('\n', a) + 1, a);
const next = html.slice(0, a) + figure.replace(/\n/g, `\n${indent}`) + html.slice(b + END.length);
if (next !== html) writeFileSync(PAGE, next);
console.log(`${N} weeks: ${summary}`);
console.log(next === html ? 'index.html already up to date' : 'index.html updated');
for (const w of warnings) console.warn(`warning: ${w}`);
