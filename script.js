const PI = Math.PI;
const LN2 = Math.LN2;
const DELAYS = [700, 350, 120, 30, 0];

let results = [], log = [], trialCount = 0, totalResets = 0, running = false, abort = false, forceReset = false;
let cH = 0, cF = 0, cCoins = [], resetEvents = [];
let liveTimer = null;
const g = id => document.getElementById(id);

/* chart colour constants, match CSS token values above */
const C = {
  estimate:  '#1D9E75',
  trialDot:  '#378ADD99',
  piLine:    '#E24B4A',
  resetLine: '#BA7517',
  grid:      '#ffffff0f',
  tick:      '#666677',
  axisTitle: '#888899',
};


/* helpers */
function getConstant() {
  return document.querySelector('input[name=const]:checked').value === 'pi' ? PI : LN2;
}
function getConstantLabel() {
  return document.querySelector('input[name=const]:checked').value === 'pi' ? 'π' : 'ln 2';
}
function getMultiplier() { return parseFloat(g('e_mul').value) || 4; }
function getSurplus()    { return Math.max(1, parseInt(g('e_sur').value) || 1); }


/* overlay plugin: true-constant dashed line + reset verticals */
const overlayPlugin = {
  id: 'overlay',
  afterDraw(chart) {
    const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
    ctx.save();
    const cY = y.getPixelForValue(getConstant());
    ctx.strokeStyle = C.piLine; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(left, cY); ctx.lineTo(right, cY); ctx.stroke();
    if (resetEvents.length) {
      ctx.strokeStyle = C.resetLine; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      for (const trialNum of resetEvents) {
        const px = x.getPixelForValue(trialNum);
        if (px >= left - 1 && px <= right + 1) { ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
};
Chart.register(overlayPlugin);

const chart = new Chart(g('e_pc'), {
  type: 'scatter',
  data: {
    datasets: [
      { label: 'estimate', data: [], showLine: true,  borderColor: C.estimate,  backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, order: 2 },
      { label: 'trial',    data: [], showLine: false, backgroundColor: C.trialDot, borderColor: 'transparent', pointRadius: 3.5, pointHoverRadius: 5, order: 1 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'nearest', intersect: true, callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(5) } }
    },
    scales: {
      x: { type: 'linear', min: 0, title: { display: true, text: 'Trial #', font: { size: 11 }, color: C.axisTitle }, ticks: { maxTicksLimit: 8, color: C.tick, font: { size: 10 } }, grid: { color: C.grid } },
      y: { min: 0, max: 5,   title: { display: true, text: 'Value',   font: { size: 11 }, color: C.axisTitle }, ticks: { color: C.tick, font: { size: 10 } }, grid: { color: C.grid } }
    }
  }
});


/* recalibrate y-axis when constant or multiplier changes */
function calibrateYAxis() {
  const c   = getConstant();
  const mul = getMultiplier();
  const pad = Math.max(0.5, c * 0.4);
  chart.options.scales.y.min = Math.max(0, c - pad * 2.5);
  chart.options.scales.y.max = c + pad * 2.5;
  chart.update('none');
}


/* update stat-card labels to reflect active mode */
function updateLabels() {
  const lbl = getConstantLabel();
  const mul = getMultiplier();
  g('lbl-estimate').textContent = lbl + ' estimate';
  g('lbl-true').textContent     = 'True ' + lbl;
  g('e_tv').textContent         = getConstant().toFixed(5);
}


/* update chart width and auto-scroll right */
function updateChartWidth() {
  const cw = g('e_cw'), cc = g('e_cc');
  const atRight = cw.scrollLeft + cw.clientWidth >= cw.scrollWidth - 50;
  cc.style.width = Math.max(cw.clientWidth || 400, 20 + trialCount * 4) + 'px';
  if (atRight) requestAnimationFrame(() => { g('e_cw').scrollLeft = g('e_cw').scrollWidth; });
}


/* running stats */
function updateStats() {
  g('e_rs').textContent = totalResets;
  renderFlipStat();
  if (!results.length) { g('e_pi').textContent = '—'; g('e_tc').textContent = '0'; g('e_er').textContent = '—'; return; }
  const mul = getMultiplier();
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const est = mul * avg;
  const trueC = getConstant();
  g('e_pi').textContent = est.toFixed(5);
  g('e_tc').textContent = results.length;
  g('e_er').textContent = Math.abs(est - trueC).toFixed(5);
}


/* formatted flip stat card */
function renderFlipStat() {
  const el = g('e_fl');
  const tails   = cF - cH;
  const surplus = cH - tails;
  const sign    = surplus >= 0 ? '+' : '';
  /* total flips: sci notation at 100k */
  const fmtTotal = n => n >= 1e5
    ? n.toExponential(2).replace('e+', 'E')
    : n.toLocaleString();
  /* sub-values (H, T, surplus): sci notation much earlier at 1k */
  const fmtSub = n => Math.abs(n) >= 1e3
    ? (n < 0 ? '-' : '') + Math.abs(n).toExponential(1).replace('e+', 'E').replace('e-', 'E-')
    : String(n);
  el.innerHTML = `${fmtTotal(cF)}<div class="flip-detail"><span>${fmtSub(cH)}H</span><span>${fmtSub(tails)}T</span><span>${sign}${fmtSub(Math.abs(surplus))}</span></div>`;
}


/* coin display */
function renderCoins() {
  const MAX = 72, seq = g('e_cs');
  if (!cCoins.length) {
    seq.innerHTML = '<span class="trial-placeholder">Press run to start</span>';
    renderFlipStat();
    return;
  }
  const vis = cCoins.slice(-MAX);
  const surplus = getSurplus();
  seq.innerHTML = (cCoins.length > MAX ? `<span style="font-size:10px;color:var(--text-muted);align-self:center">+${cCoins.length - MAX}</span>` : '') +
    vis.map((c, i, arr) => {
      const fin = i === arr.length - 1 && (cH - (cF - cH)) >= surplus;
      return `<span class="coin ${c}${fin ? ' final' : ''}">${c}</span>`;
    }).join('');
  renderFlipStat();
}


/* start/stop the live stats ticker (fires even at instant speed) */
function startLiveTimer() {
  if (liveTimer) return;
  liveTimer = setInterval(() => { renderFlipStat(); renderLiveTrialResult(); }, 80);
}
function stopLiveTimer() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}


/* show running ratio in the trial result line during a live trial */
function renderLiveTrialResult() {
  if (cF === 0) return;
  const mul = getMultiplier();
  const ratio = cH / cF;
  g('e_tr').textContent = `running: ${cH}H / ${cF} flips = ${ratio.toFixed(4)} → ×${mul} = ${(mul * ratio).toFixed(4)}`;
}


/* push a point to chart */
function pushToChart(trialNum, trialVal, runVal, isReset) {
  if (runVal    !== null) chart.data.datasets[0].data.push({ x: trialNum, y: runVal });
  if (trialVal  !== null) chart.data.datasets[1].data.push({ x: trialNum, y: trialVal });
  if (isReset) resetEvents.push(trialNum);
  chart.update('none');
  updateChartWidth();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));


/* single trial */
async function runOneTrial() {
  cH = 0; cF = 0; cCoins = []; renderCoins(); g('e_tr').textContent = '';
  startLiveTimer();
  const maxFlips = parseInt(g('e_mf').value) || 0;
  const surplus  = getSurplus();
  while ((cH - (cF - cH)) < surplus) {
    if (abort) { stopLiveTimer(); return { ratio: null, partialRatio: null, wasReset: false }; }
    if (forceReset || (maxFlips > 0 && cF >= maxFlips)) {
      forceReset = false; stopLiveTimer();
      return { ratio: null, partialRatio: cF > 0 ? cH / cF : null, wasReset: true, flips: cF };
    }
    const h = Math.random() < 0.5;
    if (h) cH++;
    cF++;
    cCoins.push(h ? 'H' : 'T');
    const delay = DELAYS[+g('e_sp').value];
    if (delay > 0) { renderCoins(); await sleep(delay); }
    else if (cF % 200 === 0) await sleep(0);
  }
  stopLiveTimer();
  renderCoins();
  const mul = getMultiplier();
  g('e_tr').textContent = `→ ${cH}H / ${cF} flips = ${(cH / cF).toFixed(4)} → ×${mul} = ${(mul * cH / cF).toFixed(4)}`;
  return { ratio: cH / cF, partialRatio: null, wasReset: false, flips: cF };
}


/* handle completed trial */
function handleResult({ ratio, partialRatio, wasReset, flips }) {
  const mul = getMultiplier();
  if (wasReset) {
    totalResets++;
    const r = partialRatio;
    if (r !== null) results.push(r);
    const runAvg = results.length ? mul * results.reduce((a, b) => a + b, 0) / results.length : null;
    const dotVal = r !== null ? mul * r : null;
    const trialNum = ++trialCount;
    log.push({ trial: trialNum, ratio: r, flips, estimate: runAvg, isReset: true });
    pushToChart(trialNum, dotVal, runAvg, true);
  } else if (ratio !== null) {
    results.push(ratio);
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const estimate = mul * avg;
    const trialNum = ++trialCount;
    log.push({ trial: trialNum, ratio, flips, estimate, isReset: false });
    pushToChart(trialNum, mul * ratio, estimate, false);
  }
  updateStats();
}


/* batch run */
g('e_rb').addEventListener('click', () => {
  if (running) { abort = true; running = false; g('e_rb').textContent = 'Run'; g('e_sb').disabled = false; }
  else runBatch();
});

async function runBatch() {
  const n = Math.min(Math.max(parseInt(g('e_ni').value) || 200, 1), 10000);
  abort = false; running = true; g('e_rb').textContent = 'Stop'; g('e_sb').disabled = true;
  for (let i = 0; i < n; i++) {
    if (abort) break;
    const res = await runOneTrial();
    if (abort) break;
    handleResult(res);
  }
  running = false; abort = false; g('e_rb').textContent = 'Run'; g('e_sb').disabled = false;
}


/* one trial */
g('e_sb').addEventListener('click', async () => {
  if (running) return;
  running = true; g('e_sb').disabled = true; g('e_rb').disabled = true;
  handleResult(await runOneTrial());
  running = false; g('e_sb').disabled = false; g('e_rb').disabled = false;
});


/* reset trial mid-run */
g('e_fb').addEventListener('click', () => { forceReset = true; });


/* reset all */
g('e_ab').addEventListener('click', () => {
  abort = true; running = false; forceReset = false;
  stopLiveTimer();
  results = []; log = []; trialCount = 0; totalResets = 0; cH = 0; cF = 0; cCoins = []; resetEvents = [];
  renderCoins(); g('e_tr').textContent = ''; updateStats();
  chart.data.datasets.forEach(d => d.data = []);
  chart.update(); g('e_cc').style.width = '100%';
  g('e_rb').textContent = 'Run'; g('e_sb').disabled = false; g('e_rb').disabled = false;
});


/* import */

/* parse raw text as array of 'H'/'T' flips, ignoring all other chars */
function parseFlips(raw) {
  const flips = [];
  for (const ch of raw.toUpperCase()) {
    if (ch === 'H' || ch === '1') flips.push('H');
    else if (ch === 'T' || ch === '0') flips.push('T');
  }
  return flips;
}

/* run the Propp algorithm over a fixed flip array, calling handleResult for each trial */
function runImport(flips, msgEl) {
  if (!flips.length) { msgEl.textContent = 'No valid flips found.'; return; }
  const surplus  = getSurplus();
  const maxFlips = parseInt(g('e_mf').value) || 0;
  let i = 0, trialsAdded = 0, resetsAdded = 0;

  while (i < flips.length) {
    let h = 0, t = 0, start = i;
    /* consume flips until surplus reached, max flips hit, or sequence exhausted */
    while (i < flips.length && (h - t) < surplus) {
      if (maxFlips > 0 && (i - start) >= maxFlips) break;  /* reset when hit max flips */
      if (flips[i] === 'H') h++; else t++;
      i++;
    }
    const flipsUsed = i - start;
    const hitMax = maxFlips > 0 && flipsUsed >= maxFlips && (h - t) < surplus;
    if ((h - t) >= surplus) {
      /* completed trial */
      handleResult({ ratio: h / (h + t), partialRatio: null, wasReset: false, flips: flipsUsed });
      trialsAdded++;
    } else {
      /* treat as reset when hit max-flips cap or sequence exhausted mid-trial */
      if (flipsUsed > 0) {
        handleResult({ ratio: null, partialRatio: h / (h + t), wasReset: true, flips: flipsUsed });
        resetsAdded++;
      }
    }
  }

  const parts = [`${trialsAdded} trial${trialsAdded !== 1 ? 's' : ''} added`];
  if (resetsAdded) parts.push(`${resetsAdded} partial reset${resetsAdded !== 1 ? 's' : ''}`);
  parts.push(`(${flips.length} flips total)`);
  msgEl.textContent = parts.join(' · ');
}

/* toggle between file and text mode */
document.querySelectorAll('input[name=imode]').forEach(r => r.addEventListener('change', () => {
  const isFile = document.querySelector('input[name=imode]:checked').value === 'file';
  g('imp_file_row').style.display = isFile ? 'flex' : 'none';
  g('imp_text_row').style.display = isFile ? 'none'  : 'flex';
}));

/* file mode */
g('imp_browse').addEventListener('click', () => g('imp_file').click());
g('imp_file').addEventListener('change', () => {
  const f = g('imp_file').files[0];
  g('imp_fname').textContent = f ? f.name : 'No file chosen';
  g('imp_run').disabled = !f;
  g('imp_msg').textContent = '';
});
g('imp_run').addEventListener('click', () => {
  const f = g('imp_file').files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = e => { runImport(parseFlips(e.target.result), g('imp_msg')); };
  reader.readAsText(f);
});

/* text mode */
g('imp_run_t').addEventListener('click', () => {
  runImport(parseFlips(g('imp_ta').value), g('imp_msg_t'));
});


/* export */

function buildRows() {
  const incPi  = g('inc_pi').checked;
  const incLn2 = g('inc_ln2').checked;
  const mul    = getMultiplier();
  const surplus = getSurplus();
  const resetSet = new Set(resetEvents);

  /* header */
  const cols = ['trial', 'ratio', 'flips', 'estimate', 'is_reset'];
  if (incPi)  cols.push('pi');
  if (incLn2) cols.push('ln2');

  const rows = log.map(r => {
    const row = {
      trial:    r.trial,
      ratio:    r.ratio !== null ? r.ratio : '',
      flips:    r.flips,
      estimate: r.estimate !== null ? r.estimate : '',
      is_reset: r.isReset ? 1 : 0,
    };
    if (incPi)  row.pi  = PI;
    if (incLn2) row.ln2 = LN2;
    return row;
  });

  return { cols, rows };
}

function dlBlob(content, mime, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCSV() {
  const { cols, rows } = buildRows();
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map(c => r[c] === '' ? '' : r[c]).join(','));
  dlBlob(lines.join('\r\n'), 'text/csv', 'propp_pi.csv');
}

function exportJSON() {
  const { cols, rows } = buildRows();
  const incPi  = g('inc_pi').checked;
  const incLn2 = g('inc_ln2').checked;
  const out = {
    meta: {
      surplus: getSurplus(), multiplier: getMultiplier(),
      constant_mode: document.querySelector('input[name=const]:checked').value,
      total_trials: log.length, total_resets: totalResets,
      ...(incPi  ? { pi:  PI  } : {}),
      ...(incLn2 ? { ln2: LN2 } : {}),
    },
    trials: rows,
  };
  dlBlob(JSON.stringify(out, null, 2), 'application/json', 'propp_pi.json');
}

function exportXML() {
  const { cols, rows } = buildRows();
  const incPi  = g('inc_pi').checked;
  const incLn2 = g('inc_ln2').checked;
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>','<propp_pi>','  <meta>',
    `    <surplus>${getSurplus()}</surplus>`,
    `    <multiplier>${getMultiplier()}</multiplier>`,
    `    <constant_mode>${document.querySelector('input[name=const]:checked').value}</constant_mode>`,
    `    <total_trials>${log.length}</total_trials>`,
    `    <total_resets>${totalResets}</total_resets>`,
    ...(incPi  ? [`    <pi>${PI}</pi>`]   : []),
    ...(incLn2 ? [`    <ln2>${LN2}</ln2>`] : []),
    '  </meta>','  <trials>'];
  for (const r of rows) {
    lines.push('    <trial>');
    for (const c of cols) lines.push(`      <${c}>${esc(r[c])}</${c}>`);
    lines.push('    </trial>');
  }
  lines.push('  </trials>','</propp_pi>');
  dlBlob(lines.join('\n'), 'application/xml', 'propp_pi.xml');
}

function exportXLSX() {
  if (typeof XLSX === 'undefined') { g('dl_msg').textContent = 'XLSX library not loaded yet, try again in a moment'; return; }
  const { cols, rows } = buildRows();
  const incPi  = g('inc_pi').checked;
  const incLn2 = g('inc_ln2').checked;

  /* trials sheet */
  const sheetData = [cols, ...rows.map(r => cols.map(c => r[c] === '' ? null : r[c]))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), 'Trials');

  /* meta sheet */
  const meta = [
    ['surplus', getSurplus()],
    ['multiplier', getMultiplier()],
    ['constant_mode', document.querySelector('input[name=const]:checked').value],
    ['total_trials', log.length],
    ['total_resets', totalResets],
  ];
  if (incPi)  meta.push(['pi',  PI]);
  if (incLn2) meta.push(['ln2', LN2]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Meta');

  XLSX.writeFile(wb, 'propp_pi.xlsx');
}

g('e_dl').addEventListener('click', () => {
  if (!log.length) { g('dl_msg').textContent = 'No data yet'; return; }
  g('dl_msg').textContent = '';
  const fmt = document.querySelector('input[name=fmt]:checked').value;
  if (fmt === 'csv')  exportCSV();
  if (fmt === 'json') exportJSON();
  if (fmt === 'xml')  exportXML();
  if (fmt === 'xlsx') exportXLSX();
});


/* preset table, constant: [surplus, multiplier] */
const PRESETS = { pi: [1, 4], ln2: [2, 1] };


/* react to surplus / multiplier / constant changes */
document.querySelectorAll('input[name=const]').forEach(r => r.addEventListener('change', () => {
  const preset = PRESETS[document.querySelector('input[name=const]:checked').value];
  g('e_sur').value = preset[0];
  g('e_mul').value = preset[1];
  updateLabels(); calibrateYAxis(); updateStats(); chart.update('none');
}));
g('e_mul').addEventListener('change', () => { calibrateYAxis(); updateStats(); });
g('e_sur').addEventListener('change', () => { /* surplus only affects future trials */ });


/* init */
updateLabels();
calibrateYAxis();
updateStats();