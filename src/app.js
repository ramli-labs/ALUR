/* ALUR (Lab Maya Pseudocode) — antarmuka */
(function () {
  'use strict';
  const Core = window.LabCore, Data = window.LabData, Check = window.LabCheck;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const LH = 22, PADTOP = 14;

  /* ───────── storage (aman bila diblokir) ───────── */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('lmp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('lmp.' + k, JSON.stringify(v)); } catch (e) { /* abaikan */ } },
  };

  /* ───────── elemen ───────── */
  const el = {
    code: $('#code'), hl: $('#hl'), hlCode: $('#hl-code'), gutter: $('#gutter'), flag: $('#lineflag'), errbar: $('#errbar'),
    inputs: $('#inputs'), run: $('#btn-run'), step: $('#btn-step'), pause: $('#btn-pause'), reset: $('#btn-reset'), speed: $('#speed'),
    status: $('#status'), console: $('#console'), ask: $('#ask'), askLabel: $('#ask-label'), askInput: $('#ask-input'),
    vars: $('#p-vars'), trace: $('#p-trace'), flow: $('#flow'), py: $('#py-code'), example: $('#sel-example'), toast: $('#toast'),
  };
  const SPEEDS = [900, 420, 110, 0];

  /* ───────── state ───────── */
  const S = {
    view: 'lab', sub: 'vars', prog: null, parseErr: null, rt: null, gen: null, mode: 'idle', send: undefined, timer: null,
    resume: null, trace: null, quiet: false, curLine: null, errLine: null, zoom: store.get('zoom', 1), types: {},
    mission: null, scenario: null, lastVarSnap: new Map(), editTimer: null, saveTimer: null, missionResults: {},
  };

  /* ═════════════ EDITOR ═════════════ */
  function renderEditor() {
    const src = el.code.value;
    el.hlCode.innerHTML = Core.highlight(src, 'pseudo') + '\n ';
    const n = src.split('\n').length;
    let g = '';
    for (let i = 1; i <= n; i++) g += `<div data-n="${i}">${i}</div>`;
    el.gutter.innerHTML = g;
    markGutter();
    syncScroll();
  }
  function markGutter() {
    $$('.g-cur, .g-err', el.gutter).forEach(d => d.classList.remove('g-cur', 'g-err'));
    if (S.curLine) { const d = el.gutter.children[S.curLine - 1]; if (d) d.classList.add('g-cur'); }
    if (S.errLine) { const d = el.gutter.children[S.errLine - 1]; if (d) d.classList.add('g-err'); }
  }
  function syncScroll() {
    el.hl.scrollTop = el.code.scrollTop; el.hl.scrollLeft = el.code.scrollLeft;
    el.gutter.style.transform = `translateY(${-el.code.scrollTop}px)`;
  }
  function showFlag(line, isErr) {
    if (!line) { el.flag.hidden = true; return; }
    el.flag.hidden = false;
    el.flag.classList.toggle('err', !!isErr);
    el.flag.style.top = (PADTOP + (line - 1) * LH) + 'px';
    el.flag.style.width = Math.max(el.code.scrollWidth, el.code.clientWidth) + 'px';
    // gulir agar baris terlihat
    const top = PADTOP + (line - 1) * LH, view = el.code.clientHeight;
    if (top < el.code.scrollTop + 10 || top + LH > el.code.scrollTop + view - 30) { el.code.scrollTop = Math.max(0, top - view / 3); syncScroll(); }
  }
  function setCode(src, keepRun) {
    el.code.value = src;
    renderEditor();
    S.errLine = null;
    if (!keepRun) resetRun(false);
    compile();
  }
  function insertAtCursor(txt) {
    const ta = el.code, a = ta.selectionStart, b = ta.selectionEnd;
    ta.setRangeText(txt, a, b, 'end');
    ta.focus();
    onEdit();
  }
  const OPENERS = /^\s*(MULAI|SELAMA\b|UNTUK\b|FUNGSI\b|PROSEDUR\b|JIKA LAIN\b|.*\bMAKA\s*$)/;
  el.code.addEventListener('keydown', e => {
    const ta = el.code;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) doStep(); else doRun(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
      if (a === b && !e.shiftKey) { ta.setRangeText('  ', a, b, 'end'); onEdit(); return; }
      const ls = v.lastIndexOf('\n', a - 1) + 1, le = v.indexOf('\n', b - (b > a && v[b - 1] === '\n' ? 1 : 0)); const end = le < 0 ? v.length : le;
      const block = v.slice(ls, end).split('\n').map(l => e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l).join('\n');
      ta.setRangeText(block, ls, end, 'select'); onEdit(); return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      const a = ta.selectionStart, v = ta.value;
      const ls = v.lastIndexOf('\n', a - 1) + 1; const line = v.slice(ls, a);
      let ind = (/^\s*/.exec(line) || [''])[0];
      if (OPENERS.test(line) && !/AKHIR/.test(line)) ind += '  ';
      e.preventDefault(); ta.setRangeText('\n' + ind, a, ta.selectionEnd, 'end'); onEdit();
    }
  });
  el.code.addEventListener('input', () => {
    const ta = el.code, a = ta.selectionStart;
    if (a >= 2 && ta.value.slice(a - 2, a) === '<-' && ta.selectionEnd === a) { ta.setRangeText('←', a - 2, a, 'end'); }
    onEdit();
  });
  el.code.addEventListener('scroll', syncScroll);
  function onEdit() {
    renderEditor();
    if (S.mode !== 'idle') { resetRun(true); logInfo('Kode diubah. Tekan Jalankan untuk mencoba lagi.'); }
    S.errLine = null; showFlag(null); markGutter();
    clearTimeout(S.editTimer); S.editTimer = setTimeout(compile, 300);
    clearTimeout(S.saveTimer); S.saveTimer = setTimeout(saveCode, 400);
    if (S.mission) setMissionState(S.mission.id, 'wip');
  }
  function codeKey() { return S.mission ? 'code.' + S.mission.id + (S.scenario ? '.' + S.scenario.id : '') : 'code.free'; }
  function inputKey() { return S.mission ? 'inputs.' + S.mission.id + (S.scenario ? '.' + S.scenario.id : '') : 'inputs.free'; }
  function saveCode() { store.set(codeKey(), el.code.value); store.set(inputKey(), el.inputs.value); }
  el.inputs.addEventListener('input', () => { clearTimeout(S.saveTimer); S.saveTimer = setTimeout(saveCode, 400); });
  $$('.palette button').forEach(b => b.addEventListener('click', () => insertAtCursor(b.dataset.ins)));

  /* ═════════════ COMPILE ═════════════ */
  function compile() {
    try {
      S.prog = Core.parse(el.code.value);
      S.parseErr = null;
      if (S.prog.warnings.length) showErr({ message: S.prog.warnings[0] }, true); else showErr(null);
      renderFlow(); renderPython();
      return S.prog;
    } catch (e) {
      S.prog = null; S.parseErr = e;
      showErr(e);
      S.errLine = e.line || null; markGutter(); showFlag(e.line, true);
      return null;
    }
  }
  function showErr(e, warn) {
    if (!e) { el.errbar.hidden = true; return; }
    el.errbar.hidden = false;
    el.errbar.classList.toggle('warn', !!warn);
    el.errbar.innerHTML = (e.line ? `<b>Baris ${e.line}</b>` : '<b>Catatan</b>') + `<span>${esc(e.message)}</span>`;
  }

  /* ═════════════ RUN ENGINE ═════════════ */
  function parseInputs() {
    const v = el.inputs.value.trim();
    if (!v) return [];
    return v.split(/[\n,;]/).map(s => s.trim()).filter(s => s.length);
  }
  function setMode(m, label) {
    S.mode = m;
    const map = { idle: 'Siap', ready: 'Siap', running: 'Berjalan', paused: 'Dijeda', input: 'Menunggu INPUT', done: 'Selesai', error: 'Galat' };
    el.status.dataset.state = m === 'ready' ? 'idle' : m;
    el.status.textContent = label || map[m];
    el.pause.disabled = m !== 'running';
    el.run.lastChild.textContent = m === 'paused' ? 'Lanjutkan' : 'Jalankan';
  }
  function resetRun(silent) {
    clearTimeout(S.timer); S.timer = null;
    S.gen = null; S.rt = null; S.send = undefined; S.curLine = null;
    el.ask.hidden = true;
    clearActive();
    showFlag(S.errLine, true);
    markGutter();
    setMode('idle');
    if (!silent) { el.console.innerHTML = ''; S.trace = null; renderVars(); renderTrace(); }
  }
  function prepare() {
    clearTimeout(S.timer);
    S.errLine = null;
    const prog = compile();
    if (!prog) { setMode('error', 'Galat sintaks'); el.console.innerHTML = ''; logErr(S.parseErr); return false; }
    el.console.innerHTML = '';
    el.ask.hidden = true;
    S.trace = { cols: [], label: {}, rows: [], cur: null, prev: new Map(), count: 0, capped: false };
    S.lastVarSnap = new Map();
    S.rt = Core.createRun(prog, { inputs: parseInputs(), onOut: onOut, maxSteps: 200000 });
    S.gen = S.rt.gen; S.send = undefined;
    setMode('ready');
    return true;
  }
  function pump(stopAtStep, budget) {
    let n = 0;
    for (;;) {
      let r;
      try { r = S.gen.next(S.send); S.send = undefined; }
      catch (err) { finishError(err); return 'error'; }
      if (r.done) { finishDone(); return 'done'; }
      const e = r.value;
      if (e.ev === 'step') { onStep(e); if (stopAtStep) return 'step'; if (++n >= budget) return 'budget'; }
      else if (e.ev === 'cond') onCond(e);
      else if (e.ev === 'input') { askInput(e); return 'input'; }
    }
  }
  function doRun() {
    if (S.mode === 'running') return;
    if (S.mode === 'input') { el.askInput.focus(); return; }
    if (!(S.mode === 'paused' || S.mode === 'ready')) { if (!prepare()) return; }
    setMode('running');
    tick();
  }
  function tick() {
    if (S.mode !== 'running') return;
    const ms = SPEEDS[+el.speed.value];
    if (ms === 0) {
      S.quiet = true;
      const t0 = performance.now();
      let res;
      do { res = pump(false, 4000); } while (res === 'budget' && performance.now() - t0 < 40);
      S.quiet = false;
      if (res === 'budget') { setMode('running', `Berjalan · ${S.rt.steps.toLocaleString('id-ID')} langkah`); S.timer = setTimeout(tick, 0); return; }
      refreshAll();
      return;
    }
    const res = pump(true);
    if (res === 'step') { refreshAll(); S.timer = setTimeout(tick, ms); }
    else if (res !== 'input') refreshAll();
  }
  function doStep() {
    if (S.mode === 'input') { el.askInput.focus(); return; }
    if (S.mode === 'running') { pauseRun(); return; }
    if (!(S.mode === 'paused' || S.mode === 'ready')) { if (!prepare()) return; }
    setMode('paused');
    const res = pump(true);
    if (res === 'step') setMode('paused', `Langkah ${S.trace.count} · baris ${S.curLine}`);
    refreshAll();
  }
  function pauseRun() { clearTimeout(S.timer); S.timer = null; setMode('paused', `Dijeda · baris ${S.curLine || '-'}`); refreshAll(); }
  function askInput(e) {
    S.resume = S.mode === 'running' ? 'running' : 'paused';
    clearTimeout(S.timer);
    setMode('input');
    el.ask.hidden = false;
    el.askLabel.textContent = `INPUT ${e.name}`;
    el.askInput.value = '';
    refreshAll();
    setTimeout(() => el.askInput.focus(), 30);
  }
  el.ask.addEventListener('submit', ev => {
    ev.preventDefault();
    if (S.mode !== 'input') return;
    const v = el.askInput.value;
    if (!v.trim()) { el.askInput.focus(); return; }
    el.ask.hidden = true;
    S.send = v;
    if (S.resume === 'running') { setMode('running'); tick(); }
    else { setMode('paused'); const r = pump(true); if (r === 'step') setMode('paused', `Langkah ${S.trace.count} · baris ${S.curLine}`); refreshAll(); }
  });
  function finishDone() {
    closeRow();
    clearTimeout(S.timer);
    S.types = Object.assign({}, S.rt.types);
    setMode('done', `Selesai · ${S.rt.steps.toLocaleString('id-ID')} langkah`);
    S.curLine = null; clearActive(); showFlag(null); markGutter();
    logOk(`Program selesai dalam ${S.rt.steps.toLocaleString('id-ID')} langkah.`);
    renderPython();
  }
  function finishError(err) {
    closeRow();
    clearTimeout(S.timer);
    if (!(err instanceof Core.LabError)) err = new Core.LabError(S.curLine || 0, 'Terjadi kesalahan tak terduga: ' + err.message, 'jalan');
    S.errLine = err.line || S.curLine;
    S.curLine = null;
    setMode('error', 'Galat saat berjalan');
    logErr(err);
    showFlag(S.errLine, true); markGutter();
    clearActive();
    if (S.errLine) $$(`.fc-node[data-line="${S.errLine}"]`, el.flow).forEach(n => n.classList.add('is-err'));
  }
  function onStep(e) {
    closeRow();
    S.trace.cur = { n: ++S.trace.count, line: e.line, notes: [] };
    S.curLine = e.line;
  }
  function onCond(e) {
    if (S.trace.cur) S.trace.cur.notes.push({ t: 'c', text: e.text, v: e.value, detail: e.detail });
  }
  function onOut(o) {
    if (S.trace && S.trace.cur) S.trace.cur.notes.push({ t: o.kind, text: o.text });
    const d = document.createElement('div');
    d.className = 'o ' + (o.kind === 'in' ? 'o-in' : 'o-out');
    d.textContent = o.text;
    el.console.appendChild(d);
    if (!S.quiet) el.console.scrollTop = el.console.scrollHeight;
  }
  function logErr(e) { const d = document.createElement('div'); d.className = 'o o-err'; d.textContent = (e.line ? `Baris ${e.line}: ` : '') + e.message; el.console.appendChild(d); el.console.scrollTop = el.console.scrollHeight; }
  function logInfo(t) { const d = document.createElement('div'); d.className = 'o o-info'; d.textContent = t; el.console.appendChild(d); el.console.scrollTop = el.console.scrollHeight; }
  function logOk(t) { const d = document.createElement('div'); d.className = 'o o-ok'; d.textContent = t; el.console.appendChild(d); el.console.scrollTop = el.console.scrollHeight; }

  /* trace bookkeeping */
  function snapshot() {
    const m = new Map();
    if (!S.rt) return m;
    S.rt.frames.forEach(fr => fr.vars.forEach((v, k) => {
      const key = fr.fn ? k + '@' + fr.fn.name : k;
      m.set(key, { v: Core.fmt(v, true), label: fr.fn ? `${k} · ${fr.fn.name}` : k });
    }));
    return m;
  }
  function closeRow() {
    const T = S.trace; if (!T || !T.cur) return;
    const now = snapshot(); const ch = {};
    now.forEach((o, key) => {
      if (T.prev.get(key) !== o.v) {
        ch[key] = o.v;
        if (!T.label[key]) { T.cols.push(key); T.label[key] = o.label; }
      }
    });
    T.prev = new Map(Array.from(now, ([k, o]) => [k, o.v]));
    T.cur.ch = ch;
    if (Object.keys(ch).length || T.cur.notes.length) { if (T.rows.length < 600) T.rows.push(T.cur); else T.capped = true; }
    T.cur = null;
  }

  /* ═════════════ RENDER PANELS ═════════════ */
  function refreshAll() {
    showFlag(S.curLine || (S.mode === 'error' ? S.errLine : null), !S.curLine && S.mode === 'error');
    markGutter();
    renderVars();
    if (S.sub === 'trace') renderTrace();
    highlightFlow();
  }
  function typeLabel(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? 'bulat' : 'desimal';
    if (typeof v === 'string') return 'teks';
    if (typeof v === 'boolean') return 'logika';
    if (Array.isArray(v)) return v.tuple ? 'beberapa nilai' : `array · ${v.length} elemen`;
    return '';
  }
  function valueHtml(v) {
    if (Array.isArray(v) && !v.tuple && v.length && v.length <= 24 && v.every(x => !Array.isArray(x))) {
      return '<div class="cells">' + v.map((x, i) => `<span class="cell"><b>${esc(Core.fmt(x, true))}</b><i>${i + 1}</i></span>`).join('') + '</div>';
    }
    return esc(Core.fmt(v, true));
  }
  function renderVars() {
    if (S.sub !== 'vars') return;
    if (!S.rt) {
      el.vars.innerHTML = `<p class="empty">Variabel akan muncul di sini saat program berjalan. Tekan <strong>Langkah</strong> untuk mengamati perubahan nilainya satu per satu.</p>`;
      return;
    }
    const prev = S.lastVarSnap, next = new Map();
    const frames = S.rt.frames.slice().reverse();
    let html = '<div class="frames">';
    frames.forEach((fr, idx) => {
      const local = !!fr.fn;
      html += `<section class="frame${local ? ' local' : ''}"><div class="frame-h"><span>${esc(local ? fr.name : 'Program utama')}</span><span class="scope">${local ? (idx === 0 ? 'variabel lokal · sedang berjalan' : 'variabel lokal · menunggu') : 'variabel program utama'}</span></div>`;
      if (!fr.vars.size) html += `<div class="vrow"><span class="vname">—</span><span class="vval hint">belum ada variabel</span></div>`;
      fr.vars.forEach((v, k) => {
        const key = (fr.fn ? fr.key + ':' : '') + k, f = Core.fmt(v, true);
        next.set(key, f);
        const chg = prev.has(key) ? prev.get(key) !== f : prev.size > 0 || S.trace.count > 1;
        html += `<div class="vrow${chg ? ' chg' : ''}"><span class="vname">${esc(k)}<span class="vtype">${typeLabel(v)}</span></span><span class="vval">${valueHtml(v)}</span></div>`;
      });
      html += '</section>';
    });
    html += '</div>';
    el.vars.innerHTML = html;
    S.lastVarSnap = next;
    requestAnimationFrame(() => $$('.vrow.chg', el.vars).forEach(r => r.classList.remove('chg')));
  }
  function renderTrace() {
    const T = S.trace;
    if (!T || (!T.rows.length && !T.cur)) {
      el.trace.innerHTML = `<p class="empty">Tabel jejak mencatat setiap perubahan nilai variabel, hasil kondisi, dan output, seperti tabel jejak di LKPD 1 Bagian C. Jalankan program untuk mengisinya.</p>`;
      return;
    }
    const cols = T.cols;
    let h = '<div class="trace-wrap"><table class="trace"><thead><tr><th scope="col">#</th><th scope="col">Baris</th>' + cols.map(c => `<th scope="col">${esc(T.label[c])}</th>`).join('') + '<th scope="col">Keterangan</th></tr></thead><tbody>';
    const rows = T.rows.slice(-400);
    rows.forEach((r, i) => {
      const last = i === rows.length - 1 && (S.mode === 'paused' || S.mode === 'input');
      h += `<tr${last ? ' class="cur"' : ''}><td class="ln">${r.n}</td><td class="ln">${r.line}</td>` + cols.map(c => `<td class="v">${r.ch && r.ch[c] !== undefined ? esc(r.ch[c]) : ''}</td>`).join('');
      const notes = r.notes.map(nt => {
        if (nt.t === 'c') return `${esc(nt.text)}${nt.detail ? ` <span class="hint">(${esc(nt.detail)})</span>` : ''} → <span class="${nt.v ? 't' : 'f'}">${nt.v ? 'BENAR' : 'SALAH'}</span>`;
        if (nt.t === 'in') return `INPUT ${esc(nt.text)}`;
        return `OUTPUT “${esc(nt.text)}”`;
      }).join('<br>');
      h += `<td class="note">${notes}</td></tr>`;
    });
    h += '</tbody></table></div>';
    const total = T.rows.length;
    h += `<p class="hint trace-foot">${total} baris tercatat${T.capped || total > 400 ? '; tabel menampilkan 400 baris terakhir' : ''}. Kolom variabel hanya diisi ketika nilainya berubah.</p>`;
    el.trace.innerHTML = h;
    const wrap = $('.trace-wrap', el.trace);
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }

  /* flowchart */
  function renderFlow() {
    if (!S.prog) return;
    let charts;
    try { charts = Core.flowcharts(S.prog); } catch (e) { el.flow.innerHTML = `<p class="empty">Flowchart belum bisa digambar: ${esc(e.message)}</p>`; return; }
    if (!charts.length) { el.flow.innerHTML = '<p class="empty">Tulis program di antara MULAI dan SELESAI untuk melihat flowchart-nya.</p>'; return; }
    el.flow.innerHTML = charts.map(c => `<figure class="chart" style="margin:0"><h3>${esc(c.title)}</h3><div data-w="${c.w}">${c.svg}</div></figure>`).join('');
    applyZoom();
    highlightFlow();
  }
  function applyZoom() {
    $$('.chart [data-w]', el.flow).forEach(d => { const svg = d.firstElementChild; if (svg) svg.style.width = Math.round(+d.dataset.w * S.zoom) + 'px'; });
    $('#z-val').textContent = Math.round(S.zoom * 100) + '%';
  }
  function clearActive() { $$('.fc-node.is-active, .fc-node.is-err', el.flow).forEach(n => n.classList.remove('is-active', 'is-err')); }
  function highlightFlow() {
    clearActive();
    if (!S.curLine) return;
    const nodes = $$(`.fc-node[data-line="${S.curLine}"]`, el.flow);
    nodes.forEach(n => n.classList.add('is-active'));
    if (S.sub === 'flow' && nodes.length) {
      const box = el.flow.getBoundingClientRect(), r = nodes[nodes.length > 1 ? 1 : 0].getBoundingClientRect();
      if (r.top < box.top + 20 || r.bottom > box.bottom - 20) el.flow.scrollTop += (r.top - box.top) - box.height / 3;
      if (r.left < box.left + 20 || r.right > box.right - 20) el.flow.scrollLeft += (r.left - box.left) - box.width / 3;
    }
  }
  $('#z-in').addEventListener('click', () => { S.zoom = Math.min(2, +(S.zoom + 0.1).toFixed(2)); store.set('zoom', S.zoom); applyZoom(); });
  $('#z-out').addEventListener('click', () => { S.zoom = Math.max(0.4, +(S.zoom - 0.1).toFixed(2)); store.set('zoom', S.zoom); applyZoom(); });
  $('#z-fit').addEventListener('click', () => {
    const ws = $$('.chart [data-w]', el.flow).map(d => +d.dataset.w);
    if (!ws.length) return;
    const avail = el.flow.clientWidth - 30;
    S.zoom = Math.max(0.4, Math.min(1.2, +(avail / Math.max(...ws)).toFixed(2)));
    store.set('zoom', S.zoom); applyZoom();
  });

  /* python */
  function renderPython() {
    if (!S.prog) return;
    let src;
    try { src = Core.toPython(S.prog, S.types); } catch (e) { el.py.textContent = 'Konversi belum bisa dibuat: ' + e.message; return; }
    el.py.innerHTML = Core.highlight(src, 'py');
    el.py.dataset.src = src;
  }
  $('#btn-copy-py').addEventListener('click', () => copyText(el.py.dataset.src || '', 'Kode Python disalin.'));

  /* sub tabs */
  function setSub(name) {
    S.sub = name;
    $$('.subtabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.sub === name)));
    ['vars', 'trace', 'flow', 'py'].forEach(n => { $('#p-' + n).hidden = n !== name; });
    store.set('sub', name);
    if (name === 'vars') renderVars();
    if (name === 'trace') renderTrace();
    if (name === 'flow') highlightFlow();
  }
  $$('.subtabs button').forEach(b => b.addEventListener('click', () => setSub(b.dataset.sub)));
  $('.subtabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const bs = $$('.subtabs button'); const i = bs.findIndex(b => b.dataset.sub === S.sub);
    const nb = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; setSub(nb.dataset.sub); nb.focus();
  });

  /* controls */
  el.run.addEventListener('click', doRun);
  el.step.addEventListener('click', doStep);
  el.pause.addEventListener('click', pauseRun);
  el.reset.addEventListener('click', () => { S.errLine = null; resetRun(false); compile(); logInfo('Program diulang dari awal.'); });
  $('#btn-clear').addEventListener('click', () => { el.console.innerHTML = ''; });
  el.speed.addEventListener('change', () => store.set('speed', el.speed.value));

  /* ═════════════ EXAMPLES ═════════════ */
  function fillExamples() {
    const groups = {};
    Data.EXAMPLES.forEach(ex => { (groups[ex.tp] = groups[ex.tp] || []).push(ex); });
    let h = '<option value="">Pilih contoh dari modul…</option>';
    Object.keys(groups).sort().forEach(tp => { h += `<optgroup label="${tp}">` + groups[tp].map(ex => `<option value="${ex.id}">${esc(ex.title)}</option>`).join('') + '</optgroup>'; });
    el.example.innerHTML = h;
  }
  el.example.addEventListener('change', () => {
    const ex = Data.EXAMPLES.find(e => e.id === el.example.value);
    if (!ex) return;
    if (S.mission) exitMission(true);
    const prevCode = el.code.value, prevIn = el.inputs.value;
    el.inputs.value = ex.inputs;
    setCode(ex.code);
    saveCode();
    el.example.value = '';
    toast(`Contoh “${ex.title}” dimuat.`, 'Batalkan', () => { el.inputs.value = prevIn; setCode(prevCode); saveCode(); });
  });

  /* ═════════════ VIEWS ═════════════ */
  function setView(v) {
    S.view = v;
    $$('.views button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
    ['lab', 'rakit', 'susun', 'misi', 'notasi'].forEach(n => { $('#view-' + n).hidden = n !== v; });
    store.set('view', v);
    if (v === 'misi') renderMissionList();
    if (v === 'susun') renderSusun(false);
    if (v === 'rakit') renderRakit();
  }
  $$('.views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  /* ═════════════ MISSIONS ═════════════ */
  const done = () => store.get('done', {});
  function setMissionState(id, st) {
    const d = done();
    if (st === 'wip' && d[id] && d[id].state === 'done') return;
    d[id] = Object.assign({}, d[id] || {}, { state: st, at: Date.now() });
    store.set('done', d); updateCount();
  }
  function updateCount() {
    const d = done(); const n = Data.MISSIONS.filter(m => d[m.id] && d[m.id].state === 'done').length;
    $('#misi-count').textContent = `${n}/${Data.MISSIONS.length}`;
    $('#progress-fill').style.width = (n / Data.MISSIONS.length * 100) + '%';
  }
  let selMission = store.get('selMission', 'm1');
  function renderMissionList(skipDetail) {
    const d = done(); let h = '', group = '';
    Data.MISSIONS.forEach((m, i) => {
      const g = m.lkpd.split(' · ')[0];
      if (g !== group) { group = g; h += `<li class="misi-group">${esc(g)}</li>`; }
      const st = d[m.id] ? d[m.id].state : '';
      h += `<li><button class="mcard" type="button" data-id="${m.id}" aria-current="${m.id === selMission}"><span class="mnum">M${i + 1}</span><span><span class="mtitle">${esc(m.title)}</span><span class="mskill">${esc(m.lkpd)} · ${esc(m.skill)}</span></span><span class="mstate ${st === 'done' ? 'done' : st === 'wip' ? 'wip' : ''}">${st === 'done' ? 'Lulus' : st === 'wip' ? 'Dikerjakan' : 'Belum'}</span></button></li>`;
    });
    $('#misi-list').innerHTML = h;
    $$('.mcard').forEach(b => b.addEventListener('click', () => { selMission = b.dataset.id; store.set('selMission', selMission); renderMissionList(); }));
    if (!skipDetail) renderMissionDetail();
  }
  function reqPreview(m) {
    if (m.kind === 'project') return [];
    const L = { mulai: 'MULAI … SELESAI', input: 'memakai INPUT', minStmts: r => `≥ ${r.n} langkah`, if: 'seleksi JIKA', elif: 'JIKA LAIN JIKA', loop: 'pengulangan', for: 'pengulangan UNTUK', while: 'pengulangan SELAMA', funcs: r => `≥ ${r.n} FUNGSI`, procs: r => `≥ ${r.n} PROSEDUR`, named: r => `${r.kind} ${r.name}` };
    return (m.reqs || []).map(r => typeof L[r.t] === 'function' ? L[r.t](r) : L[r.t]);
  }
  function renderMissionDetail() {
    const m = Data.MISSIONS.find(x => x.id === selMission) || Data.MISSIONS[0];
    const idx = Data.MISSIONS.indexOf(m) + 1;
    const d = done(); const isDone = d[m.id] && d[m.id].state === 'done';
    let h = `<div><div class="md-tag">M${idx} · ${esc(m.lkpd)} · ${esc(m.tp)}</div><h3>${esc(m.title)}</h3></div><p>${esc(m.task)}</p>`;
    if (m.kind === 'trace') {
      const ex = Data.EXAMPLES.find(e => e.id === m.code);
      h += `<pre class="mini-code">${Core.highlight(ex.code, 'pseudo')}</pre>`;
      h += `<div class="table-wrap" style="box-shadow:none"><table class="trace-quiz"><thead><tr><th scope="col">Iterasi</th><th scope="col">hasil</th><th scope="col">i</th></tr></thead><tbody><tr><td>Sebelum loop</td><td>1</td><td>1</td></tr>`;
      m.rows.forEach((r, k) => { h += `<tr><td>${r.label}</td><td><input type="text" inputmode="numeric" id="tq-h${k}" aria-label="${r.label} hasil"></td><td><input type="text" inputmode="numeric" id="tq-i${k}" aria-label="${r.label} i"></td></tr>`; });
      h += `<tr><td>Setelah loop</td><td colspan="2">OUTPUT <input type="text" inputmode="numeric" id="tq-out" aria-label="Output akhir"></td></tr></tbody></table></div>`;
      h += `<details class="hintbox"><summary>Lihat petunjuk</summary><p>${esc(m.hint)}</p></details>`;
      h += `<p class="result-line" id="tq-res" hidden></p>`;
      h += `<div class="md-actions"><button class="btn btn-primary" id="tq-check" type="button">Periksa jawaban</button><button class="btn" id="tq-lab" type="button">Buktikan di Lab</button>${isDone ? '<button class="btn" id="md-proof" type="button">Salin bukti pengerjaan</button>' : ''}</div>`;
    } else {
      if (m.kind === 'project') {
        const sid = store.get('scen', 'A');
        h += `<div class="scen" role="group" aria-label="Pilih skenario">` + m.scenarios.map(s => `<button type="button" data-s="${s.id}" aria-pressed="${s.id === sid}"><span class="L">${s.id} · ${esc(s.title)}</span><span class="d">${esc(s.desc)}</span><span class="chip">min. ${s.min} subprogram</span></button>`).join('') + '</div>';
      } else {
        h += `<div class="md-meta">${reqPreview(m).map(x => `<span class="chip">${esc(x)}</span>`).join('')}<span class="chip">${(m.tests || []).length} data uji</span>${isDone ? '<span class="chip ok">Lulus</span>' : ''}</div>`;
      }
      h += `<details class="hintbox"><summary>Lihat petunjuk</summary><p>${esc(m.hint)}</p></details>`;
      h += `<div class="md-actions"><button class="btn btn-primary" id="md-open" type="button">Kerjakan di Lab</button>${isDone ? '<button class="btn" id="md-proof" type="button">Salin bukti pengerjaan</button>' : ''}</div>`;
      h += `<p class="hint">Kode untuk misi ini tersimpan otomatis di peramban, terpisah dari kode di Lab.</p>`;
    }
    h += `<textarea class="proof" id="proof-box" readonly hidden aria-label="Teks bukti pengerjaan"></textarea>`;
    const box = $('#misi-detail'); box.innerHTML = h;
    if (m.kind === 'project') $$('.scen button', box).forEach(b => b.addEventListener('click', () => { store.set('scen', b.dataset.s); renderMissionDetail(); }));
    const open = $('#md-open', box); if (open) open.addEventListener('click', () => startMission(m));
    const proof = $('#md-proof', box); if (proof) proof.addEventListener('click', () => copyProof(m));
    if (m.kind === 'trace') {
      $('#tq-check', box).addEventListener('click', () => checkTrace(m));
      $('#tq-lab', box).addEventListener('click', () => {
        const ex = Data.EXAMPLES.find(e => e.id === m.code);
        if (S.mission) exitMission(true);
        el.inputs.value = '4'; setCode(ex.code); saveCode(); setView('lab'); setSub('trace'); el.speed.value = '1'; doRun();
      });
    }
  }
  function checkTrace(m) {
    let ok = 0, total = 0;
    m.rows.forEach((r, k) => {
      [['h', r.hasil], ['i', r.i]].forEach(([c, want]) => {
        const inp = $(`#tq-${c}${k}`); total++;
        const good = Core.coerceInput(inp.value) === want; if (good) ok++;
        inp.classList.toggle('ok', good); inp.classList.toggle('no', !good);
      });
    });
    const out = $('#tq-out'); total++; const g = Core.coerceInput(out.value) === m.output; if (g) ok++;
    out.classList.toggle('ok', g); out.classList.toggle('no', !g);
    const res = $('#tq-res'); res.hidden = false;
    if (ok === total) { res.className = 'result-line ok'; res.textContent = `Semua ${total} isian benar. Algoritma ini menghitung faktorial: 4! = 24.`; setMissionState(m.id, 'done'); S.missionResults[m.id] = { reqs: [], tests: [{ ok: true }], passed: true, trace: `${ok}/${total}` }; renderMissionList(true); const acts = $('#misi-detail .md-actions'); if (acts && !$('#md-proof')) { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.id = 'md-proof'; b.textContent = 'Salin bukti pengerjaan'; b.addEventListener('click', () => copyProof(m)); acts.appendChild(b); } }
    else { res.className = 'result-line no'; res.textContent = `${ok} dari ${total} isian benar. Periksa kotak merah, lalu coba “Buktikan di Lab” untuk melihat tabel jejaknya.`; }
  }
  function startMission(m) {
    S.mission = m;
    S.scenario = m.kind === 'project' ? m.scenarios.find(s => s.id === store.get('scen', 'A')) : null;
    const starter = S.scenario ? S.scenario.starter : m.starter;
    const inputs = S.scenario ? S.scenario.inputs : m.inputs;
    el.inputs.value = store.get(inputKey(), inputs);
    setCode(store.get(codeKey(), starter));
    const idx = Data.MISSIONS.indexOf(m) + 1;
    $('#ms-tag').textContent = `M${idx} · ${m.lkpd}`;
    $('#ms-title').textContent = m.title + (S.scenario ? ` · Skenario ${S.scenario.id}: ${S.scenario.title}` : '');
    $('#ms-sub').textContent = m.tp;
    $('#ms-task').textContent = m.task + (S.scenario ? ' ' + S.scenario.desc : '');
    $('#ms-task').hidden = true;
    $('#ms-results').hidden = true;
    $('#mission-strip').hidden = false;
    setMissionState(m.id, 'wip');
    setView('lab');
    el.code.focus();
  }
  function exitMission(silent) {
    saveCode();
    S.mission = null; S.scenario = null;
    $('#mission-strip').hidden = true;
    if (!silent) { el.inputs.value = store.get('inputs.free', ''); setCode(store.get('code.free', Data.EXAMPLES[1].code)); }
  }
  $('#btn-ms-exit').addEventListener('click', () => exitMission(false));
  $('#btn-ms-task').addEventListener('click', () => { const t = $('#ms-task'); t.hidden = !t.hidden; });
  $('#btn-test').addEventListener('click', () => {
    const m = S.mission; if (!m) return;
    saveCode();
    const r = Check.checkMission(m, el.code.value, S.scenario);
    S.missionResults[m.id] = r;
    const box = $('#ms-results'); box.hidden = false;
    if (r.parseError) {
      box.innerHTML = `<div class="ms-summary no">Program belum bisa dibaca: baris ${r.parseError.line}, ${esc(r.parseError.message)}</div>`;
      return;
    }
    const nOk = r.tests.filter(t => t.ok).length, rOk = r.reqs.filter(t => t.ok).length;
    let h = `<div class="ms-summary ${r.passed ? 'ok' : 'no'}">${r.passed ? 'Lulus! Semua syarat terpenuhi' + (r.tests.length ? ` dan ${r.tests.length} data uji benar.` : '.') : `Belum lulus: syarat ${rOk}/${r.reqs.length}` + (r.tests.length ? `, data uji ${nOk}/${r.tests.length}.` : '.')}</div>`;
    h += `<div><p class="col-title">Syarat</p><ul class="checklist">${r.reqs.map(x => `<li class="${x.ok ? 'ok' : 'no'}"><span class="mk">${x.ok ? '✓' : '✗'}</span><span>${esc(x.label)}</span></li>`).join('')}</ul></div>`;
    if (r.tests.length) h += `<div><p class="col-title">Data uji</p><ul class="checklist">${r.tests.map(x => `<li class="${x.ok ? 'ok' : 'no'}"><span class="mk">${x.ok ? '✓' : '✗'}</span><span>${esc(x.label)}${x.detail ? `<span class="det">${esc(x.detail)}</span>` : ''}</span></li>`).join('')}</ul></div>`;
    else if (m.kind === 'project') h += `<div><p class="col-title">Langkah berikutnya</p><p class="hint">Jalankan programmu dengan beberapa data masukan dan periksa sendiri hasilnya. Untuk mini-demo, tunjukkan tabel jejak dan flowchart-nya.</p></div>`;
    if (r.passed) h += `<div style="grid-column:1/-1"><button class="btn" type="button" id="ms-proof">Salin bukti pengerjaan</button></div>`;
    box.innerHTML = h;
    const pb = $('#ms-proof', box); if (pb) pb.addEventListener('click', () => copyProof(m));
    if (r.passed) { setMissionState(m.id, 'done'); toast('Misi lulus. Bukti pengerjaan bisa disalin untuk dikumpulkan.'); }
  });

  function copyProof(m) {
    const d = done()[m.id] || {};
    const r = S.missionResults[m.id];
    const idx = Data.MISSIONS.indexOf(m) + 1;
    const when = new Date(d.at || Date.now()).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    const scen = m.kind === 'project' ? Data.MISSIONS[idx - 1].scenarios.find(s => s.id === store.get('scen', 'A')) : null;
    const key = 'code.' + m.id + (scen ? '.' + scen.id : '');
    let hasil = 'LULUS';
    if (r && r.trace) hasil += ` · isian tabel jejak ${r.trace}`;
    else if (r && !r.parseError) hasil += ` · syarat ${r.reqs.filter(x => x.ok).length}/${r.reqs.length}` + (r.tests.length ? ` · data uji ${r.tests.filter(x => x.ok).length}/${r.tests.length}` : '');
    const lines = ['ALUR · Lab Maya Pseudocode · bukti pengerjaan', `Nama  : ${store.get('name', '') || '-'}`, `Kelas : ${store.get('kelas', '') || '-'}`,
      `Misi  : M${idx} ${m.title}${scen ? ` (Skenario ${scen.id}: ${scen.title})` : ''} · ${m.lkpd}`, `Hasil : ${hasil}`, `Waktu : ${when}`];
    if (m.kind !== 'trace') { lines.push('', '--- Pseudocode ---', store.get(key, '')); }
    const txt = lines.join('\n');
    copyText(txt, 'Bukti pengerjaan disalin. Tempelkan di tugas Google Classroom.', () => {
      const box = $('#proof-box') || null;
      if (box && S.view === 'misi') { box.hidden = false; box.value = txt; box.focus(); box.select(); }
      else { setView('misi'); setTimeout(() => { const b = $('#proof-box'); if (b) { b.hidden = false; b.value = txt; b.select(); } }, 50); }
    });
  }
  const whoName = $('#who-name'), whoClass = $('#who-class');
  whoName.value = store.get('name', ''); whoClass.value = store.get('kelas', '');
  whoName.addEventListener('input', () => store.set('name', whoName.value));
  whoClass.addEventListener('input', () => store.set('kelas', whoClass.value));

  /* ═════════════ NOTASI table ═════════════ */
  function sym(kind) {
    const a = 'fill="var(--sheet)" stroke="var(--ink)" stroke-width="1.4"';
    const s = { term: `<rect x="1" y="3" width="34" height="14" rx="7" fill="var(--ink)"/>`, proc: `<rect x="2" y="3" width="32" height="14" ${a}/>`, io: `<polygon points="7,3 35,3 29,17 1,17" ${a}/>`,
      dec: `<polygon points="18,1 35,10 18,19 1,10" fill="var(--amber-soft)" stroke="var(--ink)" stroke-width="1.4"/>`, sub: `<rect x="2" y="3" width="32" height="14" ${a}/><line x1="6" y1="3" x2="6" y2="17" stroke="var(--ink)"/><line x1="30" y1="3" x2="30" y2="17" stroke="var(--ink)"/>`, none: '' }[kind];
    return s ? `<svg class="sym" width="36" height="20" viewBox="0 0 36 20" aria-hidden="true">${s}</svg>` : '<span class="hint">—</span>';
  }
  const REF = [
    ['Awal / akhir', 'MULAI … SELESAI', '(tidak ada)', 'term'], ['Penugasan', 'total ← 0', 'total = 0', 'proc'], ['Input', 'INPUT nilai', 'nilai = int(input())', 'io'],
    ['Output', 'OUTPUT "Halo " + nama', 'print(f"Halo {nama}")', 'io'], ['Seleksi', 'JIKA x > 0 MAKA … AKHIR JIKA', 'if x > 0:', 'dec'],
    ['Seleksi ganda', 'JIKA LAIN JIKA x < 0 MAKA', 'elif x < 0:', 'dec'], ['Seleksi alternatif', 'JIKA LAIN', 'else:', 'none'],
    ['Pengulangan kondisi', 'SELAMA i < 10 … AKHIR SELAMA', 'while i < 10:', 'dec'], ['Pengulangan hitung', 'UNTUK i DARI 1 HINGGA 10 … AKHIR UNTUK', 'for i in range(1, 11):', 'dec'],
    ['Telusuri koleksi', 'UNTUK SETIAP n DALAM data', 'for n in data:', 'dec'], ['Tambah ke array', 'TAMBAH x KE data', 'data.append(x)', 'proc'],
    ['Fungsi', 'FUNGSI luas(p, l) … KEMBALIKAN p × l … AKHIR FUNGSI', 'def luas(p, l): return p * l', 'sub'], ['Prosedur', 'PROSEDUR cetak(pesan) … AKHIR PROSEDUR', 'def cetak(pesan):', 'sub'],
    ['Array', 'data ← [1, 2, 3]  ·  ARRAY kosong', 'data = [1, 2, 3]  ·  []', 'proc'], ['Komentar', '# keterangan', '# keterangan', 'none'],
  ];
  $('#ref-body').innerHTML = REF.map(r => `<tr><td>${r[0]}</td><td><code class="ps">${esc(r[1])}</code></td><td><code class="pyc">${esc(r[2])}</code></td><td>${sym(r[3])}</td></tr>`).join('');

  /* ═════════════ SUSUN FLOWCHART ═════════════ */
  const SYM = {
    term: { name: 'Terminal', why: 'Awal dan akhir (MULAI, SELESAI, kepala FUNGSI, KEMBALIKAN) memakai terminal (oval).' },
    proc: { name: 'Proses', why: 'Penugasan dengan ← memakai simbol proses (persegi panjang).' },
    io: { name: 'Input/Output', why: 'INPUT dan OUTPUT memakai jajar genjang.' },
    dec: { name: 'Keputusan', why: 'Kondisi yang dijawab Ya/Tidak (bertanda ?) memakai belah ketupat.' },
    sub: { name: 'Subprogram', why: 'Memanggil fungsi atau prosedur buatan sendiri memakai simbol subprogram (garis tepi ganda).' },
  };
  const SYM_ORDER = ['term', 'proc', 'io', 'dec', 'sub'];
  const symOf = t => (t === 'ret' ? 'term' : t);
  const LEVELS = [
    { id: 'mudah', name: 'Mudah', desc: 'Simbol sudah tersedia. Tempatkan setiap kartu ke simbol yang tepat.' },
    { id: 'sedang', name: 'Sedang', desc: 'Kotak masih kosong. Tempatkan kartu, lalu pilih simbolnya sendiri.' },
    { id: 'sulit', name: 'Sulit', desc: 'Seperti Sedang, tetapi pseudocode disembunyikan. Rancang dari soal cerita.' },
  ];
  const P = { id: store.get('fc.sel', 'f1'), level: store.get('fc.level', 'mudah'), pz: null, place: {}, sym: {}, marks: {}, tries: 0, helped: false, solved: false, sel: null, zoom: store.get('fc.zoom', 1) };
  const pzDone = () => store.get('fc.done', {});
  const pzEl = { canvas: $('#pz-canvas'), soal: $('#pz-soal'), syms: $('#pz-syms'), hint: $('#pz-hint'), cards: $('#pz-cards'), actions: $('#pz-actions'), fb: $('#pz-feedback'), proof: $('#pz-proof') };

  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function autoDecoys(slots) {
    const have = new Set(slots.map(s => s.text)), out = [];
    const swaps = [[' ≤ ', ' < '], [' < ', ' ≤ '], [' ≥ ', ' > '], [' > ', ' ≥ '], [' ≠ ', ' = '], [' = ', ' ≠ ']];
    for (const s of slots) {
      if (out.length >= 2) break;
      if (s.type !== 'dec') continue;
      const sw = swaps.find(([a]) => s.text.includes(a));
      if (sw) { const t = s.text.replace(sw[0], sw[1]); if (!have.has(t)) { out.push([t, 'Perhatikan operator pembandingnya.']); have.add(t); } }
    }
    if (!out.length) {
      const s = slots.find(x => x.type === 'proc' && / [+×] /.test(x.text));
      if (s) { const t = s.text.includes(' + ') ? s.text.replace(' + ', ' - ') : s.text.replace(' × ', ' + '); if (!have.has(t)) out.push([t, 'Perhatikan operator hitungnya.']); }
    }
    return out;
  }
  function pzStateKey() { return 'fc.st.' + P.id + '.' + P.level; }
  function pzSave() { if (P.pz && !P.pz.custom) store.set(pzStateKey(), { place: P.place, sym: P.sym, tries: P.tries, n: P.pz.slots.length }); }
  function buildPuzzle() {
    const custom = P.id === 'lab';
    const def = custom ? null : (Data.PUZZLES.find(x => x.id === P.id) || Data.PUZZLES[0]);
    if (def) P.id = def.id;
    const code = custom ? el.code.value : def.code;
    P.place = {}; P.sym = {}; P.marks = {}; P.tries = 0; P.helped = false; P.solved = false; P.sel = null;
    pzEl.fb.hidden = true; pzEl.proof.hidden = true;
    let prog;
    try { prog = Core.parse(code); } catch (e) { P.pz = { custom, error: `Kode di tab Lab belum bisa dibaca (baris ${e.line || '?'}: ${e.message}). Perbaiki dulu di tab Lab.` }; return; }
    const fp = Core.flowPuzzle(prog);
    if (!fp.slots.length) { P.pz = { custom, error: 'Kode di tab Lab belum berisi program di antara MULAI dan SELESAI.' }; return; }
    const decoys = custom ? autoDecoys(fp.slots) : def.decoys;
    const cards = fp.slots.map(s => ({ text: s.text })).concat(decoys.map(d => ({ text: d[0], decoy: true, why: d[1] })));
    const rnd = seeded(custom ? code : def.id);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    P.pz = { custom, def, code, inputs: custom ? el.inputs.value : def.inputs, charts: fp.charts, slots: fp.slots, cards };
    if (!custom) {
      const st = store.get(pzStateKey(), null);
      if (st && st.n === fp.slots.length) { P.place = st.place || {}; P.sym = st.sym || {}; P.tries = st.tries || 0; }
    }
  }
  function renderSusun(rebuild) {
    if (rebuild || !P.pz || P.id === 'lab') buildPuzzle();
    renderLevels(); renderPicker(); renderSoal(); renderCanvas(); renderDock();
  }
  function renderLevels() {
    $('#pz-levels').innerHTML = LEVELS.map(l => `<button type="button" role="radio" aria-checked="${l.id === P.level}" data-l="${l.id}">${l.name}</button>`).join('');
    $('#pz-level-note').textContent = LEVELS.find(l => l.id === P.level).desc;
    $$('#pz-levels button').forEach(b => b.addEventListener('click', () => { P.level = b.dataset.l; store.set('fc.level', P.level); renderSusun(true); }));
  }
  function renderPicker() {
    const d = pzDone();
    let h = Data.PUZZLES.map((p, i) => {
      const st = d[p.id];
      const badge = st ? LEVELS.find(l => l.id === st.level).name : '';
      return `<button type="button" class="pz-chip${st ? ' done' : ''}" data-id="${p.id}" aria-pressed="${p.id === P.id}" title="${esc(p.skill)}"><span class="n">${st ? '✓ ' : ''}F${i + 1}</span>${esc(p.title)}${badge ? `<span class="lv">${badge}</span>` : ''}</button>`;
    }).join('');
    h += `<button type="button" class="pz-chip pz-chip-lab" data-id="lab" aria-pressed="${P.id === 'lab'}" title="Membuat soal dari kode yang terbuka di tab Lab"><span class="n">+</span>Dari kode di Lab</button>`;
    const box = $('#pz-picker'); box.innerHTML = h;
    const cur = $('.pz-chip[aria-pressed="true"]', box);
    if (cur && box.scrollWidth > box.clientWidth) box.scrollLeft = cur.offsetLeft - 16;
    $$('.pz-chip', box).forEach(b => b.addEventListener('click', () => { P.id = b.dataset.id; if (P.id !== 'lab') store.set('fc.sel', P.id); renderSusun(true); }));
    updateSusunCount();
  }
  function updateSusunCount() {
    const d = pzDone(); const n = Data.PUZZLES.filter(p => d[p.id]).length;
    $('#susun-count').textContent = `${n}/${Data.PUZZLES.length}`;
  }
  function renderSoal() {
    const pz = P.pz;
    if (pz.error) { pzEl.soal.innerHTML = `<div class="md-tag">Dari kode di Lab</div><h3>Belum bisa dibuat</h3><p>${esc(pz.error)}</p>`; return; }
    const idx = pz.custom ? 0 : Data.PUZZLES.indexOf(pz.def) + 1;
    const tag = pz.custom ? 'Dari kode di Lab' : `F${idx} · ${pz.def.skill} · ${pz.def.ref}`;
    const title = pz.custom ? 'Flowchart dari kodemu' : pz.def.title;
    const story = pz.custom ? 'Kerangka ini dibuat dari pseudocode yang sedang terbuka di tab Lab. Susun kembali flowchart-nya.' : pz.def.story;
    let h = `<div class="md-tag">${esc(tag)}</div><h3>${esc(title)}</h3><p>${esc(story)}</p>`;
    if (P.level === 'sulit' && !P.solved) h += `<p class="hint">Pseudocode disembunyikan di tingkat Sulit. Pikirkan urutan langkahnya dari soal cerita.</p>`;
    else h += `<details class="pz-code"${P.level === 'mudah' ? ' open' : ''}><summary>Pseudocode</summary><pre class="mini-code">${Core.highlight(pz.code, 'pseudo')}</pre></details>`;
    pzEl.soal.innerHTML = h;
  }
  function renderCanvas() {
    const pz = P.pz;
    if (pz.error) { pzEl.canvas.innerHTML = '<p class="empty">Kerangka flowchart akan muncul di sini.</p>'; return; }
    pzEl.canvas.innerHTML = pz.charts.map((c, i) => `<figure class="chart" style="margin:0"><h3>${pz.charts.length > 1 ? (c.kind === 'main' ? 'Program utama' : 'Subprogram ' + i) : 'Flowchart'}</h3><div data-w="${c.w}">${c.svg}</div></figure>`).join('');
    $$('.fc-slot', pzEl.canvas).forEach(g => { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); });
    pzApplyZoom();
    paintSlots();
  }
  function slotSym(s) { return P.level === 'mudah' ? s.type : (P.sym[s.id] || null); }
  function paintSlots() {
    const pz = P.pz; if (!pz || pz.error) return;
    pz.slots.forEach(s => {
      const g = $(`.fc-slot[data-slot="${s.id}"]`, pzEl.canvas); if (!g) return;
      const ci = P.place[s.id], card = ci != null ? pz.cards[ci] : null, sym = slotSym(s);
      const text = card ? card.text : '';
      let inner;
      if (sym) inner = Core.shapeInner(sym, s.x, s.y, s.w, s.h, text);
      else inner = `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="6" class="pz-ph"/>` + (text ? `<text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + 4}" text-anchor="middle" class="fc-text">${esc(Core.fitText(text, s.w, 'proc'))}</text>` : `<text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + 4}" text-anchor="middle" class="pz-q">?</text>`);
      const n = s.id + 1;
      inner += `<g class="pz-num" aria-hidden="true"><circle cx="${s.x + 1}" cy="${s.y + 1}" r="8.5"/><text x="${s.x + 1}" y="${s.y + 4.5}" text-anchor="middle">${n}</text></g>`;
      g.innerHTML = (text ? `<title>${esc(text)}</title>` : '') + inner;
      g.classList.toggle('pz-empty', !card);
      g.classList.toggle('is-sel', !!(P.sel && P.sel.slot === s.id));
      g.classList.toggle('is-ok', P.marks[s.id] === 'ok');
      g.classList.toggle('is-no', P.marks[s.id] === 'no');
      g.setAttribute('aria-label', `Kotak ${n}` + (card ? `: ${card.text}` : ', kosong') + (P.level !== 'mudah' ? (sym ? `, simbol ${SYM[symOf(sym)].name}` : ', simbol belum dipilih') : ''));
    });
  }
  function renderDock() {
    const pz = P.pz;
    if (pz.error) { pzEl.syms.innerHTML = ''; pzEl.cards.innerHTML = ''; pzEl.hint.textContent = ''; pzEl.actions.innerHTML = ''; return; }
    // simbol
    const selSlot = P.sel && P.sel.slot != null ? pz.slots[P.sel.slot] : null;
    if (P.level === 'mudah') { pzEl.syms.hidden = true; }
    else {
      pzEl.syms.hidden = false;
      const cur = selSlot ? P.sym[selSlot.id] : null;
      pzEl.syms.innerHTML = SYM_ORDER.map(k => `<button type="button" class="pz-sym" data-sym="${k}" aria-pressed="${cur ? symOf(cur) === k : false}"${selSlot && !P.solved ? '' : ' disabled'}>${sym(k)}<span>${k === 'io' ? 'Input / Output' : SYM[k].name}</span></button>`).join('');
      $$('.pz-sym', pzEl.syms).forEach(b => b.addEventListener('click', () => setSym(b.dataset.sym)));
    }
    // petunjuk
    const filled = Object.keys(P.place).length;
    let hint;
    if (P.solved) hint = P.helped ? 'Jawaban ditunjukkan. Tekan Ulangi untuk mencoba sendiri.' : 'Semua kotak benar. Flowchart selesai disusun.';
    else if (P.sel && P.sel.card != null) hint = `Ketuk kotak di flowchart untuk menempatkan “${pz.cards[P.sel.card].text}”.`;
    else if (selSlot) {
      const n = selSlot.id + 1;
      if (P.level !== 'mudah' && P.place[selSlot.id] != null && !P.sym[selSlot.id]) hint = `Pilih simbol untuk kotak ${n}.`;
      else if (P.place[selSlot.id] != null) hint = `Kotak ${n} terisi. Ketuk kartu lain untuk menggantinya${P.level !== 'mudah' ? ', atau ganti simbolnya' : ''}.`;
      else hint = `Ketuk kartu untuk mengisi kotak ${n}${P.level !== 'mudah' ? ', lalu pilih simbolnya' : ''}.`;
    } else hint = 'Ketuk sebuah kartu, lalu ketuk kotak tujuannya di flowchart. Di laptop, kartu juga bisa diseret.';
    pzEl.hint.innerHTML = `<b>${filled}/${pz.slots.length} terisi.</b> ${esc(hint)}`;
    // kartu
    const used = new Set(Object.values(P.place));
    const left = pz.cards.map((c, i) => ({ c, i })).filter(x => !used.has(x.i));
    pzEl.cards.innerHTML = left.length ? left.map(({ c, i }) => `<button type="button" class="pz-card" data-c="${i}" draggable="${!P.solved}" aria-pressed="${!!(P.sel && P.sel.card === i)}"${P.solved ? ' disabled' : ''}>${esc(c.text)}</button>`).join('') : '<p class="hint" style="margin:0">Semua kartu sudah dipakai. Kartu pengecoh bisa tetap tertinggal.</p>';
    $$('.pz-card', pzEl.cards).forEach(b => {
      b.addEventListener('click', () => onCard(+b.dataset.c));
      b.addEventListener('dragstart', e => { try { e.dataTransfer.setData('text/plain', b.dataset.c); e.dataTransfer.effectAllowed = 'move'; } catch (er) { /* abaikan */ } P.sel = { card: +b.dataset.c }; });
    });
    // aksi
    const canRemove = selSlot && P.place[selSlot.id] != null && !P.solved;
    let a = '';
    if (!P.solved) {
      a += `<button class="btn btn-primary" id="pz-check" type="button">Periksa</button>`;
      if (canRemove) a += `<button class="btn" id="pz-remove" type="button">Kembalikan kartu</button>`;
      if (P.tries >= 2) a += `<button class="btn" id="pz-show" type="button">Tunjukkan jawaban</button>`;
    } else {
      if (!P.helped && !pz.custom) a += `<button class="btn btn-primary" id="pz-proof-btn" type="button">Salin bukti pengerjaan</button>`;
      a += `<button class="btn" id="pz-lab" type="button">Jalankan di Lab</button>`;
      const nx = !pz.custom && Data.PUZZLES[Data.PUZZLES.indexOf(pz.def) + 1];
      if (nx) a += `<button class="btn" id="pz-next" type="button">Soal berikutnya</button>`;
    }
    a += `<button class="btn btn-quiet" id="pz-reset" type="button">Ulangi</button>`;
    pzEl.actions.innerHTML = a;
    const on = (id, f) => { const b = $('#' + id, pzEl.actions); if (b) b.addEventListener('click', f); };
    on('pz-check', checkPuzzle); on('pz-remove', () => { delete P.place[P.sel.slot]; delete P.marks[P.sel.slot]; pzSave(); paintSlots(); renderDock(); });
    on('pz-show', showAnswer); on('pz-proof-btn', copyPzProof); on('pz-lab', openPzInLab);
    on('pz-next', () => { const nx = Data.PUZZLES[Data.PUZZLES.indexOf(P.pz.def) + 1]; P.id = nx.id; store.set('fc.sel', P.id); renderSusun(true); window.scrollTo({ top: $('#pz-picker').offsetTop - 10, behavior: 'smooth' }); });
    on('pz-reset', () => { store.set(pzStateKey(), null); renderSusun(true); });
  }
  function nextOpenSlot(from) {
    const sl = P.pz.slots, n = sl.length;
    for (let k = 1; k <= n; k++) {
      const s = sl[(from + k) % n];
      if (P.place[s.id] == null || (P.level !== 'mudah' && !P.sym[s.id])) return s.id;
    }
    return null;
  }
  function putCard(slot, ci) {
    for (const k of Object.keys(P.place)) if (P.place[k] === ci) { delete P.place[k]; delete P.marks[k]; }
    P.place[slot] = ci; delete P.marks[slot];
    if (P.level !== 'mudah' && !P.sym[slot]) P.sel = { slot };
    else { const nx = nextOpenSlot(slot); P.sel = nx == null ? null : { slot: nx }; }
    pzSave(); paintSlots(); renderDock();
  }
  function onCard(ci) {
    if (P.solved) return;
    if (P.sel && P.sel.slot != null) { putCard(P.sel.slot, ci); return; }
    P.sel = P.sel && P.sel.card === ci ? null : { card: ci };
    paintSlots(); renderDock();
  }
  function onSlot(id) {
    if (P.solved) return;
    if (P.sel && P.sel.card != null) { putCard(id, P.sel.card); return; }
    P.sel = { slot: id };
    paintSlots(); renderDock();
  }
  function setSym(k) {
    if (!P.sel || P.sel.slot == null || P.solved) return;
    const id = P.sel.slot;
    P.sym[id] = k; delete P.marks[id];
    if (P.place[id] != null) { const nx = nextOpenSlot(id); P.sel = nx == null ? null : { slot: nx }; }
    pzSave(); paintSlots(); renderDock();
  }
  pzEl.canvas.addEventListener('click', e => { const g = e.target.closest && e.target.closest('.fc-slot'); if (g) onSlot(+g.dataset.slot); });
  pzEl.canvas.addEventListener('keydown', e => {
    const g = e.target.closest && e.target.closest('.fc-slot'); if (!g) return;
    if (e.key === 'Escape') { P.sel = null; paintSlots(); renderDock(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlot(+g.dataset.slot); setTimeout(() => { const ng = $(`.fc-slot[data-slot="${g.dataset.slot}"]`, pzEl.canvas); if (ng) ng.focus(); }, 0); }
  });
  pzEl.canvas.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('.fc-slot')) e.preventDefault(); });
  pzEl.canvas.addEventListener('drop', e => {
    const g = e.target.closest && e.target.closest('.fc-slot'); if (!g || P.solved) return;
    e.preventDefault();
    let ci = NaN; try { ci = parseInt(e.dataTransfer.getData('text/plain'), 10); } catch (er) { /* abaikan */ }
    if (isNaN(ci) && P.sel && P.sel.card != null) ci = P.sel.card;
    if (!isNaN(ci)) putCard(+g.dataset.slot, ci);
  });

  function checkPuzzle() {
    const pz = P.pz; P.tries++;
    const items = [], empty = []; let ok = 0;
    pz.slots.forEach(s => {
      const n = s.id + 1, ci = P.place[s.id], card = ci != null ? pz.cards[ci] : null;
      const want = symOf(s.type), got = P.level === 'mudah' ? want : (P.sym[s.id] ? symOf(P.sym[s.id]) : null);
      const textOk = !!card && card.text === s.text, symOk = got === want;
      if (textOk && symOk) { ok++; P.marks[s.id] = 'ok'; return; }
      P.marks[s.id] = 'no';
      if (!card && (P.level === 'mudah' || !got)) { empty.push(n); return; }
      if (!card) items.push(`Kotak ${n} belum diberi kartu.`);
      else if (card.decoy) items.push(`Kotak ${n}: “${card.text}” adalah kartu pengecoh. ${card.why}`);
      else if (!textOk) items.push(`Kotak ${n}: “${card.text}” belum di tempat yang tepat. Telusuri lagi urutan langkahnya.`);
      if (P.level !== 'mudah') {
        if (!got) items.push(`Kotak ${n}: simbolnya belum dipilih.`);
        else if (!symOk) items.push(`Kotak ${n}: simbol ${SYM[got].name} kurang tepat. ${SYM[want].why}`);
      }
    });
    const total = pz.slots.length;
    if (empty.length) items.unshift(empty.length === 1 ? `Kotak ${empty[0]} masih kosong.` : `Kotak ${empty.slice(0, -1).join(', ')} dan ${empty[empty.length - 1]} masih kosong.`);
    P.sel = null;
    if (ok === total) {
      P.solved = true;
      if (!pz.custom) {
        const d = pzDone(), rank = l => LEVELS.findIndex(x => x.id === l);
        const prev = d[P.id];
        if (!prev || rank(P.level) >= rank(prev.level)) d[P.id] = { level: P.level, tries: P.tries, at: Date.now() };
        store.set('fc.done', d);
      }
      pzEl.fb.hidden = false;
      pzEl.fb.innerHTML = `<p class="result-line ok">Semua ${total} kotak benar${P.tries > 1 ? ` setelah ${P.tries} kali periksa` : ' pada percobaan pertama'}.</p>` + (pz.custom ? '' : `<p class="hint">${store.get('name', '') ? 'Salin bukti pengerjaan untuk dikumpulkan.' : 'Isi nama dan kelas di tab Misi agar tercantum di bukti pengerjaan.'}</p>`);
      toast('Flowchart benar!');
      renderPicker(); renderSoal();
    } else {
      pzEl.fb.hidden = false;
      pzEl.fb.innerHTML = `<p class="result-line no">${ok} dari ${total} kotak benar.</p><ul class="checklist">${items.map(t => `<li class="no"><span class="mk">✗</span><span>${esc(t)}</span></li>`).join('')}</ul>`;
    }
    pzSave(); paintSlots(); renderDock();
  }
  function showAnswer() {
    const pz = P.pz; const used = new Set();
    P.place = {}; P.sym = {};
    pz.slots.forEach(s => {
      const ci = pz.cards.findIndex((c, i) => !used.has(i) && !c.decoy && c.text === s.text);
      used.add(ci); P.place[s.id] = ci; P.sym[s.id] = s.type; P.marks[s.id] = 'ok';
    });
    P.helped = true; P.solved = true; P.sel = null;
    pzEl.fb.hidden = false;
    pzEl.fb.innerHTML = `<p class="result-line no">Jawaban ditunjukkan.</p><p class="hint">Bandingkan dengan susunanmu tadi, lalu tekan Ulangi untuk mencoba lagi tanpa bantuan.</p>`;
    store.set(pzStateKey(), null);
    renderSoal(); paintSlots(); renderDock();
  }
  function copyPzProof() {
    const pz = P.pz, d = pzDone()[P.id] || {};
    const idx = Data.PUZZLES.indexOf(pz.def) + 1;
    const when = new Date(d.at || Date.now()).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    const lv = LEVELS.find(l => l.id === P.level).name;
    const txt = ['ALUR · Susun Flowchart · bukti pengerjaan', `Nama    : ${store.get('name', '') || '-'}`, `Kelas   : ${store.get('kelas', '') || '-'}`,
      `Soal    : F${idx} ${pz.def.title} · ${pz.def.ref}`, `Tingkat : ${lv}`, `Hasil   : BENAR SEMUA · ${pz.slots.length} kotak · diperiksa ${P.tries} kali`, `Waktu   : ${when}`].join('\n');
    copyText(txt, 'Bukti pengerjaan disalin. Tempelkan di tugas Google Classroom.', () => { pzEl.proof.hidden = false; pzEl.proof.value = txt; pzEl.proof.focus(); pzEl.proof.select(); });
  }
  function openPzInLab() {
    const pz = P.pz;
    if (pz.custom) { setView('lab'); setSub('flow'); return; }
    if (S.mission) exitMission(true);
    const prevCode = el.code.value, prevIn = el.inputs.value;
    el.inputs.value = pz.inputs; setCode(pz.code); saveCode();
    setView('lab'); setSub('flow');
    toast(`Soal “${pz.def.title}” dimuat ke Lab. Tekan Langkah untuk menelusuri flowchart-nya.`, 'Batalkan', () => { el.inputs.value = prevIn; setCode(prevCode); saveCode(); });
  }
  function pzApplyZoom() {
    $$('.chart [data-w]', pzEl.canvas).forEach(d => { const svg = d.firstElementChild; if (svg) svg.style.width = Math.round(+d.dataset.w * P.zoom) + 'px'; });
    $('#pz-z-val').textContent = Math.round(P.zoom * 100) + '%';
  }
  $('#pz-z-in').addEventListener('click', () => { P.zoom = Math.min(2, +(P.zoom + 0.1).toFixed(2)); store.set('fc.zoom', P.zoom); pzApplyZoom(); });
  $('#pz-z-out').addEventListener('click', () => { P.zoom = Math.max(0.4, +(P.zoom - 0.1).toFixed(2)); store.set('fc.zoom', P.zoom); pzApplyZoom(); });
  $('#pz-z-fit').addEventListener('click', () => {
    const ws = $$('.chart [data-w]', pzEl.canvas).map(d => +d.dataset.w); if (!ws.length) return;
    P.zoom = Math.max(0.4, Math.min(1.4, +((pzEl.canvas.clientWidth - 30) / Math.max(...ws)).toFixed(2)));
    store.set('fc.zoom', P.zoom); pzApplyZoom();
  });

  /* ═════════════ RAKIT FLOWCHART ═════════════ */
  const RK_KINDS = {
    input: { name: 'Input', sym: 'io', make: () => ({ k: 'input', a: 'n' }) },
    output: { name: 'Output', sym: 'io', make: () => ({ k: 'output', a: '"Selesai"' }) },
    proc: { name: 'Proses', sym: 'proc', make: () => ({ k: 'proc', a: 'total ← 0' }) },
    if: { name: 'Keputusan', sub: 'JIKA', sym: 'dec', make: () => ({ k: 'if', a: 'n > 0', yes: [], no: [] }) },
    while: { name: 'Ulang', sub: 'SELAMA', sym: 'dec', make: () => ({ k: 'while', a: 'i ≤ 10', body: [] }) },
    for: { name: 'Ulang', sub: 'UNTUK', sym: 'dec', make: () => ({ k: 'for', v: 'i', a: '1', b: '10', body: [] }) },
  };
  const RK_ORDER = ['input', 'output', 'proc', 'if', 'while', 'for'];
  const RK = { key: store.get('rk.key', 'bebas'), prog: [], sel: null, lineOf: {}, blockAt: {}, ctxMap: {}, pseudo: '', parsed: null, err: null, chartOk: false, undo: [], zoom: store.get('rk.zoom', 1), sub: 'run', editSnap: false, seq: 0 };
  const rkEl = { canvas: $('#rk-canvas'), err: $('#rk-err'), dock: $('#rk-dock'), code: $('#rk-code'), py: $('#rk-py'), console: $('#rk-console'), vars: $('#rk-vars'), inputs: $('#rk-inputs'), ask: $('#rk-ask'), askLabel: $('#rk-ask-label'), askInput: $('#rk-ask-input'), task: $('#rk-task'), example: $('#rk-example'), taskbox: $('#rk-taskbox') };
  const rkMissions = () => Data.MISSIONS.filter(m => !m.kind && !(m.reqs || []).some(r => ['funcs', 'procs', 'named'].includes(r.t)));
  const rkId = () => 'b' + (++RK.seq) + Math.random().toString(36).slice(2, 6);
  function rkWithIds(list) { (list || []).forEach(b => { b.id = rkId(); ['yes', 'no', 'body'].forEach(k => { if (b[k]) rkWithIds(b[k]); }); }); return list; }
  function rkLoad() { RK.prog = rkWithIds(store.get('rk.' + RK.key, null) || []); RK.sel = null; RK.undo = []; }
  function rkStrip(list) { return list.map(b => { const o = Object.assign({}, b); delete o.id; ['yes', 'no', 'body'].forEach(k => { if (o[k]) o[k] = rkStrip(o[k]); }); return o; }); }
  function rkSave() { store.set('rk.' + RK.key, rkStrip(RK.prog)); }
  function rkSnap() { RK.undo.push(JSON.stringify(rkStrip(RK.prog))); if (RK.undo.length > 40) RK.undo.shift(); $('#rk-undo').disabled = false; }
  function rkUndo() {
    const s = RK.undo.pop(); if (!s) return;
    RK.prog = rkWithIds(JSON.parse(s)); RK.sel = null; RK.editSnap = false;
    $('#rk-undo').disabled = !RK.undo.length; rkSave(); rkRender();
  }
  /* blok → pseudocode, sekaligus peta baris ↔ blok dan konteks tombol + */
  function rkGen() {
    const lines = ['MULAI'], lineOf = {}, blockAt = {}, ctxMap = { main: RK.prog };
    const L = () => lines.length + 1;
    const mark = b => { lineOf[b.id] = L(); blockAt[L()] = b; };
    const emit = (list, ind) => list.forEach(b => {
      const pad = '  '.repeat(ind);
      if (b.k === 'input') { mark(b); lines.push(pad + 'INPUT ' + b.a); }
      else if (b.k === 'output') { mark(b); lines.push(pad + 'OUTPUT ' + b.a); }
      else if (b.k === 'proc') { mark(b); lines.push(pad + b.a); }
      else if (b.k === 'while') { mark(b); ctxMap[L() + ':body'] = b.body; lines.push(pad + 'SELAMA ' + b.a); emit(b.body, ind + 1); lines.push(pad + 'AKHIR SELAMA'); }
      else if (b.k === 'for') { mark(b); ctxMap[L() + ':body'] = b.body; lines.push(`${pad}UNTUK ${b.v} DARI ${b.a} HINGGA ${b.b}`); emit(b.body, ind + 1); lines.push(pad + 'AKHIR UNTUK'); }
      else if (b.k === 'if') {
        let cur = b, head = 'JIKA ';
        for (;;) {
          mark(cur); ctxMap[L() + ':yes'] = cur.yes; ctxMap[L() + ':no'] = cur.no;
          lines.push(pad + head + cur.a + ' MAKA'); emit(cur.yes, ind + 1);
          if (cur.no.length === 1 && cur.no[0].k === 'if') { cur = cur.no[0]; head = 'JIKA LAIN JIKA '; continue; }
          break;
        }
        if (cur.no.length) { lines.push(pad + 'JIKA LAIN'); emit(cur.no, ind + 1); }
        lines.push(pad + 'AKHIR JIKA');
      }
    });
    emit(RK.prog, 1);
    lines.push('SELESAI');
    RK.lineOf = lineOf; RK.blockAt = blockAt; RK.ctxMap = ctxMap;
    RK.pseudo = lines.join('\n');
  }
  function rkFind(id, list, parent) {
    list = list || RK.prog;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.id === id) return { b, list, i };
      for (const k of ['yes', 'no', 'body']) if (b[k]) { const r = rkFind(id, b[k]); if (r) return r; }
    }
    return null;
  }
  /* pseudocode (AST) → blok, untuk contoh dan "ambil dari Lab" */
  function rkFromAst(stmts) {
    const out = [];
    for (const s of stmts) {
      if (s.k === 'comment') continue;
      if (s.k === 'assign' || s.k === 'append') out.push({ k: 'proc', a: Core.stmtText(s) });
      else if (s.k === 'input') out.push({ k: 'input', a: s.targets.map(t => Core.pp(t)).join(', ') });
      else if (s.k === 'output') out.push({ k: 'output', a: s.exprs.map(x => Core.pp(x)).join(', ') });
      else if (s.k === 'while') out.push({ k: 'while', a: Core.pp(s.cond), body: rkFromAst(s.body) });
      else if (s.k === 'for') { if (s.step) throw new Error('UNTUK dengan LANGKAH'); out.push({ k: 'for', v: s.var, a: Core.pp(s.from), b: Core.pp(s.to), body: rkFromAst(s.body) }); }
      else if (s.k === 'if') {
        const mk = i => {
          const br = s.branches[i];
          const node = { k: 'if', a: Core.pp(br.cond), yes: rkFromAst(br.body), no: [] };
          if (i + 1 < s.branches.length) node.no = [mk(i + 1)];
          else if (s.elseBody) node.no = rkFromAst(s.elseBody);
          return node;
        };
        out.push(mk(0));
      } else throw new Error(s.k === 'foreach' ? 'UNTUK SETIAP' : s.k === 'call' || s.k === 'return' ? 'FUNGSI/PROSEDUR' : s.k);
    }
    return out;
  }
  function rkImport(src) {
    const prog = Core.parse(src);
    if (Object.keys(prog.funcs).length) throw new Error('FUNGSI/PROSEDUR');
    return rkFromAst(prog.main.body);
  }
  function rkCompile() {
    rkGen();
    try { RK.parsed = Core.parse(RK.pseudo); RK.err = null; }
    catch (e) { RK.parsed = null; RK.err = e; }
  }
  function rkRender() {
    rkCompile();
    if (RK.parsed) {
      const c = Core.flowEdit(RK.parsed)[0];
      rkEl.canvas.innerHTML = `<figure class="chart" style="margin:0"><div data-w="${c.w}">${c.svg}</div></figure>`;
      rkApplyZoom();
      rkEl.err.hidden = true;
      rkEl.code.innerHTML = Core.highlight(RK.pseudo, 'pseudo');
      try { rkEl.py.innerHTML = Core.highlight(Core.toPython(RK.parsed, {}), 'py'); rkEl.py.dataset.src = Core.toPython(RK.parsed, {}); } catch (e) { rkEl.py.textContent = e.message; }
    } else {
      const b = RK.blockAt[RK.err.line];
      rkEl.err.hidden = false;
      rkEl.err.innerHTML = `<b>${b ? 'Simbol ' + esc(rkLabel(b)) : 'Catatan'}</b><span>${esc(RK.err.message)} Flowchart diperbarui setelah isinya diperbaiki.</span>`;
      rkEl.code.innerHTML = Core.highlight(RK.pseudo, 'pseudo');
    }
    rkPaintSel(); rkRenderDock(); rkResetRun(true);
    rkSave();
  }
  function rkLabel(b) { const K = RK_KINDS[b.k]; return K.sub ? `${K.name} ${K.sub}` : K.name; }
  function rkPaintSel() {
    $$('.is-picked', rkEl.canvas).forEach(n => n.classList.remove('is-picked'));
    if (!RK.sel) return;
    if (RK.sel.add) { const g = $(`.fc-add[data-add="${RK.sel.add}"]`, rkEl.canvas); if (g) g.classList.add('is-picked'); }
    else { const ln = RK.lineOf[RK.sel.id]; $$(`.fc-node[data-line="${ln}"]`, rkEl.canvas).forEach(n => n.classList.add('is-picked')); }
  }
  function rkFields(b) {
    const f = (key, label, hint, wide) => `<label class="rk-f${wide ? ' wide' : ''}"><span>${label}</span><input type="text" data-f="${key}" value="${esc(b[key])}" spellcheck="false" autocomplete="off" autocapitalize="off">${hint ? `<small>${hint}</small>` : ''}</label>`;
    if (b.k === 'input') return f('a', 'Variabel yang diisi', 'Contoh: <code>n</code> atau <code>panjang, lebar</code>', 1);
    if (b.k === 'output') return f('a', 'Yang ditampilkan', 'Contoh: <code>"Total: " + total</code>', 1);
    if (b.k === 'proc') return f('a', 'Langkah proses', 'Contoh: <code>total ← total + harga</code>. Ketik <code>&lt;-</code> untuk ←.', 1);
    if (b.k === 'if') return f('a', 'Kondisi', 'Jalur <b>Ya</b> dijalankan bila kondisi BENAR, jalur <b>Tidak</b> bila SALAH.', 1);
    if (b.k === 'while') return f('a', 'Ulangi selama', 'Isi badan pengulangan diulang selama kondisi ini BENAR.', 1);
    if (b.k === 'for') return `<div class="rk-for">${f('v', 'Variabel')}${f('a', 'Dari')}${f('b', 'Hingga')}</div><small class="hint">Variabel naik 1 setiap putaran sampai melewati batas “hingga”.</small>`;
    return '';
  }
  function rkRenderDock() {
    const d = rkEl.dock;
    if (!RK.sel) {
      d.innerHTML = `<p class="pz-hint"><b>Belum ada yang dipilih.</b> Ketuk tanda <span class="plus-ic">+</span> di flowchart untuk menambah simbol, atau ketuk simbol untuk mengubahnya.</p>`;
      return;
    }
    if (RK.sel.add) {
      d.innerHTML = `<p class="pz-hint"><b>Tambah simbol di sini.</b> Pilih jenisnya:</p><div class="rk-kinds">` +
        RK_ORDER.map(k => { const K = RK_KINDS[k]; return `<button type="button" class="pz-sym rk-kind" data-k="${k}">${sym(K.sym)}<span>${K.name}${K.sub ? `<br><code>${K.sub}</code>` : ''}</span></button>`; }).join('') +
        `</div><button type="button" class="link-btn" id="rk-cancel">Batal</button>`;
      $$('.rk-kind', d).forEach(b => b.addEventListener('click', () => rkInsert(b.dataset.k)));
      $('#rk-cancel', d).addEventListener('click', () => { RK.sel = null; rkPaintSel(); rkRenderDock(); });
      return;
    }
    const r = rkFind(RK.sel.id); if (!r) { RK.sel = null; rkRenderDock(); return; }
    const b = r.b, bad = RK.err && RK.blockAt[RK.err.line] === b;
    let h = `<div class="rk-head"><span class="md-tag">${esc(rkLabel(b))}</span><span class="rk-mini">${sym(RK_KINDS[b.k].sym)}</span></div>`;
    h += `<div class="rk-fields">${rkFields(b)}</div>`;
    h += `<div class="palette rk-ops" role="group" aria-label="Sisipkan simbol">${['←', '≠', '≤', '≥', '×', '÷'].map(o => `<button type="button" data-ins="${o}">${o}</button>`).join('')}</div>`;
    if (bad) h += `<p class="rk-bad">${esc(RK.err.message)}</p>`;
    h += `<div class="pz-actions"><button type="button" class="btn" id="rk-up"${r.i === 0 ? ' disabled' : ''}>Naik</button><button type="button" class="btn" id="rk-down"${r.i === r.list.length - 1 ? ' disabled' : ''}>Turun</button><button type="button" class="btn btn-quiet rk-del" id="rk-del">Hapus</button><button type="button" class="btn btn-quiet" id="rk-done">Selesai</button></div>`;
    if ((b.yes && (b.yes.length || b.no.length)) || (b.body && b.body.length)) h += `<p class="hint" style="margin:0">Menghapus simbol ini ikut menghapus isi cabang/pengulangannya.</p>`;
    d.innerHTML = h;
    let lastField = $('input[data-f]', d);
    $$('input[data-f]', d).forEach(inp => {
      inp.addEventListener('focus', () => { lastField = inp; if (!RK.editSnap) { rkSnap(); RK.editSnap = true; } });
      inp.addEventListener('input', () => {
        const a = inp.selectionStart;
        if (a >= 2 && inp.value.slice(a - 2, a) === '<-') inp.setRangeText('←', a - 2, a, 'end');
        b[inp.dataset.f] = inp.value;
        clearTimeout(RK.editTimer); RK.editTimer = setTimeout(rkSoftRender, 260);
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); rkSoftRender(); } });
    });
    $$('.rk-ops button', d).forEach(o => o.addEventListener('mousedown', e => e.preventDefault()));
    $$('.rk-ops button', d).forEach(o => o.addEventListener('click', () => { if (!lastField) return; lastField.setRangeText(o.dataset.ins, lastField.selectionStart, lastField.selectionEnd, 'end'); lastField.focus(); lastField.dispatchEvent(new Event('input')); }));
    $('#rk-up', d).addEventListener('click', () => rkMove(-1));
    $('#rk-down', d).addEventListener('click', () => rkMove(1));
    $('#rk-del', d).addEventListener('click', rkDelete);
    $('#rk-done', d).addEventListener('click', () => { RK.sel = null; RK.editSnap = false; rkRender(); });
  }
  /* perbarui flowchart tanpa membangun ulang panel isian (fokus tetap di kotak isian) */
  function rkSoftRender() {
    const d = rkEl.dock, active = document.activeElement, key = active && active.dataset ? active.dataset.f : null, pos = active && active.selectionStart;
    rkCompile();
    if (RK.parsed) {
      const c = Core.flowEdit(RK.parsed)[0];
      rkEl.canvas.innerHTML = `<figure class="chart" style="margin:0"><div data-w="${c.w}">${c.svg}</div></figure>`;
      rkApplyZoom(); rkEl.err.hidden = true;
      try { const py = Core.toPython(RK.parsed, {}); rkEl.py.innerHTML = Core.highlight(py, 'py'); rkEl.py.dataset.src = py; } catch (e) { /* abaikan */ }
    } else {
      const bb = RK.blockAt[RK.err.line];
      rkEl.err.hidden = false;
      rkEl.err.innerHTML = `<b>${bb ? 'Simbol ' + esc(rkLabel(bb)) : 'Catatan'}</b><span>${esc(RK.err.message)} Flowchart diperbarui setelah isinya diperbaiki.</span>`;
    }
    rkEl.code.innerHTML = Core.highlight(RK.pseudo, 'pseudo');
    rkPaintSel(); rkResetRun(true); rkSave();
    const r = RK.sel && !RK.sel.add && rkFind(RK.sel.id);
    const bad = $('.rk-bad', d), isBad = r && RK.err && RK.blockAt[RK.err.line] === r.b;
    if (isBad) { if (bad) bad.textContent = RK.err.message; else { const p = document.createElement('p'); p.className = 'rk-bad'; p.textContent = RK.err.message; $('.rk-ops', d).after(p); } }
    else if (bad) bad.remove();
    if (key) { const inp = $(`input[data-f="${key}"]`, d); if (inp && document.activeElement !== inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ } } }
  }
  function rkInsert(kind) {
    const [ctx, idx] = RK.sel.add.split('@');
    const list = RK.ctxMap[ctx]; if (!list) return;
    rkSnap();
    const b = RK_KINDS[kind].make(); b.id = rkId();
    list.splice(+idx, 0, b);
    RK.sel = { id: b.id }; RK.editSnap = true;
    rkRender();
    const inp = $('input[data-f]', rkEl.dock); if (inp) { inp.focus({ preventScroll: true }); inp.select(); }
    const node = $('.fc-node.is-picked', rkEl.canvas);
    if (node && node.scrollIntoView) setTimeout(() => node.scrollIntoView({ block: 'center', inline: 'nearest' }), 30);
  }
  function rkMove(dir) {
    const r = rkFind(RK.sel.id); if (!r) return;
    const j = r.i + dir; if (j < 0 || j >= r.list.length) return;
    rkSnap(); [r.list[r.i], r.list[j]] = [r.list[j], r.list[r.i]]; RK.editSnap = false; rkRender();
  }
  function rkDelete() {
    const r = rkFind(RK.sel.id); if (!r) return;
    rkSnap(); r.list.splice(r.i, 1); RK.sel = null; RK.editSnap = false; rkRender();
    toast('Simbol dihapus.', 'Urungkan', rkUndo);
  }
  rkEl.canvas.addEventListener('click', e => {
    if (!e.target.closest) return;
    const add = e.target.closest('.fc-add'), node = e.target.closest('.fc-node');
    if (add) { RK.sel = { add: add.dataset.add }; RK.editSnap = false; rkPaintSel(); rkRenderDock(); const f = $('.rk-kind', rkEl.dock); if (f && matchMedia('(min-width: 1081px)').matches) f.focus(); return; }
    if (node) {
      const b = RK.blockAt[+node.dataset.line];
      if (!b) { toast('MULAI dan SELESAI sudah tersedia dan tidak perlu diubah.'); return; }
      RK.sel = { id: b.id }; RK.editSnap = false; rkPaintSel(); rkRenderDock();
    }
  });
  rkEl.canvas.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.fc-add')) { e.preventDefault(); e.target.closest('.fc-add').dispatchEvent(new MouseEvent('click', { bubbles: true })); const f = $('.rk-kind', rkEl.dock); if (f) f.focus(); }
  });

  /* menjalankan flowchart */
  const RR = { rt: null, gen: null, mode: 'idle', send: undefined, timer: null, line: null };
  function rkResetRun(silent) {
    clearTimeout(RR.timer); RR.rt = null; RR.gen = null; RR.mode = 'idle'; RR.line = null; rkEl.ask.hidden = true;
    $$('.fc-node.is-active, .fc-node.is-err', rkEl.canvas).forEach(n => n.classList.remove('is-active', 'is-err'));
    $('#rk-run').lastChild.textContent = 'Jalankan';
    if (!silent) rkEl.console.innerHTML = '';
    rkVars();
  }
  function rkLog(cls, t) { const d = document.createElement('div'); d.className = 'o ' + cls; d.textContent = t; rkEl.console.appendChild(d); rkEl.console.scrollTop = rkEl.console.scrollHeight; }
  function rkPrepare() {
    rkCompile();
    if (!RK.parsed) { rkEl.console.innerHTML = ''; rkLog('o-err', 'Flowchart belum bisa dijalankan: ' + RK.err.message); return false; }
    if (!RK.prog.length) { rkEl.console.innerHTML = ''; rkLog('o-info', 'Flowchart masih kosong. Tambahkan simbol dengan tanda + dulu.'); return false; }
    rkResetRun(false);
    const ins = rkEl.inputs.value.trim() ? rkEl.inputs.value.split(/[\n,;]/).map(s => s.trim()).filter(Boolean) : [];
    RR.rt = Core.createRun(RK.parsed, { inputs: ins, onOut: o => rkLog(o.kind === 'in' ? 'o-in' : 'o-out', o.text), maxSteps: 100000 });
    RR.gen = RR.rt.gen; RR.mode = 'ready';
    return true;
  }
  function rkPump(stop) {
    for (;;) {
      let r;
      try { r = RR.gen.next(RR.send); RR.send = undefined; }
      catch (err) {
        RR.mode = 'error'; clearTimeout(RR.timer);
        rkLog('o-err', (err.line ? `Galat di simbol ${RK.blockAt[err.line] ? rkLabel(RK.blockAt[err.line]) : ''}: ` : '') + err.message);
        $$('.fc-node.is-active', rkEl.canvas).forEach(n => n.classList.remove('is-active'));
        if (err.line) $$(`.fc-node[data-line="${err.line}"]`, rkEl.canvas).forEach(n => n.classList.add('is-err'));
        $('#rk-run').lastChild.textContent = 'Jalankan';
        return 'error';
      }
      if (r.done) {
        RR.mode = 'done'; clearTimeout(RR.timer); RR.line = null;
        rkLog('o-ok', `Selesai dalam ${RR.rt.steps.toLocaleString('id-ID')} langkah.`);
        $$('.fc-node.is-active', rkEl.canvas).forEach(n => n.classList.remove('is-active'));
        $('#rk-run').lastChild.textContent = 'Jalankan'; rkVars();
        return 'done';
      }
      const e = r.value;
      if (e.ev === 'step') { RR.line = e.line; if (stop) return 'step'; }
      else if (e.ev === 'input') {
        rkEl.ask.hidden = false; rkEl.askLabel.textContent = 'INPUT ' + e.name; rkEl.askInput.value = '';
        RR.resume = RR.mode; RR.mode = 'input'; clearTimeout(RR.timer); rkShowLine(); rkVars();
        setTimeout(() => rkEl.askInput.focus(), 30);
        return 'input';
      }
    }
  }
  function rkShowLine() {
    $$('.fc-node.is-active', rkEl.canvas).forEach(n => n.classList.remove('is-active'));
    if (!RR.line) return;
    const ns = $$(`.fc-node[data-line="${RR.line}"]`, rkEl.canvas);
    ns.forEach(n => n.classList.add('is-active'));
    if (ns.length) {
      const box = rkEl.canvas.getBoundingClientRect(), r = ns[ns.length > 1 ? 1 : 0].getBoundingClientRect();
      if (r.top < box.top + 20 || r.bottom > box.bottom - 20) rkEl.canvas.scrollTop += (r.top - box.top) - box.height / 3;
    }
  }
  function rkVars() {
    if (!RR.rt || !RR.rt.frames[0].vars.size) { rkEl.vars.innerHTML = '<p class="hint" style="margin:0">Nilai variabel muncul di sini saat flowchart dijalankan.</p>'; return; }
    let h = '<div class="frame"><div class="frame-h"><span>Variabel</span></div>';
    RR.rt.frames[0].vars.forEach((v, k) => { h += `<div class="vrow"><span class="vname">${esc(k)}<span class="vtype">${typeLabel(v)}</span></span><span class="vval">${valueHtml(v)}</span></div>`; });
    rkEl.vars.innerHTML = h + '</div>';
  }
  function rkTick() {
    if (RR.mode !== 'running') return;
    const ms = +$('#rk-speed').value;
    const res = rkPump(ms !== 0);
    if (res === 'step') { rkShowLine(); rkVars(); RR.timer = setTimeout(rkTick, ms); }
  }
  $('#rk-run').addEventListener('click', () => {
    if (RR.mode === 'running') return;
    if (RR.mode === 'input') { rkEl.askInput.focus(); return; }
    if (RR.mode !== 'paused' && RR.mode !== 'ready') { if (!rkPrepare()) return; }
    RR.mode = 'running'; $('#rk-run').lastChild.textContent = 'Jalankan'; rkTick();
  });
  $('#rk-step').addEventListener('click', () => {
    if (RR.mode === 'input') { rkEl.askInput.focus(); return; }
    if (RR.mode === 'running') { clearTimeout(RR.timer); RR.mode = 'paused'; $('#rk-run').lastChild.textContent = 'Lanjutkan'; return; }
    if (RR.mode !== 'paused' && RR.mode !== 'ready') { if (!rkPrepare()) return; }
    RR.mode = 'paused'; $('#rk-run').lastChild.textContent = 'Lanjutkan';
    if (rkPump(true) === 'step') { rkShowLine(); rkVars(); }
  });
  $('#rk-reset').addEventListener('click', () => rkResetRun(false));
  rkEl.ask.addEventListener('submit', e => {
    e.preventDefault(); if (RR.mode !== 'input') return;
    const v = rkEl.askInput.value; if (!v.trim()) return;
    rkEl.ask.hidden = true; RR.send = v; RR.mode = RR.resume === 'running' ? 'running' : 'paused';
    if (RR.mode === 'running') rkTick(); else if (rkPump(true) === 'step') { rkShowLine(); rkVars(); }
  });
  function rkSetSub(n) {
    RK.sub = n;
    $$('[data-rk]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.rk === n)));
    ['run', 'code', 'py'].forEach(k => { $('#rk-p-' + k).hidden = k !== n; });
  }
  $$('[data-rk]').forEach(b => b.addEventListener('click', () => rkSetSub(b.dataset.rk)));
  $('#rk-copy-code').addEventListener('click', () => copyText(RK.pseudo, 'Pseudocode disalin.'));
  $('#rk-copy-py').addEventListener('click', () => copyText(rkEl.py.dataset.src || '', 'Kode Python disalin.'));
  $('#rk-to-lab').addEventListener('click', () => {
    if (S.mission) exitMission(true);
    const prevCode = el.code.value, prevIn = el.inputs.value;
    el.inputs.value = rkEl.inputs.value; setCode(RK.pseudo); saveCode(); setView('lab');
    toast('Pseudocode dari flowchart dimuat ke Lab.', 'Batalkan', () => { el.inputs.value = prevIn; setCode(prevCode); saveCode(); });
  });
  $('#rk-undo').addEventListener('click', rkUndo);
  $('#rk-clear').addEventListener('click', () => { if (!RK.prog.length) return; rkSnap(); RK.prog = []; RK.sel = null; rkRender(); toast('Flowchart dikosongkan.', 'Urungkan', rkUndo); });
  document.addEventListener('keydown', e => {
    if (S.view !== 'rakit' || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    e.preventDefault(); rkUndo();
  });
  function rkApplyZoom() {
    $$('.chart [data-w]', rkEl.canvas).forEach(d => { const svg = d.firstElementChild; if (svg) svg.style.width = Math.round(+d.dataset.w * RK.zoom) + 'px'; });
    $('#rk-z-val').textContent = Math.round(RK.zoom * 100) + '%';
  }
  $('#rk-z-in').addEventListener('click', () => { RK.zoom = Math.min(2, +(RK.zoom + 0.1).toFixed(2)); store.set('rk.zoom', RK.zoom); rkApplyZoom(); });
  $('#rk-z-out').addEventListener('click', () => { RK.zoom = Math.max(0.4, +(RK.zoom - 0.1).toFixed(2)); store.set('rk.zoom', RK.zoom); rkApplyZoom(); });
  $('#rk-z-fit').addEventListener('click', () => {
    const ws = $$('.chart [data-w]', rkEl.canvas).map(d => +d.dataset.w); if (!ws.length) return;
    RK.zoom = Math.max(0.4, Math.min(1.4, +((rkEl.canvas.clientWidth - 30) / Math.max(...ws)).toFixed(2))); store.set('rk.zoom', RK.zoom); rkApplyZoom();
  });

  /* tantangan (misi yang bisa diselesaikan dengan flowchart) dan contoh */
  function rkFillSelects() {
    const ms = rkMissions();
    rkEl.task.innerHTML = '<option value="bebas">Bebas (tanpa misi)</option>' + ms.map(m => `<option value="${m.id}">M${Data.MISSIONS.indexOf(m) + 1} · ${esc(m.title)}</option>`).join('');
    if (RK.key !== 'bebas' && !ms.some(m => m.id === RK.key)) RK.key = 'bebas';
    rkEl.task.value = RK.key;
    let h = '<option value="">Pilih…</option><option value="__lab">Ambil dari kode di tab Lab</option>';
    Data.EXAMPLES.forEach(ex => { try { rkImport(ex.code); h += `<option value="${ex.id}">${esc(ex.title)}</option>`; } catch (e) { /* contoh memakai FUNGSI, lewati */ } });
    rkEl.example.innerHTML = h;
  }
  rkEl.task.addEventListener('change', () => { RK.key = rkEl.task.value; store.set('rk.key', RK.key); rkLoad(); rkTaskBox(); rkRender(); });
  rkEl.example.addEventListener('change', () => {
    const v = rkEl.example.value; rkEl.example.value = '';
    if (!v) return;
    let src, inputs = '';
    if (v === '__lab') { src = el.code.value; inputs = el.inputs.value; }
    else { const ex = Data.EXAMPLES.find(e => e.id === v); src = ex.code; inputs = ex.inputs; }
    let blocks;
    try { blocks = rkImport(src); }
    catch (e) { toast(e instanceof Core.LabError ? `Kode di tab Lab belum bisa dibaca (baris ${e.line}).` : `Belum bisa dirakit di sini karena memakai ${e.message}.`); return; }
    rkSnap(); RK.prog = rkWithIds(blocks); RK.sel = null; rkEl.inputs.value = inputs; rkRender();
    toast('Contoh dimuat ke flowchart.', 'Urungkan', rkUndo);
  });
  function rkTaskBox() {
    const m = Data.MISSIONS.find(x => x.id === RK.key), box = rkEl.taskbox;
    if (!m) { box.hidden = true; box.innerHTML = ''; return; }
    const idx = Data.MISSIONS.indexOf(m) + 1, isDone = (done()[m.id] || {}).state === 'done';
    box.hidden = false;
    box.innerHTML = `<div class="rk-task-main"><div class="md-tag">M${idx} · ${esc(m.lkpd)} · ${esc(m.tp)}${isDone ? ' · Lulus' : ''}</div><p><strong>${esc(m.title)}.</strong> ${esc(m.task)}</p><details class="hintbox"><summary>Lihat petunjuk</summary><p>${esc(m.hint)}</p></details></div><div class="rk-task-act"><button class="btn btn-primary" id="rk-test" type="button">Uji otomatis</button></div><div class="ms-results" id="rk-results" hidden></div>`;
    $('#rk-test', box).addEventListener('click', () => rkTest(m));
  }
  function rkTest(m) {
    rkCompile();
    const box = $('#rk-results'); box.hidden = false;
    if (!RK.parsed) { box.innerHTML = `<div class="ms-summary no">Flowchart belum lengkap: ${esc(RK.err.message)}</div>`; return; }
    const r = Check.checkMission(m, RK.pseudo);
    const nOk = r.tests.filter(t => t.ok).length, rOk = r.reqs.filter(t => t.ok).length;
    let h = `<div class="ms-summary ${r.passed ? 'ok' : 'no'}">${r.passed ? `Lulus! Semua syarat terpenuhi dan ${r.tests.length} data uji benar.` : `Belum lulus: syarat ${rOk}/${r.reqs.length}, data uji ${nOk}/${r.tests.length}.`}</div>`;
    h += `<div><p class="col-title">Syarat</p><ul class="checklist">${r.reqs.map(x => `<li class="${x.ok ? 'ok' : 'no'}"><span class="mk">${x.ok ? '✓' : '✗'}</span><span>${esc(x.label)}</span></li>`).join('')}</ul></div>`;
    h += `<div><p class="col-title">Data uji</p><ul class="checklist">${r.tests.map(x => `<li class="${x.ok ? 'ok' : 'no'}"><span class="mk">${x.ok ? '✓' : '✗'}</span><span>${esc(x.label)}${x.detail ? `<span class="det">${esc(x.detail)}</span>` : ''}</span></li>`).join('')}</ul></div>`;
    if (r.passed) h += `<div style="grid-column:1/-1"><button class="btn" type="button" id="rk-proof">Salin bukti pengerjaan</button></div>`;
    box.innerHTML = h;
    if (r.passed) {
      S.missionResults[m.id] = r; store.set('code.' + m.id, RK.pseudo); setMissionState(m.id, 'done');
      $('#rk-proof', box).addEventListener('click', () => copyProof(m));
      toast('Misi lulus lewat flowchart!');
    }
  }
  function renderRakit() {
    if (!RK.ready) { rkFillSelects(); rkLoad(); RK.ready = true; }
    rkTaskBox(); rkRender();
  }

  /* ═════════════ misc ═════════════ */
  let toastTimer = null;
  function toast(msg, actLabel, act) {
    el.toast.innerHTML = `<span>${esc(msg)}</span>` + (actLabel ? `<button type="button">${esc(actLabel)}</button>` : '');
    el.toast.hidden = false;
    if (actLabel) $('button', el.toast).addEventListener('click', () => { el.toast.hidden = true; act(); });
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.toast.hidden = true; }, actLabel ? 7000 : 3500);
  }
  function copyText(txt, okMsg, fallback) {
    const fb = () => { if (fallback) fallback(); toast('Salin otomatis tidak tersedia. Teks sudah ditandai, tekan Ctrl + C.'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast(okMsg), fb);
      else fb();
    } catch (e) { fb(); }
  }
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  }
  $('#theme-btn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nt = cur === 'dark' ? 'light' : 'dark'; applyTheme(nt); store.set('theme', nt);
  });
  document.addEventListener('keydown', e => {
    if (S.view !== 'lab' || e.target === el.code) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) doStep(); else doRun(); }
  });

  /* ═════════════ BOOT ═════════════ */
  applyTheme(store.get('theme', null));
  fillExamples();
  el.speed.value = store.get('speed', '2');
  const firstVisit = store.get('code.free', null) === null;
  const def = Data.EXAMPLES.find(e => e.id === 'rata');
  el.inputs.value = store.get('inputs.free', def.inputs);
  el.code.value = store.get('code.free', def.code);
  renderEditor();
  compile();
  setSub(store.get('sub', 'vars'));
  updateCount();
  updateSusunCount();
  setView('lab');
  if (S.prog) {
    // jalankan sekali secara instan agar panel langsung terisi
    const sp = el.speed.value; el.speed.value = '3';
    doRun();
    el.speed.value = sp;
    if (S.mode !== 'input' && firstVisit) logInfo('Ini contoh dari modul. Tekan Langkah untuk menelusuri baris demi baris, atau pilih contoh lain.');
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/claude|anthropic/.test(location.hostname)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
