/* ALUR (Lab Maya Pseudocode) — pemeriksa misi (uji otomatis) */
(function (root) {
  'use strict';
  const Core = root.LabCore || (typeof require !== 'undefined' ? require('./core.js') : null);

  const REQ_LABEL = {
    mulai: () => 'Program diawali MULAI dan diakhiri SELESAI',
    input: () => 'Memakai INPUT',
    minStmts: r => `Minimal ${r.n} langkah di program utama`,
    if: () => 'Memakai seleksi JIKA',
    elif: () => 'Memakai seleksi bertingkat JIKA LAIN JIKA',
    loop: () => 'Memakai pengulangan (SELAMA atau UNTUK)',
    for: () => 'Memakai pengulangan UNTUK',
    while: () => 'Memakai pengulangan SELAMA',
    funcs: r => `Minimal ${r.n} FUNGSI`,
    procs: r => `Minimal ${r.n} PROSEDUR`,
    subs: r => `Minimal ${r.n} subprogram (FUNGSI/PROSEDUR)`,
    named: r => `Ada ${r.kind} ${r.name}(…)`,
  };
  function reqOk(r, st) {
    switch (r.t) {
      case 'mulai': return st.hasMulai;
      case 'input': return st.input > 0;
      case 'minStmts': return st.mainStmts >= r.n;
      case 'if': return st.if > 0;
      case 'elif': return st.elif > 0;
      case 'loop': return st.loops > 0;
      case 'for': return st.for > 0;
      case 'while': return st.while > 0;
      case 'funcs': return st.funcs >= r.n;
      case 'procs': return st.procs >= r.n;
      case 'subs': return st.funcs + st.procs >= r.n;
      case 'named': return !!(st.names[r.name] && st.names[r.name].kind === r.kind);
    }
    return false;
  }
  function tokenRe(tok) {
    const e = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (/^-?\d+(\.\d+)?$/.test(tok)) return new RegExp('(?<![\\d.])' + e + '(?![\\d]|\\.\\d)');
    if (/^[A-Z]$/.test(tok)) return new RegExp('(?<![A-Za-z0-9])' + e + '(?![A-Za-z0-9])');
    return new RegExp(e, 'i');
  }
  function findOrdered(text, tokens) {
    let pos = 0;
    for (const t of tokens) {
      const re = tokenRe(t);
      const m = re.exec(text.slice(pos));
      if (!m) return { ok: false, missing: t };
      pos += m.index + m[0].length;
    }
    return { ok: true };
  }
  const outText = out => out.filter(o => o.kind === 'out').map(o => o.text).join('\n');
  const short = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  function runTest(prog, t) {
    if (t.call) {
      const label = t.note || `${t.call}(${t.args.map(a => Core.fmt(a, true)).join(', ')})`;
      const r = Core.callHeadless(prog, t.call, t.args);
      if (!r.ok) return { label, ok: false, detail: r.error.message };
      const v = r.value;
      if (t.startsWith) {
        const ok = typeof v === 'string' && v.trim().toUpperCase().startsWith(t.startsWith);
        return { label: `${label} → "${t.startsWith}…"`, ok, detail: ok ? '' : `Hasilnya ${Core.fmt(v, true)}` };
      }
      const ok = Core.deepEq(Array.isArray(v) ? Array.from(v) : v, t.equals);
      return { label: t.note ? label : `${label} → ${Core.fmt(t.equals, true)}`, ok, detail: ok ? '' : `Hasilnya ${Core.fmt(v, true)}` };
    }
    const label = (t.inputs && t.inputs.length ? `Data: ${t.inputs.join(', ')}` : 'Tanpa data masukan') + (t.note ? ` · ${t.note}` : '');
    const r = Core.runHeadless(prog, t.inputs || []);
    if (!r.ok) return { label, ok: false, detail: `Galat baris ${r.error.line}: ${r.error.message}` };
    const text = outText(r.out);
    if (t.lines) {
      const lines = r.out.filter(o => o.kind === 'out').map(o => o.text.trim().toLowerCase());
      for (let i = 0; i < t.lines.length; i++) {
        if (lines[i] !== t.lines[i].toLowerCase()) return { label, ok: false, detail: `Baris ke-${i + 1} seharusnya "${t.lines[i]}", tetapi "${lines[i] === undefined ? '(kosong)' : r.out.filter(o => o.kind === 'out')[i].text}".` };
      }
      if (t.count && lines.length !== t.count) return { label, ok: false, detail: `Seharusnya ada ${t.count} baris output, tetapi ada ${lines.length}.` };
      return { label, ok: true, detail: '' };
    }
    if (t.all) { const f = findOrdered(text, t.all); if (!f.ok) return { label, ok: false, detail: `Output belum memuat "${f.missing}" pada urutan yang tepat. Output: ${short(text.replace(/\n/g, ' | ') || '(kosong)', 120)}` }; }
    if (t.any && !t.any.some(x => tokenRe(x).test(text))) return { label, ok: false, detail: `Output seharusnya memuat salah satu dari: ${t.any.join(', ')}. Output: ${short(text.replace(/\n/g, ' | ') || '(kosong)', 120)}` };
    if (t.none) { const bad = t.none.find(x => tokenRe(x).test(text)); if (bad) return { label, ok: false, detail: `Output tidak boleh memuat "${bad}" untuk data ini. Output: ${short(text.replace(/\n/g, ' | '), 120)}` }; }
    return { label, ok: true, detail: '' };
  }

  function checkMission(m, src, scenario) {
    let prog;
    try { prog = Core.parse(src); }
    catch (e) { return { parseError: e, reqs: [], tests: [], passed: false }; }
    const st = Core.stats(prog);
    let reqs = m.reqs || [];
    let tests = m.tests || [];
    if (m.kind === 'project') {
      const sc = scenario || m.scenarios[0];
      reqs = [{ t: 'mulai' }, { t: 'subs', n: sc.min }, { t: 'if' }, { t: 'loop' }];
      tests = [];
    }
    const rr = reqs.map(r => ({ label: REQ_LABEL[r.t](r), ok: reqOk(r, st) }));
    const tr = tests.map(t => runTest(prog, t));
    const passed = rr.every(x => x.ok) && tr.every(x => x.ok);
    return { reqs: rr, tests: tr, passed };
  }

  const API = { checkMission, findOrdered };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LabCheck = API;
})(typeof window !== 'undefined' ? window : globalThis);
