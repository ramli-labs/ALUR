/* ALUR (Lab Maya Pseudocode) — core engine
 * Lexer, parser (konvensi pseudocode berbahasa Indonesia), interpreter langkah demi langkah,
 * pencetak pseudocode, penerjemah Python, dan pembuat flowchart SVG.
 */
(function (root) {
  'use strict';

  const KEYWORDS = new Set(['MULAI', 'SELESAI', 'INPUT', 'OUTPUT', 'JIKA', 'MAKA', 'LAIN', 'AKHIR', 'SELAMA', 'UNTUK', 'DARI', 'HINGGA', 'LANGKAH',
    'SETIAP', 'DALAM', 'FUNGSI', 'PROSEDUR', 'KEMBALIKAN', 'DAN', 'ATAU', 'BUKAN', 'BENAR', 'SALAH', 'MOD', 'DIV', 'TAMBAH', 'KE', 'ARRAY']);
  const STMT_KW = ['MULAI', 'SELESAI', 'INPUT', 'OUTPUT', 'JIKA', 'SELAMA', 'UNTUK', 'FUNGSI', 'PROSEDUR', 'KEMBALIKAN', 'TAMBAH', 'AKHIR'];
  const BUILTINS = ['PANJANG', 'AKAR', 'BULATKAN', 'ACAK', 'TEKS', 'ANGKA', 'POTONG', 'MUTLAK'];
  const NONE = Symbol('tidak-ada');

  class LabError extends Error {
    constructor(line, msg, kind) { super(msg); this.line = line; this.kind = kind || 'sintaks'; }
  }

  /* ───────────────────────── LEXER ───────────────────────── */
  function normalize(src) {
    return String(src).replace(/\r\n?/g, '\n').replace(/[“”„]/g, '"').replace(/[‘’]/g, "'")
      .replace(/\t/g, '  ').replace(/ /g, ' ');
  }
  function lex(src) {
    src = normalize(src);
    const toks = []; let i = 0, line = 1;
    const push = (t, v) => toks.push({ t, v, line });
    const OPS2 = { '<-': '←', '<=': '≤', '>=': '≥', '!=': '≠', '<>': '≠', '==': '==', '**': '**', '//': '//' };
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { push('NL'); i++; line++; continue; }
      if (c === ' ' || c === '\f' || c === '\v') { i++; continue; }
      if (c === '#') { let j = src.indexOf('\n', i); if (j < 0) j = src.length; push('COMMENT', src.slice(i + 1, j).trim()); i = j; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1; while (j < src.length && src[j] !== c && src[j] !== '\n') j++;
        if (src[j] !== c) throw new LabError(line, `Teks belum ditutup. Tambahkan tanda kutip ${c} di akhir teks.`);
        push('STR', src.slice(i + 1, j)); i = j + 1; continue;
      }
      const rest = src.slice(i, i + 96);
      let m = /^\d+(\.\d+)?/.exec(rest);
      if (m) { push('NUM', parseFloat(m[0])); i += m[0].length; continue; }
      m = /^[A-Za-z_À-ÖØ-öø-ɏ][A-Za-z0-9_À-ÖØ-öø-ɏ]*/.exec(rest);
      if (m) { const w = m[0]; push(KEYWORDS.has(w) ? 'KW' : 'ID', w); i += w.length; continue; }
      const two = src.slice(i, i + 2);
      if (OPS2[two]) { push('OP', OPS2[two]); i += 2; continue; }
      if ('←≤≥≠×÷+-*/%^=<>()[],:'.includes(c)) { push('OP', c === '^' ? '**' : c); i++; continue; }
      if (c === '→') throw new LabError(line, 'Tanda → hanya boleh dipakai di dalam teks bertanda kutip. Untuk menyimpan nilai gunakan ←.');
      throw new LabError(line, `Karakter "${c}" tidak dikenali di sini.`);
    }
    push('NL'); push('EOF');
    return toks;
  }

  /* ───────────────────────── PARSER ───────────────────────── */
  function parse(src) {
    const toks = lex(src);
    let p = 0;
    const peek = (k = 0) => toks[Math.min(p + k, toks.length - 1)];
    const next = () => toks[p++];
    const is = (t, v, k = 0) => { const x = peek(k); return x.t === t && (v === undefined || x.v === v); };
    const isKW = (v, k = 0) => is('KW', v, k);
    const isOP = (v, k = 0) => is('OP', v, k);
    const accept = (t, v) => (is(t, v) ? next() : null);
    const expect = (t, v, msg) => { if (is(t, v)) return next(); const x = peek(); throw new LabError(x.line, msg || `Seharusnya ada ${v || t} di sini, tetapi ditemukan ${describe(x)}.`); };
    const skipNL = () => { while (is('NL')) p++; };
    const describe = (x) => x.t === 'NL' ? 'akhir baris' : x.t === 'EOF' ? 'akhir program' : x.t === 'STR' ? `"${x.v}"` : x.t === 'COMMENT' ? 'komentar' : String(x.v);
    const closerAhead = () => isKW('AKHIR') || isKW('SELESAI');
    const noColon = () => { if (isOP(':')) throw new LabError(peek().line, 'Tanda titik dua (:) tidak dipakai di pseudocode. Itu aturan Python.'); };
    const endOfStmt = () => is('NL') || is('EOF') || is('COMMENT');

    function parseBlock(stop, opener, openLine, closer) {
      const body = [];
      for (;;) {
        skipNL();
        if (is('EOF')) {
          if (!opener) return body;
          throw new LabError(openLine, `${opener} di baris ${openLine} belum ditutup dengan ${closer}.`);
        }
        if (stop()) return body;
        body.push(parseStmt());
      }
    }
    function expectCloser(name, opener, openLine) {
      if (isKW('AKHIR') && isKW(name, 1)) { const e = next(); next(); return e.line; }
      const x = peek();
      if (isKW('AKHIR')) throw new LabError(x.line, `${opener} di baris ${openLine} harus ditutup AKHIR ${name}, tetapi yang ditulis AKHIR ${describe(peek(1))}.`);
      if (isKW('SELESAI')) throw new LabError(openLine, `${opener} di baris ${openLine} belum ditutup. Tambahkan AKHIR ${name} sebelum SELESAI.`);
      throw new LabError(x.line, `${opener} di baris ${openLine} belum ditutup dengan AKHIR ${name}.`);
    }

    function parseStmt() {
      const x = peek(); const line = x.line; let s;
      if (x.t === 'COMMENT') { next(); return { k: 'comment', text: x.v, line }; }
      if (x.t === 'KW') {
        switch (x.v) {
          case 'INPUT': next(); s = { k: 'input', targets: parseTargets('INPUT'), line }; break;
          case 'OUTPUT': next(); if (endOfStmt()) throw new LabError(line, 'OUTPUT perlu diikuti nilai yang ditampilkan, misalnya OUTPUT "Halo".'); s = { k: 'output', exprs: parseExprList(), line }; break;
          case 'JIKA': s = parseIf(); break;
          case 'SELAMA': s = parseWhile(); break;
          case 'UNTUK': s = parseFor(); break;
          case 'KEMBALIKAN': next(); s = { k: 'return', exprs: (endOfStmt() || isKW('AKHIR') || isKW('JIKA')) ? [] : parseExprList(), line }; break;
          case 'TAMBAH': {
            next(); const e = parseExpr();
            expect('KW', 'KE', 'Format penambahan: TAMBAH nilai KE nama_array');
            s = { k: 'append', expr: e, target: parseLValue(), line }; break;
          }
          case 'AKHIR': throw new LabError(line, `AKHIR ${describe(peek(1))} tidak punya pasangan pembuka.`);
          case 'MULAI': throw new LabError(line, 'MULAI tidak boleh berada di dalam blok lain.');
          case 'SELESAI': throw new LabError(line, 'SELESAI muncul sebelum semua blok ditutup.');
          case 'FUNGSI': case 'PROSEDUR': throw new LabError(line, `${x.v} ditulis di luar MULAI … SELESAI, tidak di dalam blok lain.`);
          case 'MAKA': throw new LabError(line, 'MAKA hanya dipakai setelah kondisi JIKA.');
          case 'LAIN': throw new LabError(line, 'LAIN hanya dipakai dalam JIKA LAIN.');
          default: throw new LabError(line, `Kata ${x.v} tidak bisa mengawali langkah.`);
        }
      } else if (x.t === 'ID') {
        const up = x.v.toUpperCase();
        if (STMT_KW.includes(up) && !isOP('←', 1) && !isOP(',', 1) && !isOP('[', 1) && !isOP('(', 1))
          throw new LabError(line, `Kata kunci ditulis dengan huruf KAPITAL: tulis ${up}, bukan ${x.v}.`);
        s = parseAssignOrCall();
      } else if (x.t === 'OP' && x.v === ':') {
        throw new LabError(line, 'Tanda titik dua (:) tidak dipakai di pseudocode. Itu aturan Python.');
      } else {
        throw new LabError(line, `Langkah tidak boleh diawali ${describe(x)}.`);
      }
      if (is('COMMENT')) s.comment = next().v;
      noColon();
      return s;
    }

    function parseTargets(kw) {
      if (endOfStmt()) throw new LabError(peek().line, `${kw} perlu diikuti nama variabel, misalnya ${kw} nilai.`);
      const t = [parseLValue()];
      while (accept('OP', ',')) t.push(parseLValue());
      return t;
    }
    function parseLValue() {
      const x = peek();
      if (x.t !== 'ID') throw new LabError(x.line, `Seharusnya ada nama variabel di sini, tetapi ditemukan ${describe(x)}.`);
      next();
      let e = { k: 'var', name: x.v, line: x.line };
      while (isOP('[')) { next(); const idx = parseExpr(); expect('OP', ']', 'Kurung siku [ belum ditutup dengan ].'); e = { k: 'index', base: e, index: idx, line: x.line }; }
      return e;
    }
    function parseAssignOrCall() {
      const start = p; const line = peek().line;
      let targets = null;
      try {
        targets = [parseLValue()];
        while (accept('OP', ',')) targets.push(parseLValue());
      } catch (e) { targets = null; }
      if (targets && isOP('←')) {
        next();
        if (endOfStmt()) throw new LabError(line, 'Setelah tanda ← harus ada nilai yang disimpan.');
        const ex = parseExprList();
        const expr = ex.length > 1 ? { k: 'list', items: ex, tuple: true, line } : ex[0];
        return { k: 'assign', targets, expr, line };
      }
      if (targets && (isOP('=') || isOP('=='))) throw new LabError(line, 'Untuk menyimpan nilai, gunakan tanda panah ← (atau ketik <-). Tanda = dipakai untuk membandingkan.');
      p = start;
      const e = parseExpr();
      if (e.k !== 'call') {
        if (isOP('=')) throw new LabError(line, 'Untuk menyimpan nilai, gunakan tanda panah ← (atau ketik <-). Tanda = dipakai untuk membandingkan.');
        throw new LabError(line, `Langkah "${pp(e)}" belum lengkap. Mungkin maksudnya ${pp(e)} ← … ?`);
      }
      return { k: 'call', expr: e, line };
    }
    function parseIf() {
      const t = expect('KW', 'JIKA');
      if (isKW('LAIN')) throw new LabError(t.line, 'JIKA LAIN tidak punya JIKA pembuka. Periksa apakah ada AKHIR SELAMA/AKHIR UNTUK yang belum ditulis.');
      const ifStop = () => closerAhead() || (isKW('JIKA') && isKW('LAIN', 1));
      const branches = [];
      const cond = parseExpr(); noColon();
      expect('KW', 'MAKA', 'Setelah kondisi JIKA tulis MAKA.');
      branches.push({ cond, body: parseBlock(ifStop, 'JIKA', t.line, 'AKHIR JIKA'), line: t.line });
      let elseBody = null, elseLine = null;
      while (isKW('JIKA') && isKW('LAIN', 1)) {
        const l = next(); next();
        if (isKW('JIKA')) {
          next(); const c = parseExpr(); noColon();
          expect('KW', 'MAKA', 'Setelah kondisi JIKA LAIN JIKA tulis MAKA.');
          branches.push({ cond: c, body: parseBlock(ifStop, 'JIKA', t.line, 'AKHIR JIKA'), line: l.line });
        } else {
          elseLine = l.line;
          elseBody = parseBlock(closerAhead, 'JIKA', t.line, 'AKHIR JIKA');
          if (isKW('JIKA') && isKW('LAIN', 1)) throw new LabError(peek().line, 'JIKA LAIN (tanpa kondisi) harus menjadi cabang terakhir sebelum AKHIR JIKA.');
          break;
        }
      }
      const endLine = expectCloser('JIKA', 'JIKA', t.line);
      return { k: 'if', branches, elseBody, elseLine, line: t.line, endLine };
    }
    function parseWhile() {
      const t = expect('KW', 'SELAMA');
      const cond = parseExpr(); noColon();
      const body = parseBlock(closerAhead, 'SELAMA', t.line, 'AKHIR SELAMA');
      const endLine = expectCloser('SELAMA', 'SELAMA', t.line);
      return { k: 'while', cond, body, line: t.line, endLine };
    }
    function parseFor() {
      const t = expect('KW', 'UNTUK');
      if (accept('KW', 'SETIAP')) {
        const v = expect('ID', undefined, 'Setelah UNTUK SETIAP tulis nama variabel, misalnya UNTUK SETIAP n DALAM data.');
        expect('KW', 'DALAM', 'Format: UNTUK SETIAP item DALAM nama_array');
        const iter = parseExpr(); noColon();
        const body = parseBlock(closerAhead, 'UNTUK', t.line, 'AKHIR UNTUK');
        const endLine = expectCloser('UNTUK', 'UNTUK', t.line);
        return { k: 'foreach', var: v.v, iter, body, line: t.line, endLine };
      }
      const v = expect('ID', undefined, 'Setelah UNTUK tulis nama variabel penghitung, misalnya UNTUK i DARI 1 HINGGA 10.');
      expect('KW', 'DARI', 'Format: UNTUK i DARI awal HINGGA akhir');
      const from = parseExpr();
      expect('KW', 'HINGGA', 'Format: UNTUK i DARI awal HINGGA akhir');
      const to = parseExpr();
      const step = accept('KW', 'LANGKAH') ? parseExpr() : null;
      noColon();
      const body = parseBlock(closerAhead, 'UNTUK', t.line, 'AKHIR UNTUK');
      const endLine = expectCloser('UNTUK', 'UNTUK', t.line);
      return { k: 'for', var: v.v, from, to, step, body, line: t.line, endLine };
    }
    function parseFunc() {
      const t = next(); const kind = t.v;
      const n = expect('ID', undefined, `Setelah ${kind} tulis nama subprogram, misalnya ${kind} hitung_luas(p, l).`);
      const params = [];
      expect('OP', '(', `Nama ${kind} harus diikuti tanda kurung, misalnya ${n.v}(a, b) atau ${n.v}().`);
      if (!isOP(')')) {
        do { const q = expect('ID', undefined, 'Parameter harus berupa nama variabel.'); params.push(q.v); } while (accept('OP', ','));
      }
      expect('OP', ')', 'Tanda kurung parameter belum ditutup dengan ).');
      noColon();
      const body = parseBlock(closerAhead, kind, t.line, `AKHIR ${kind}`);
      if (isKW('SELESAI')) throw new LabError(t.line, `${kind} ${n.v} di baris ${t.line} belum ditutup dengan AKHIR ${kind}.`);
      const endLine = expectCloser(kind, kind, t.line);
      const f = { k: 'func', kind, name: n.v, params, body, line: t.line, endLine };
      if (kind === 'PROSEDUR') walk(body, s => { if (s.k === 'return' && s.exprs.length) throw new LabError(s.line, `PROSEDUR tidak mengembalikan nilai. Ganti ${n.v} menjadi FUNGSI jika perlu KEMBALIKAN nilai.`); });
      f.locals = new Set(params); walk(body, s => { if (s.k === 'assign' || s.k === 'input') s.targets.forEach(tg => { if (tg.k === 'var') f.locals.add(tg.name); }); if (s.k === 'for' || s.k === 'foreach') f.locals.add(s.var); });
      return f;
    }

    /* expressions */
    function parseExprList() { const a = [parseExpr()]; while (accept('OP', ',')) a.push(parseExpr()); return a; }
    function parseExpr() { return parseOr(); }
    function parseOr() { let l = parseAnd(); while (isKW('ATAU')) { const t = next(); l = { k: 'bin', op: 'ATAU', l, r: parseAnd(), line: t.line }; } return l; }
    function parseAnd() { let l = parseNot(); while (isKW('DAN')) { const t = next(); l = { k: 'bin', op: 'DAN', l, r: parseNot(), line: t.line }; } return l; }
    function parseNot() { if (isKW('BUKAN')) { const t = next(); return { k: 'un', op: 'BUKAN', e: parseNot(), line: t.line }; } return parseCmp(); }
    const CMP = { '=': '=', '==': '=', '≠': '≠', '<': '<', '>': '>', '≤': '≤', '≥': '≥' };
    function parseCmp() {
      const l = parseAdd();
      if (is('OP') && CMP[peek().v]) {
        const t = next(); const r = parseAdd();
        if (is('OP') && CMP[peek().v]) throw new LabError(t.line, 'Perbandingan berantai (seperti 0 < x < 10) tidak bisa dipakai. Pisahkan dengan DAN: x > 0 DAN x < 10.');
        return { k: 'bin', op: CMP[t.v], l, r, line: t.line };
      }
      return l;
    }
    function parseAdd() { let l = parseMul(); while (isOP('+') || isOP('-')) { const t = next(); l = { k: 'bin', op: t.v, l, r: parseMul(), line: t.line }; } return l; }
    const MUL = { '×': '×', '*': '×', '÷': '÷', '/': '÷', '%': 'MOD', '//': 'DIV' };
    function parseMul() {
      let l = parseUnary();
      for (;;) {
        if (is('OP') && MUL[peek().v]) { const t = next(); l = { k: 'bin', op: MUL[t.v], l, r: parseUnary(), line: t.line }; continue; }
        if (isKW('MOD') || isKW('DIV')) { const t = next(); l = { k: 'bin', op: t.v, l, r: parseUnary(), line: t.line }; continue; }
        return l;
      }
    }
    function parseUnary() {
      if (isOP('-')) { const t = next(); const e = parseUnary(); if (e.k === 'num') return { k: 'num', v: -e.v, line: t.line }; return { k: 'un', op: '-', e, line: t.line }; }
      if (isOP('+')) { next(); return parseUnary(); }
      return parsePow();
    }
    function parsePow() { const b = parsePostfix(); if (isOP('**')) { const t = next(); return { k: 'bin', op: '**', l: b, r: parseUnary(), line: t.line }; } return b; }
    function parsePostfix() {
      let e = parsePrimary();
      for (;;) {
        if (isOP('[')) { const t = next(); const idx = parseExpr(); expect('OP', ']', 'Kurung siku [ belum ditutup dengan ].'); e = { k: 'index', base: e, index: idx, line: t.line }; continue; }
        if (isOP('(') && e.k === 'var') {
          const t = next(); const args = [];
          if (!isOP(')')) { do { args.push(parseExpr()); } while (accept('OP', ',')); }
          expect('OP', ')', `Tanda kurung pada ${e.name}( belum ditutup dengan ).`);
          e = { k: 'call', name: e.name, args, line: t.line }; continue;
        }
        return e;
      }
    }
    function parsePrimary() {
      const x = peek();
      if (x.t === 'NUM') { next(); return { k: 'num', v: x.v, line: x.line }; }
      if (x.t === 'STR') { next(); return { k: 'str', v: x.v, line: x.line }; }
      if (x.t === 'ID') { next(); return { k: 'var', name: x.v, line: x.line }; }
      if (x.t === 'KW' && (x.v === 'BENAR' || x.v === 'SALAH')) { next(); return { k: 'bool', v: x.v === 'BENAR', line: x.line }; }
      if (x.t === 'KW' && x.v === 'ARRAY') {
        next();
        if (is('ID') && /^kosong$/i.test(peek().v)) { next(); return { k: 'list', items: [], kosong: true, line: x.line }; }
        if (isOP('[')) { next(); const size = parseExpr(); expect('OP', ']', 'Kurung siku [ belum ditutup dengan ].'); return { k: 'arrnew', size, line: x.line }; }
        return { k: 'list', items: [], kosong: true, line: x.line };
      }
      if (x.t === 'OP' && x.v === '(') { next(); const e = parseExpr(); expect('OP', ')', 'Tanda kurung ( belum ditutup dengan ).'); return { k: 'group', e, line: x.line }; }
      if (x.t === 'OP' && x.v === '[') {
        next(); const items = [];
        if (!isOP(']')) { do { items.push(parseExpr()); } while (accept('OP', ',')); }
        expect('OP', ']', 'Kurung siku [ belum ditutup dengan ].');
        return { k: 'list', items, line: x.line };
      }
      if (x.t === 'NL' || x.t === 'EOF' || x.t === 'COMMENT') throw new LabError(x.line, 'Ekspresi belum lengkap: seharusnya ada nilai atau nama variabel di sini.');
      if (x.t === 'KW') throw new LabError(x.line, `Seharusnya ada nilai sebelum ${x.v}.`);
      if (x.t === 'OP' && x.v === '←') throw new LabError(x.line, 'Tanda ← hanya untuk menyimpan nilai ke variabel, di awal langkah.');
      throw new LabError(x.line, `Ekspresi tidak bisa diawali ${describe(x)}.`);
    }

    /* program */
    const prog = { funcs: {}, order: [], main: null, warnings: [], src: normalize(src) };
    const hasMulai = toks.some(x => x.t === 'KW' && x.v === 'MULAI');
    for (;;) {
      skipNL();
      if (is('EOF')) break;
      if (is('COMMENT')) { const x = next(); prog.order.push({ k: 'comment', text: x.v, line: x.line }); continue; }
      if (isKW('FUNGSI') || isKW('PROSEDUR')) {
        const f = parseFunc();
        if (prog.funcs[f.name]) throw new LabError(f.line, `Nama ${f.name} sudah dipakai oleh subprogram lain.`);
        if (BUILTINS.includes(f.name.toUpperCase())) throw new LabError(f.line, `${f.name} adalah nama fungsi bawaan. Pilih nama lain.`);
        prog.funcs[f.name] = f; prog.order.push(f); continue;
      }
      if (isKW('MULAI')) {
        if (prog.main && !prog.main.implicit) throw new LabError(peek().line, 'MULAI hanya boleh ada satu kali.');
        const t = next();
        const body = parseBlock(closerAhead, 'MULAI', t.line, 'SELESAI');
        if (isKW('AKHIR')) throw new LabError(peek().line, `AKHIR ${describe(peek(1))} tidak punya pasangan pembuka.`);
        const e = expect('KW', 'SELESAI');
        prog.main = { k: 'main', body, line: t.line, endLine: e.line }; prog.order.push(prog.main); continue;
      }
      if (!hasMulai) {
        const body = parseBlock(() => isKW('FUNGSI') || isKW('PROSEDUR') || closerAhead(), null);
        if (closerAhead()) throw new LabError(peek().line, isKW('SELESAI') ? 'SELESAI tidak punya pasangan MULAI.' : `AKHIR ${describe(peek(1))} tidak punya pasangan pembuka.`);
        if (body.length) {
          if (!prog.main) { prog.main = { k: 'main', body: [], line: body[0].line, endLine: body[body.length - 1].line, implicit: true }; prog.order.push(prog.main); }
          prog.main.body.push(...body);
        }
        continue;
      }
      const x = peek();
      if (isKW('SELESAI')) throw new LabError(x.line, 'SELESAI tidak punya pasangan MULAI.');
      if (isKW('AKHIR')) throw new LabError(x.line, `AKHIR ${describe(peek(1))} tidak punya pasangan pembuka.`);
      throw new LabError(x.line, 'Langkah program harus berada di antara MULAI dan SELESAI (atau di dalam FUNGSI/PROSEDUR).');
    }
    if (prog.main && prog.main.implicit && prog.main.body.some(s => s.k !== 'comment')) prog.warnings.push('Program belum diawali MULAI dan diakhiri SELESAI.');
    if (!prog.main) prog.main = { k: 'main', body: [], line: 1, endLine: 1, empty: true };
    // static check: calls to unknown subprograms
    const checkCalls = e => walkExpr(e, x => {
      if (x.k === 'call' && !prog.funcs[x.name] && !BUILTINS.includes(x.name.toUpperCase()))
        throw new LabError(x.line, `Subprogram ${x.name}(…) belum dibuat. Tulis FUNGSI atau PROSEDUR ${x.name} terlebih dahulu.`);
    });
    const allBodies = [prog.main.body, ...Object.values(prog.funcs).map(f => f.body)];
    allBodies.forEach(b => walk(b, s => stmtExprs(s).forEach(checkCalls)));
    return prog;
  }

  /* ───────────────────── AST helpers ───────────────────── */
  function walk(stmts, fn) {
    (stmts || []).forEach(s => {
      fn(s);
      if (s.k === 'if') { s.branches.forEach(b => walk(b.body, fn)); if (s.elseBody) walk(s.elseBody, fn); }
      if (s.k === 'while' || s.k === 'for' || s.k === 'foreach') walk(s.body, fn);
    });
  }
  function walkExpr(e, fn) {
    if (!e) return; fn(e);
    switch (e.k) {
      case 'bin': walkExpr(e.l, fn); walkExpr(e.r, fn); break;
      case 'un': case 'group': walkExpr(e.e, fn); break;
      case 'index': walkExpr(e.base, fn); walkExpr(e.index, fn); break;
      case 'call': e.args.forEach(a => walkExpr(a, fn)); break;
      case 'list': e.items.forEach(a => walkExpr(a, fn)); break;
      case 'arrnew': walkExpr(e.size, fn); break;
    }
  }
  function stmtExprs(s) {
    switch (s.k) {
      case 'assign': return [s.expr, ...s.targets];
      case 'input': return s.targets;
      case 'output': case 'return': return s.exprs;
      case 'if': return s.branches.map(b => b.cond);
      case 'while': return [s.cond];
      case 'for': return [s.from, s.to, s.step].filter(Boolean);
      case 'foreach': return [s.iter];
      case 'append': return [s.expr, s.target];
      case 'call': return [s.expr];
      default: return [];
    }
  }
  function stats(prog) {
    const st = { if: 0, elif: 0, while: 0, for: 0, foreach: 0, input: 0, output: 0, assign: 0, funcs: 0, procs: 0, mainStmts: 0, names: {} };
    const count = s => {
      if (st[s.k] !== undefined) st[s.k]++;
      if (s.k === 'if' && s.branches.length > 1) st.elif++;
    };
    walk(prog.main.body, s => { count(s); if (s.k !== 'comment') st.mainStmts++; });
    Object.values(prog.funcs).forEach(f => { if (f.kind === 'FUNGSI') st.funcs++; else st.procs++; st.names[f.name] = f; walk(f.body, count); });
    st.loops = st.while + st.for + st.foreach;
    st.hasMulai = !prog.main.implicit && !prog.main.empty;
    return st;
  }

  /* ───────────────────── values ───────────────────── */
  function fmtNum(n) {
    if (!isFinite(n)) return String(n);
    if (Number.isInteger(n)) return String(n);
    return String(parseFloat(n.toPrecision(12)));
  }
  function fmt(v, inner) {
    if (v === NONE || v === undefined || v === null) return 'TIDAK ADA';
    if (typeof v === 'boolean') return v ? 'BENAR' : 'SALAH';
    if (typeof v === 'number') return fmtNum(v);
    if (typeof v === 'string') return inner ? '"' + v + '"' : v;
    if (Array.isArray(v)) { const s = v.map(x => fmt(x, true)).join(', '); return v.tuple ? '(' + s + ')' : '[' + s + ']'; }
    return String(v);
  }
  function typeName(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? 'bilangan bulat' : 'bilangan desimal';
    if (typeof v === 'string') return 'teks';
    if (typeof v === 'boolean') return 'logika';
    if (Array.isArray(v)) return v.tuple ? 'beberapa nilai' : 'array';
    return 'tidak ada nilai';
  }
  function coerceInput(s) {
    if (typeof s !== 'string') return s;
    const t = s.trim();
    if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(t)) return parseFloat(t);
    if (/^-?(0|[1-9]\d*),\d+$/.test(t)) return parseFloat(t.replace(',', '.'));
    if (t === 'BENAR') return true;
    if (t === 'SALAH') return false;
    return t;
  }
  function deepEq(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
    if (typeof a === 'number' && typeof b === 'string') return fmtNum(a) === b.trim();
    if (typeof a === 'string' && typeof b === 'number') return a.trim() === fmtNum(b);
    return a === b;
  }
  function lev(a, b) {
    const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function suggest(name, known) {
    let best = null, bd = 3;
    for (const k of known) { if (k === name) continue; const d = lev(name.toLowerCase(), k.toLowerCase()); if (d < bd && (d <= 1 || name.length > 3)) { bd = d; best = k; } }
    return best;
  }

  /* ───────────────────── interpreter ───────────────────── */
  function createRun(prog, opts) {
    opts = opts || {};
    const rt = { prog, inputs: (opts.inputs || []).slice(), out: [], steps: 0, maxSteps: opts.maxSteps || 200000, frames: [], depth: 0,
      onOut: opts.onOut || null, rand: opts.rand || Math.random, types: {}, global: null };
    rt.gen = runMain(prog, rt);
    return rt;
  }
  function emit(rt, kind, text) { const o = { kind, text }; rt.out.push(o); if (rt.onOut) rt.onOut(o); }
  function* runMain(prog, rt) {
    const g = { name: 'Program utama', key: 'main', vars: new Map(), fn: null };
    rt.frames = [g]; rt.global = g;
    if (!prog.main.implicit && !prog.main.empty) yield { ev: 'step', line: prog.main.line, frame: g, kind: 'start' };
    yield* execBlock(prog.main.body, g, rt);
    if (!prog.main.implicit && !prog.main.empty) yield { ev: 'step', line: prog.main.endLine, frame: g, kind: 'end' };
  }
  function* execBlock(stmts, f, rt) {
    for (const s of stmts) {
      if (s.k === 'comment') continue;
      const r = yield* execStmt(s, f, rt);
      if (r) return r;
    }
    return null;
  }
  function tick(rt, line) {
    rt.steps++;
    if (rt.steps > rt.maxSteps) throw new LabError(line, `Program sudah berjalan ${rt.maxSteps.toLocaleString('id-ID')} langkah. Kemungkinan terjebak pengulangan tanpa akhir: periksa apakah variabel pada kondisi SELAMA berubah di dalam pengulangan.`, 'jalan');
  }
  function* ev(e, f, rt) {
    const v = yield* evalExpr(e, f, rt);
    if (v === NONE) throw new LabError(e.line, `${pp(e)} tidak menghasilkan nilai. PROSEDUR (atau FUNGSI tanpa KEMBALIKAN) tidak bisa dipakai sebagai nilai.`, 'jalan');
    return v;
  }
  function* cond(e, f, rt, line) {
    const v = yield* ev(e, f, rt);
    if (typeof v !== 'boolean') throw new LabError(line, `Kondisi "${pp(e)}" harus bernilai BENAR atau SALAH, tetapi hasilnya ${fmt(v, true)}. Gunakan perbandingan seperti =, <, atau >.`, 'jalan');
    return v;
  }
  function* execStmt(s, f, rt) {
    tick(rt, s.line);
    yield { ev: 'step', line: s.line, node: s, frame: f };
    switch (s.k) {
      case 'assign': {
        const v = yield* ev(s.expr, f, rt);
        if (s.targets.length > 1) {
          if (!Array.isArray(v) || v.length !== s.targets.length) throw new LabError(s.line, `Ada ${s.targets.length} variabel di kiri ←, tetapi nilai di kanan ${Array.isArray(v) ? 'berisi ' + v.length + ' nilai' : 'hanya satu nilai'}.`, 'jalan');
          for (let i = 0; i < s.targets.length; i++) yield* assignTo(s.targets[i], v[i], f, rt, s.line);
        } else yield* assignTo(s.targets[0], v, f, rt, s.line);
        return null;
      }
      case 'input': {
        for (const tg of s.targets) {
          const label = pp(tg);
          let raw;
          if (rt.inputs.length) raw = rt.inputs.shift();
          else raw = yield { ev: 'input', line: s.line, name: label, frame: f };
          if (raw === undefined || raw === null) throw new LabError(s.line, `INPUT ${label} tidak mendapat data.`, 'jalan');
          const v = coerceInput(raw);
          emit(rt, 'in', `${label} = ${fmt(v, true)}`);
          if (tg.k === 'var') rt.types[tg.name] = typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float') : (typeof v === 'string' ? 'str' : rt.types[tg.name]);
          yield* assignTo(tg, v, f, rt, s.line);
        }
        return null;
      }
      case 'output': {
        const parts = [];
        for (const e of s.exprs) parts.push(fmt(yield* ev(e, f, rt)));
        emit(rt, 'out', parts.join(' '));
        return null;
      }
      case 'if': {
        for (let i = 0; i < s.branches.length; i++) {
          const b = s.branches[i];
          if (i > 0) { tick(rt, b.line); yield { ev: 'step', line: b.line, node: s, frame: f, kind: 'elif' }; }
          const c = yield* cond(b.cond, f, rt, b.line);
          yield { ev: 'cond', line: b.line, text: pp(b.cond), value: c };
          if (c) return yield* execBlock(b.body, f, rt);
        }
        if (s.elseBody) { yield { ev: 'step', line: s.elseLine, node: s, frame: f, kind: 'else' }; return yield* execBlock(s.elseBody, f, rt); }
        return null;
      }
      case 'while': {
        let first = true;
        for (;;) {
          if (!first) { tick(rt, s.line); yield { ev: 'step', line: s.line, node: s, frame: f, kind: 'loop' }; }
          first = false;
          const c = yield* cond(s.cond, f, rt, s.line);
          yield { ev: 'cond', line: s.line, text: pp(s.cond), value: c };
          if (!c) return null;
          const r = yield* execBlock(s.body, f, rt);
          if (r) return r;
        }
      }
      case 'for': {
        const a = yield* ev(s.from, f, rt), b = yield* ev(s.to, f, rt);
        const st = s.step ? yield* ev(s.step, f, rt) : 1;
        if (typeof a !== 'number' || typeof b !== 'number' || typeof st !== 'number') throw new LabError(s.line, 'Nilai DARI, HINGGA, dan LANGKAH pada UNTUK harus berupa bilangan.', 'jalan');
        if (st === 0) throw new LabError(s.line, 'LANGKAH tidak boleh 0.', 'jalan');
        let i = a, first = true;
        for (;;) {
          if (!first) { tick(rt, s.line); yield { ev: 'step', line: s.line, node: s, frame: f, kind: 'loop' }; }
          first = false;
          const ok = st > 0 ? i <= b : i >= b;
          yield { ev: 'cond', line: s.line, text: `${s.var} ${st > 0 ? '≤' : '≥'} ${pp(s.to)}`, value: ok, detail: `${s.var} = ${fmtNum(i)}` };
          if (!ok) return null;
          f.vars.set(s.var, i);
          const r = yield* execBlock(s.body, f, rt);
          if (r) return r;
          i += st;
        }
      }
      case 'foreach': {
        const it = yield* ev(s.iter, f, rt);
        if (!Array.isArray(it) && typeof it !== 'string') throw new LabError(s.line, `UNTUK SETIAP hanya bisa menelusuri array atau teks, bukan ${typeName(it)}.`, 'jalan');
        const items = Array.from(it);
        for (let k = 0; k <= items.length; k++) {
          if (k > 0) { tick(rt, s.line); yield { ev: 'step', line: s.line, node: s, frame: f, kind: 'loop' }; }
          const ok = k < items.length;
          yield { ev: 'cond', line: s.line, text: `masih ada ${s.var} DALAM ${pp(s.iter)}`, value: ok };
          if (!ok) return null;
          f.vars.set(s.var, items[k]);
          const r = yield* execBlock(s.body, f, rt);
          if (r) return r;
        }
        return null;
      }
      case 'return': {
        if (!f.fn) throw new LabError(s.line, 'KEMBALIKAN hanya boleh dipakai di dalam FUNGSI.', 'jalan');
        const vals = [];
        for (const e of s.exprs) vals.push(yield* ev(e, f, rt));
        let v = NONE;
        if (vals.length === 1) v = vals[0];
        else if (vals.length > 1) { v = vals; v.tuple = true; }
        return { ret: v };
      }
      case 'append': {
        const v = yield* ev(s.expr, f, rt);
        const arr = yield* ev(s.target, f, rt);
        if (!Array.isArray(arr) || arr.tuple) throw new LabError(s.line, `TAMBAH … KE … hanya untuk ARRAY, sedangkan ${pp(s.target)} berisi ${typeName(arr)}.`, 'jalan');
        arr.push(v);
        return null;
      }
      case 'call': {
        yield* evalExpr(s.expr, f, rt);
        return null;
      }
    }
    return null;
  }
  function* assignTo(tg, v, f, rt, line) {
    if (tg.k === 'var') {
      if (rt.prog.funcs[tg.name]) throw new LabError(line, `${tg.name} sudah dipakai sebagai nama subprogram. Pilih nama variabel lain.`, 'jalan');
      if (Array.isArray(v) && v.tuple) { /* keep */ }
      f.vars.set(tg.name, v); return;
    }
    const arr = yield* ev(tg.base, f, rt);
    const idx = yield* ev(tg.index, f, rt);
    if (typeof arr === 'string') throw new LabError(line, 'Isi teks tidak bisa diubah per huruf. Buat teks baru dengan +.', 'jalan');
    if (!Array.isArray(arr) || arr.tuple) throw new LabError(line, `${pp(tg.base)} bukan ARRAY, jadi tidak bisa diberi indeks.`, 'jalan');
    checkIndex(arr, idx, line, pp(tg.base));
    arr[idx - 1] = v;
  }
  function checkIndex(arr, idx, line, name) {
    if (typeof idx !== 'number' || !Number.isInteger(idx)) throw new LabError(line, `Indeks ${name}[…] harus bilangan bulat, bukan ${fmt(idx, true)}.`, 'jalan');
    if (idx < 1 || idx > arr.length) {
      let m = `Indeks ${idx} di luar jangkauan ${name}. Indeks yang tersedia: 1 sampai ${arr.length}.`;
      if (idx === 0) m += ' Di pseudocode modul ini elemen pertama adalah [1] (di Python [0]).';
      if (arr.length === 0) m = `${name} masih kosong, jadi belum punya elemen untuk diambil.`;
      throw new LabError(line, m, 'jalan');
    }
  }
  function getVar(rt, f, name, line) {
    if (f.vars.has(name)) return f.vars.get(name);
    if (f !== rt.global && rt.global.vars.has(name)) return rt.global.vars.get(name);
    if (rt.prog.funcs[name]) throw new LabError(line, `${name} adalah nama subprogram. Untuk memakainya, panggil dengan ${name}(…).`, 'jalan');
    const owner = Object.values(rt.prog.funcs).find(fn => fn.locals && fn.locals.has(name) && (!f.fn || fn !== f.fn));
    if (owner && (!f.fn || !f.fn.locals.has(name))) throw new LabError(line, `${name} adalah variabel lokal milik ${owner.kind} ${owner.name}. Di luar subprogram itu, ${name} tidak dikenal. Kirim nilainya lewat KEMBALIKAN atau parameter.`, 'jalan');
    const known = [...f.vars.keys(), ...(f !== rt.global ? rt.global.vars.keys() : [])];
    const sug = suggest(name, known);
    let msg = `Variabel ${name} belum diberi nilai.`;
    if (sug) msg += ` Mungkin maksudnya ${sug}?`;
    else msg += ` Beri nilai awal dulu, misalnya ${name} ← 0.`;
    throw new LabError(line, msg, 'jalan');
  }
  function num(v, line, what) {
    if (typeof v !== 'number') throw new LabError(line, `${what} hanya bisa untuk bilangan, tetapi mendapat ${typeName(v)} ${fmt(v, true)}.`, 'jalan');
    return v;
  }
  function* evalExpr(e, f, rt) {
    switch (e.k) {
      case 'num': case 'str': case 'bool': return e.v;
      case 'group': return yield* evalExpr(e.e, f, rt);
      case 'var': return getVar(rt, f, e.name, e.line);
      case 'list': { const a = []; for (const x of e.items) a.push(yield* ev(x, f, rt)); if (e.tuple) a.tuple = true; return a; }
      case 'arrnew': { const n = yield* ev(e.size, f, rt); if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) throw new LabError(e.line, 'Ukuran ARRAY harus bilangan bulat positif.', 'jalan'); return new Array(n).fill(0); }
      case 'index': {
        const b = yield* ev(e.base, f, rt), i = yield* ev(e.index, f, rt);
        if (typeof b === 'string') { checkIndex(b, i, e.line, pp(e.base)); return b[i - 1]; }
        if (!Array.isArray(b)) throw new LabError(e.line, `${pp(e.base)} berisi ${typeName(b)}, jadi tidak bisa diberi indeks [ ].`, 'jalan');
        checkIndex(b, i, e.line, pp(e.base));
        return b[i - 1];
      }
      case 'un': {
        const v = yield* ev(e.e, f, rt);
        if (e.op === '-') return -num(v, e.line, 'Tanda minus');
        if (typeof v !== 'boolean') throw new LabError(e.line, `BUKAN hanya untuk nilai BENAR/SALAH, bukan ${fmt(v, true)}.`, 'jalan');
        return !v;
      }
      case 'bin': {
        if (e.op === 'DAN' || e.op === 'ATAU') {
          const l = yield* ev(e.l, f, rt);
          if (typeof l !== 'boolean') throw new LabError(e.line, `${e.op} hanya menggabungkan nilai BENAR/SALAH, tetapi sisi kiri bernilai ${fmt(l, true)}.`, 'jalan');
          if (e.op === 'DAN' && !l) return false;
          if (e.op === 'ATAU' && l) return true;
          const r = yield* ev(e.r, f, rt);
          if (typeof r !== 'boolean') throw new LabError(e.line, `${e.op} hanya menggabungkan nilai BENAR/SALAH, tetapi sisi kanan bernilai ${fmt(r, true)}.`, 'jalan');
          return r;
        }
        const l = yield* ev(e.l, f, rt), r = yield* ev(e.r, f, rt);
        switch (e.op) {
          case '+':
            if (typeof l === 'string' || typeof r === 'string') return fmt(l) + fmt(r);
            if (Array.isArray(l) && Array.isArray(r)) return l.concat(r);
            return num(l, e.line, 'Penjumlahan') + num(r, e.line, 'Penjumlahan');
          case '-': return num(l, e.line, 'Pengurangan') - num(r, e.line, 'Pengurangan');
          case '×': return num(l, e.line, 'Perkalian') * num(r, e.line, 'Perkalian');
          case '÷': num(l, e.line, 'Pembagian'); if (num(r, e.line, 'Pembagian') === 0) throw new LabError(e.line, 'Pembagian dengan nol tidak bisa dihitung.', 'jalan'); return l / r;
          case 'DIV': num(l, e.line, 'DIV'); if (num(r, e.line, 'DIV') === 0) throw new LabError(e.line, 'Pembagian dengan nol tidak bisa dihitung.', 'jalan'); return Math.floor(l / r);
          case 'MOD': num(l, e.line, 'MOD'); if (num(r, e.line, 'MOD') === 0) throw new LabError(e.line, 'MOD dengan 0 tidak bisa dihitung.', 'jalan'); return l - r * Math.floor(l / r);
          case '**': return Math.pow(num(l, e.line, 'Pangkat'), num(r, e.line, 'Pangkat'));
          case '=': return deepEq(l, r);
          case '≠': return !deepEq(l, r);
          case '<': case '>': case '≤': case '≥': {
            if (!((typeof l === 'number' && typeof r === 'number') || (typeof l === 'string' && typeof r === 'string')))
              throw new LabError(e.line, `Tidak bisa membandingkan ${typeName(l)} dengan ${typeName(r)} memakai ${e.op}.`, 'jalan');
            return e.op === '<' ? l < r : e.op === '>' ? l > r : e.op === '≤' ? l <= r : l >= r;
          }
        }
        throw new LabError(e.line, `Operator ${e.op} tidak dikenal.`, 'jalan');
      }
      case 'call': {
        const fn = rt.prog.funcs[e.name];
        const args = [];
        for (const a of e.args) args.push(yield* ev(a, f, rt));
        if (fn) return yield* callUser(rt, fn, args, e.line);
        return builtin(rt, e.name, args, e.line);
      }
    }
    throw new LabError(e.line, 'Ekspresi tidak dikenal.', 'jalan');
  }
  function* callUser(rt, fn, args, line) {
    if (args.length !== fn.params.length) throw new LabError(line, `${fn.kind} ${fn.name} membutuhkan ${fn.params.length} nilai (${fn.params.join(', ') || 'tanpa parameter'}), tetapi diberi ${args.length}.`, 'jalan');
    if (rt.depth > 200) throw new LabError(line, 'Terlalu banyak pemanggilan subprogram bertumpuk. Mungkin subprogram memanggil dirinya sendiri tanpa henti.', 'jalan');
    const fr = { name: `${fn.kind} ${fn.name}`, key: fn.name + '#' + (++rt.callSeq || (rt.callSeq = 1)), vars: new Map(), fn };
    fn.params.forEach((p, i) => fr.vars.set(p, args[i]));
    rt.frames.push(fr); rt.depth++;
    tick(rt, fn.line);
    yield { ev: 'step', line: fn.line, node: fn, frame: fr, kind: 'enter' };
    let r;
    try { r = yield* execBlock(fn.body, fr, rt); }
    finally { rt.frames.pop(); rt.depth--; }
    if (!r) { yield { ev: 'step', line: fn.endLine, node: fn, frame: fr, kind: 'leave' }; return NONE; }
    return r.ret;
  }
  function builtin(rt, name, a, line) {
    const N = name.toUpperCase();
    const need = (n) => { if (a.length !== n) throw new LabError(line, `${N} membutuhkan ${n} nilai, tetapi diberi ${a.length}.`, 'jalan'); };
    switch (N) {
      case 'PANJANG': need(1); if (typeof a[0] !== 'string' && !Array.isArray(a[0])) throw new LabError(line, 'PANJANG hanya untuk teks atau array.', 'jalan'); return a[0].length;
      case 'AKAR': need(1); if (num(a[0], line, 'AKAR') < 0) throw new LabError(line, 'AKAR bilangan negatif tidak bisa dihitung.', 'jalan'); return Math.sqrt(a[0]);
      case 'BULATKAN': if (a.length === 1) return Math.round(num(a[0], line, 'BULATKAN')); need(2); { const k = Math.pow(10, a[1]); return Math.round(num(a[0], line, 'BULATKAN') * k) / k; }
      case 'ACAK': need(2); num(a[0], line, 'ACAK'); num(a[1], line, 'ACAK'); return Math.floor(rt.rand() * (a[1] - a[0] + 1)) + a[0];
      case 'TEKS': need(1); return fmt(a[0]);
      case 'ANGKA': { need(1); const v = typeof a[0] === 'number' ? a[0] : parseFloat(String(a[0]).replace(',', '.')); if (isNaN(v)) throw new LabError(line, `"${a[0]}" tidak bisa diubah menjadi angka.`, 'jalan'); return v; }
      case 'MUTLAK': need(1); return Math.abs(num(a[0], line, 'MUTLAK'));
      case 'POTONG': need(3); if (typeof a[0] !== 'string') throw new LabError(line, 'POTONG hanya untuk teks.', 'jalan'); return a[0].slice(num(a[1], line, 'POTONG') - 1, num(a[2], line, 'POTONG'));
    }
    throw new LabError(line, `Subprogram ${name}(…) belum dibuat.`, 'jalan');
  }

  /* headless helpers for missions & tests */
  function drive(gen) {
    let r, send;
    for (;;) {
      r = gen.next(send); send = undefined;
      if (r.done) return r.value;
      if (r.value.ev === 'input') throw new LabError(r.value.line, 'Data masukan untuk pengujian sudah habis, tetapi program masih meminta INPUT.', 'jalan');
    }
  }
  function runHeadless(prog, inputs, opts) {
    const rt = createRun(prog, Object.assign({ inputs: (inputs || []).map(String), maxSteps: 300000 }, opts || {}));
    try { drive(rt.gen); return { ok: true, out: rt.out, rt }; }
    catch (err) { if (!(err instanceof LabError)) err = new LabError(0, 'Terjadi kesalahan: ' + err.message, 'jalan'); return { ok: false, error: err, out: rt.out, rt }; }
  }
  function callHeadless(prog, name, args) {
    const fn = prog.funcs[name];
    if (!fn) return { ok: false, error: new LabError(0, `Subprogram ${name} belum dibuat.`, 'jalan') };
    const rt = createRun(prog, { inputs: [], maxSteps: 300000 });
    const g = { name: 'Program utama', key: 'main', vars: new Map(), fn: null }; rt.frames = [g]; rt.global = g;
    const clone = v => Array.isArray(v) ? v.map(clone) : v;
    try { const v = drive(callUser(rt, fn, args.map(clone), fn.line)); return { ok: true, value: v, out: rt.out }; }
    catch (err) { if (!(err instanceof LabError)) err = new LabError(0, 'Terjadi kesalahan: ' + err.message, 'jalan'); return { ok: false, error: err, out: rt.out }; }
  }

  /* ───────────────────── pseudocode printer ───────────────────── */
  const PREC = { 'ATAU': 1, 'DAN': 2, '=': 4, '≠': 4, '<': 4, '>': 4, '≤': 4, '≥': 4, '+': 5, '-': 5, '×': 6, '÷': 6, 'MOD': 6, 'DIV': 6, '**': 8 };
  function pp(e, minPrec) {
    minPrec = minPrec || 0;
    switch (e.k) {
      case 'num': return fmtNum(e.v);
      case 'str': return '"' + e.v + '"';
      case 'bool': return e.v ? 'BENAR' : 'SALAH';
      case 'var': return e.name;
      case 'group': return '(' + pp(e.e) + ')';
      case 'list': return e.kosong ? 'ARRAY kosong' : (e.tuple ? e.items.map(x => pp(x)).join(', ') : '[' + e.items.map(x => pp(x)).join(', ') + ']');
      case 'arrnew': return 'ARRAY[' + pp(e.size) + ']';
      case 'index': return pp(e.base, 9) + '[' + pp(e.index) + ']';
      case 'call': return e.name + '(' + e.args.map(x => pp(x)).join(', ') + ')';
      case 'un': { const pr = e.op === 'BUKAN' ? 3 : 7; const s = e.op === 'BUKAN' ? 'BUKAN ' + pp(e.e, pr) : '-' + pp(e.e, pr); return pr < minPrec ? '(' + s + ')' : s; }
      case 'bin': {
        const pr = PREC[e.op], ra = e.op === '**';
        const s = pp(e.l, ra ? pr + 1 : pr) + ' ' + e.op + ' ' + pp(e.r, ra ? pr : pr + 1);
        return pr < minPrec ? '(' + s + ')' : s;
      }
    }
    return '?';
  }
  function stmtText(s) {
    switch (s.k) {
      case 'assign': return s.targets.map(t => pp(t)).join(', ') + ' ← ' + pp(s.expr);
      case 'input': return 'INPUT ' + s.targets.map(t => pp(t)).join(', ');
      case 'output': return 'OUTPUT ' + s.exprs.map(x => pp(x)).join(', ');
      case 'return': return 'KEMBALIKAN' + (s.exprs.length ? ' ' + s.exprs.map(x => pp(x)).join(', ') : '');
      case 'append': return 'TAMBAH ' + pp(s.expr) + ' KE ' + pp(s.target);
      case 'call': return pp(s.expr);
      case 'if': return 'JIKA ' + pp(s.branches[0].cond) + ' MAKA';
      case 'while': return 'SELAMA ' + pp(s.cond);
      case 'for': return `UNTUK ${s.var} DARI ${pp(s.from)} HINGGA ${pp(s.to)}` + (s.step ? ' LANGKAH ' + pp(s.step) : '');
      case 'foreach': return `UNTUK SETIAP ${s.var} DALAM ${pp(s.iter)}`;
    }
    return '';
  }

  /* ───────────────────── Python translator ───────────────────── */
  const PYOP = { 'ATAU': 'or', 'DAN': 'and', '=': '==', '≠': '!=', '<': '<', '>': '>', '≤': '<=', '≥': '>=', '+': '+', '-': '-', '×': '*', '÷': '/', 'MOD': '%', 'DIV': '//', '**': '**' };
  function toPython(prog, hints) {
    hints = hints || {};
    let needMath = false, needRandom = false;
    const q2 = '"';
    function pyStr(v, q) { return q + v.replace(/\\/g, '\\\\').split(q).join('\\' + q) + q; }
    function flatPlus(e) { return e.k === 'bin' && e.op === '+' ? [...flatPlus(e.l), e.r] : [e]; }
    function idx(i) {
      if (i.k === 'num') return fmtNum(i.v - 1);
      if (i.k === 'bin' && i.op === '+' && i.r.k === 'num') { const n = i.r.v - 1; return n === 0 ? py(i.l, 5) : py(i.l, 5) + ' + ' + fmtNum(n); }
      if (i.k === 'bin' && i.op === '-' && i.r.k === 'num') return py(i.l, 5) + ' - ' + fmtNum(i.r.v + 1);
      return py(i, 5) + ' - 1';
    }
    function py(e, minPrec, q) {
      minPrec = minPrec || 0; q = q || q2;
      switch (e.k) {
        case 'num': return fmtNum(e.v);
        case 'str': return pyStr(e.v, q);
        case 'bool': return e.v ? 'True' : 'False';
        case 'var': return e.name;
        case 'group': return '(' + py(e.e, 0, q) + ')';
        case 'list': return e.tuple ? e.items.map(x => py(x, 0, q)).join(', ') : '[' + e.items.map(x => py(x, 0, q)).join(', ') + ']';
        case 'arrnew': return '[0] * ' + py(e.size, 6, q);
        case 'index': return py(e.base, 9, q) + '[' + idx(e.index) + ']';
        case 'call': {
          const N = e.name.toUpperCase(); const A = e.args.map(x => py(x, 0, q));
          if (!rtFuncs[e.name]) {
            switch (N) {
              case 'PANJANG': return `len(${A[0]})`;
              case 'AKAR': needMath = true; return `math.sqrt(${A[0]})`;
              case 'BULATKAN': return `round(${A.join(', ')})`;
              case 'ACAK': needRandom = true; return `random.randint(${A.join(', ')})`;
              case 'TEKS': return `str(${A[0]})`;
              case 'ANGKA': return `float(${A[0]})`;
              case 'MUTLAK': return `abs(${A[0]})`;
              case 'POTONG': return `${py(e.args[0], 9, q)}[${idx(e.args[1])}:${A[2]}]`;
            }
          }
          return e.name + '(' + A.join(', ') + ')';
        }
        case 'un': {
          const pr = e.op === 'BUKAN' ? 3 : 7;
          const s = e.op === 'BUKAN' ? 'not ' + py(e.e, pr, q) : '-' + py(e.e, pr, q);
          return pr < minPrec ? '(' + s + ')' : s;
        }
        case 'bin': {
          if (e.op === '+') {
            const parts = flatPlus(e);
            const k = parts.findIndex(x => x.k === 'str');
            if (k >= 0 && parts.some(x => x.k !== 'str')) {
              let segs = parts.slice(k);
              if (k > 0) { let pre = parts[0]; for (let i = 1; i < k; i++) pre = { k: 'bin', op: '+', l: pre, r: parts[i] }; segs = [pre, ...segs]; }
              const inner = q === '"' ? "'" : '"';
              let body = '';
              segs.forEach(sg => { body += sg.k === 'str' ? sg.v.replace(/\\/g, '\\\\').replace(/\{/g, '{{').replace(/\}/g, '}}').split(q).join('\\' + q) : '{' + py(sg, 0, inner) + '}'; });
              return 'f' + q + body + q;
            }
          }
          const pr = PREC[e.op], ra = e.op === '**';
          const s = py(e.l, ra ? pr + 1 : pr, q) + ' ' + PYOP[e.op] + ' ' + py(e.r, ra ? pr : pr + 1, q);
          return pr < minPrec ? '(' + s + ')' : s;
        }
      }
      return '?';
    }
    const rtFuncs = prog.funcs;
    const out = [];
    const I = n => '    '.repeat(n);
    const mayFloat = e => { let f = false; walkExpr(e, x => { if ((x.k === 'call' && /^(AKAR)$/i.test(x.name)) || (x.k === 'bin' && x.op === '÷')) f = true; }); return f; };
    function rangeEnd(to, step) {
      const neg = step && ((step.k === 'num' && step.v < 0));
      if (to.k === 'num') return fmtNum(to.v + (neg ? -1 : 1));
      if (!neg && to.k === 'bin' && (to.op === '-' || to.op === '+') && to.r.k === 'num' && !mayFloat(to)) {
        const k = to.op === '-' ? to.r.v - 1 : -(to.r.v + 1);
        const base = py(to.l, 5);
        return k === 0 ? base : k > 0 ? `${base} - ${fmtNum(k)}` : `${base} + ${fmtNum(-k)}`;
      }
      const base = mayFloat(to) ? `int(${py(to)})` : py(to, 5);
      return base + (neg ? ' - 1' : ' + 1');
    }
    function block(stmts, n) {
      const real = stmts.filter(s => s.k !== 'comment');
      if (!real.length) { stmts.forEach(s => stmt(s, n)); out.push(I(n) + 'pass'); return; }
      stmts.forEach(s => stmt(s, n));
    }
    function tc(s) { return s.comment ? '  # ' + s.comment : ''; }
    function lv(t) { return py(t); }
    function stmt(s, n) {
      switch (s.k) {
        case 'comment': out.push(I(n) + '# ' + s.text); break;
        case 'assign': out.push(I(n) + s.targets.map(lv).join(', ') + ' = ' + py(s.expr) + tc(s)); break;
        case 'input': s.targets.forEach((t, i) => {
          const name = t.k === 'var' ? t.name : pp(t);
          const ty = t.k === 'var' ? (hints[t.name] || 'int') : 'int';
          const call = `input(${pyStr(name + ': ', '"')})`;
          out.push(I(n) + lv(t) + ' = ' + (ty === 'str' ? call : `${ty}(${call})`) + (i === s.targets.length - 1 ? tc(s) : ''));
        }); break;
        case 'output': out.push(I(n) + 'print(' + s.exprs.map(x => py(x)).join(', ') + ')' + tc(s)); break;
        case 'return': out.push(I(n) + 'return' + (s.exprs.length ? ' ' + s.exprs.map(x => py(x)).join(', ') : '') + tc(s)); break;
        case 'append': out.push(I(n) + py(s.target, 9) + '.append(' + py(s.expr) + ')' + tc(s)); break;
        case 'call': out.push(I(n) + py(s.expr) + tc(s)); break;
        case 'if':
          s.branches.forEach((b, i) => { out.push(I(n) + (i === 0 ? 'if ' : 'elif ') + py(b.cond) + ':' + (i === 0 ? tc(s) : '')); block(b.body, n + 1); });
          if (s.elseBody) { out.push(I(n) + 'else:'); block(s.elseBody, n + 1); }
          break;
        case 'while': out.push(I(n) + 'while ' + py(s.cond) + ':' + tc(s)); block(s.body, n + 1); break;
        case 'for': {
          const end = rangeEnd(s.to, s.step);
          let args;
          if (s.step) args = `${py(s.from)}, ${end}, ${py(s.step)}`;
          else if (s.from.k === 'num' && s.from.v === 0) args = end;
          else args = `${py(s.from)}, ${end}`;
          out.push(I(n) + `for ${s.var} in range(${args}):` + tc(s));
          block(s.body, n + 1); break;
        }
        case 'foreach': out.push(I(n) + `for ${s.var} in ${py(s.iter)}:` + tc(s)); block(s.body, n + 1); break;
      }
    }
    let first = true;
    prog.order.forEach(item => {
      if (item.k === 'comment') { out.push('# ' + item.text); return; }
      if (item.k === 'func') {
        if (!first && out.length && out[out.length - 1] !== '') out.push('');
        out.push(`def ${item.name}(${item.params.join(', ')}):` + (item.kind === 'PROSEDUR' ? '  # prosedur: tanpa return' : ''));
        block(item.body, 1); out.push(''); first = false; return;
      }
      if (item.k === 'main') {
        if (!first && out.length && out[out.length - 1] !== '') out.push('');
        const prev = out.length ? out[out.length - 1] : '';
        if (Object.keys(prog.funcs).length && !/^#/.test(prev)) out.push('# Program utama');
        block(item.body, 0); first = false;
      }
    });
    while (out.length && out[out.length - 1] === '') out.pop();
    const head = [];
    if (needMath) head.push('import math');
    if (needRandom) head.push('import random');
    if (head.length) head.push('');
    return head.concat(out).join('\n') + '\n';
  }

  /* ───────────────────── flowchart (SVG) ───────────────────── */
  const CW = 7.25, NH = 38, DH = 66, G = 26, GX = 34;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function nsize(type, text) {
    const len = text.length;
    if (type === 'dec') return { w: Math.round(Math.min(330, Math.max(140, len * CW + 70))), h: DH };
    const pad = type === 'io' ? 46 : type === 'sub' ? 42 : 30;
    const min = (type === 'term' || type === 'ret') ? 104 : 120;
    return { w: Math.round(Math.min(300, Math.max(min, len * CW + pad))), h: NH };
  }
  function fitText(text, w, type) {
    const pad = type === 'dec' ? 64 : type === 'io' ? 40 : type === 'sub' ? 36 : 24;
    const max = Math.max(4, Math.floor((w - pad) / CW));
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }
  function shapeInner(type, x, y, w, h, text) {
    let s = '';
    const r = n => Math.round(n * 10) / 10;
    if (type === 'term' || type === 'ret') s = `<rect x="${r(x)}" y="${r(y)}" width="${w}" height="${h}" rx="${h / 2}" class="fc-shape fc-${type}"/>`;
    else if (type === 'proc') s = `<rect x="${r(x)}" y="${r(y)}" width="${w}" height="${h}" rx="2" class="fc-shape fc-proc"/>`;
    else if (type === 'io') { const k = 13; s = `<polygon points="${r(x + k)},${r(y)} ${r(x + w)},${r(y)} ${r(x + w - k)},${r(y + h)} ${r(x)},${r(y + h)}" class="fc-shape fc-io"/>`; }
    else if (type === 'dec') s = `<polygon points="${r(x + w / 2)},${r(y)} ${r(x + w)},${r(y + h / 2)} ${r(x + w / 2)},${r(y + h)} ${r(x)},${r(y + h / 2)}" class="fc-shape fc-dec"/>`;
    else if (type === 'sub') s = `<rect x="${r(x)}" y="${r(y)}" width="${w}" height="${h}" rx="2" class="fc-shape fc-sub"/><line x1="${r(x + 9)}" y1="${r(y)}" x2="${r(x + 9)}" y2="${r(y + h)}" class="fc-subline"/><line x1="${r(x + w - 9)}" y1="${r(y)}" x2="${r(x + w - 9)}" y2="${r(y + h)}" class="fc-subline"/>`;
    const t = fitText(text, w, type);
    return s + `<text x="${r(x + w / 2)}" y="${r(y + h / 2 + 4)}" text-anchor="middle" class="fc-text fc-text-${type}">${esc(t)}</text>`;
  }
  /* SINK: bila aktif, simbol tidak digambar melainkan dicatat sebagai "kotak kosong" untuk mode Susun Flowchart */
  let SINK = null;
  function shape(type, x, y, w, h, text, line) {
    if (SINK) {
      const id = SINK.length;
      SINK.push({ id, type, text, line, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w, h });
      return `<g class="fc-slot" data-slot="${id}"></g>`;
    }
    return `<g class="fc-node" data-line="${line}"><title>${esc(text)}</title>${shapeInner(type, x, y, w, h, text)}</g>`;
  }
  function path(out, pts, arrow, cls) {
    const d = pts.map((p, i) => (i ? 'L' : 'M') + Math.round(p[0] * 10) / 10 + ',' + Math.round(p[1] * 10) / 10).join(' ');
    out.push(`<path d="${d}" class="${cls || 'fc-edge'}"${arrow ? ' marker-end="url(#AH)"' : ''}/>`);
  }
  function label(out, x, y, t, anchor) { out.push(`<text x="${Math.round(x)}" y="${Math.round(y)}" class="fc-lab"${anchor ? ` text-anchor="${anchor}"` : ''}>${t}</text>`); }
  function leaf(type, text, line) {
    const { w, h } = nsize(type, text);
    return { w, h, cx: w / 2, term: type === 'ret', draw(ox, oy, out) { out.push(shape(type, ox, oy, w, h, text, line)); } };
  }
  function seq(chs) {
    chs = chs.filter(Boolean);
    if (!chs.length) return null;
    if (chs.length === 1) return chs[0];
    const cx = Math.max(...chs.map(c => c.cx));
    const pos = []; let y = 0, w = 0, term = false;
    chs.forEach((c, i) => { const x = cx - c.cx; pos.push([x, y]); w = Math.max(w, x + c.w); y += c.h; if (c.term) term = true; if (i < chs.length - 1) y += (c.add || chs[i + 1].add) ? 9 : G; });
    return {
      w, h: y, cx, term,
      draw(ox, oy, out) {
        chs.forEach((c, i) => {
          const [x, yy] = pos[i];
          c.draw(ox + x, oy + yy, out);
          if (i < chs.length - 1 && !c.term) path(out, [[ox + cx, oy + yy + c.h], [ox + cx, oy + pos[i + 1][1]]], !chs[i + 1].add);
        });
      }
    };
  }
  function ifChunk(text, line, T, E, elseIsIf) {
    const D = nsize('dec', text);
    const leftT = Math.max(D.w / 2, T ? T.cx : 0);
    const rightT = Math.max(D.w / 2, T ? T.w - T.cx : 0);
    const cx = leftT;
    const ex = E ? cx + rightT + GX + E.cx : cx + rightT + GX;
    const tTop = D.h + G;
    const eTop = E ? (elseIsIf ? 0 : D.h / 2 + G) : 0;
    const tBottom = T ? tTop + T.h : D.h;
    const eBottom = E ? eTop + E.h : D.h / 2;
    const term = !!(T && T.term && E && E.term);
    const mergeY = Math.max(tBottom, eBottom) + G;
    const w = Math.max(cx + rightT, E ? ex - E.cx + E.w : ex + 6);
    const h = term ? Math.max(tBottom, eBottom) : mergeY;
    return {
      w, h, cx, term, dw: D.w,
      draw(ox, oy, out) {
        out.push(shape('dec', ox + cx - D.w / 2, oy, D.w, D.h, text, line));
        const rx = ox + cx + D.w / 2, my = oy + D.h / 2;
        // Ya
        if (T) { path(out, [[ox + cx, oy + D.h], [ox + cx, oy + tTop]], true); T.draw(ox + cx - T.cx, oy + tTop, out); }
        label(out, ox + cx + 6, oy + D.h + 15, 'Ya');
        // Tidak
        label(out, rx + 6, my - 6, 'Tidak');
        if (E && elseIsIf) { path(out, [[rx, my], [ox + ex - E.dw / 2, my]], true); E.draw(ox + ex - E.cx, oy + eTop, out); }
        else if (E) { path(out, [[rx, my], [ox + ex, my], [ox + ex, oy + eTop]], true); E.draw(ox + ex - E.cx, oy + eTop, out); }
        if (term) return;
        const MY = oy + mergeY;
        if (!T) path(out, [[ox + cx, oy + D.h], [ox + cx, MY]], false);
        else if (!T.term) path(out, [[ox + cx, oy + tBottom], [ox + cx, MY]], false);
        if (!E) path(out, [[rx, my], [ox + ex, my], [ox + ex, MY], [ox + cx + 4, MY]], true);
        else if (!E.term) path(out, [[ox + ex, oy + eBottom], [ox + ex, MY], [ox + cx + 4, MY]], true);
        out.push(`<circle cx="${Math.round(ox + cx)}" cy="${Math.round(MY)}" r="3.2" class="fc-dot"/>`);
      }
    };
  }
  function loopChunk(text, line, B) {
    const D = nsize('dec', text);
    const LG = 30, RG = 30;
    const cx = Math.max(D.w / 2, B ? B.cx : 0) + LG;
    const right = Math.max(D.w / 2, B ? B.w - B.cx : 0) + RG;
    const bTop = D.h + G;
    const bBottom = B ? bTop + B.h : D.h;
    const backY = bBottom + 18;
    const exitY = backY + 22;
    return {
      w: cx + right, h: exitY, cx, term: false,
      draw(ox, oy, out) {
        out.push(shape('dec', ox + cx - D.w / 2, oy, D.w, D.h, text, line));
        const my = oy + D.h / 2, lx = ox + 10, rx = ox + cx + right - 10;
        if (B) { path(out, [[ox + cx, oy + D.h], [ox + cx, oy + bTop]], true); B.draw(ox + cx - B.cx, oy + bTop, out); }
        label(out, ox + cx + 6, oy + D.h + 15, 'Ya');
        if (!B || !B.term) path(out, [[ox + cx, oy + bBottom], [ox + cx, oy + backY], [lx, oy + backY], [lx, my], [ox + cx - D.w / 2, my]], true, 'fc-edge fc-back');
        label(out, ox + cx + D.w / 2 + 6, my - 6, 'Tidak');
        path(out, [[ox + cx + D.w / 2, my], [rx, my], [rx, oy + exitY], [ox + cx + 4, oy + exitY]], true);
        out.push(`<circle cx="${Math.round(ox + cx)}" cy="${Math.round(oy + exitY)}" r="3.2" class="fc-dot"/>`);
      }
    };
  }
  function hasUserCall(e, funcs) { let f = false; walkExpr(e, x => { if (x.k === 'call' && funcs[x.name]) f = true; }); return f; }
  /* EDIT: mode rakit, setiap sambungan diberi tombol + bernama "<konteks>@<posisi>" */
  let EDIT = false;
  function addLeaf(id) {
    const w = 22, h = 22;
    return { w, h, cx: w / 2, term: false, add: true, draw(ox, oy, out) {
      const x = Math.round((ox + 11) * 10) / 10, y = Math.round((oy + 11) * 10) / 10;
      out.push(`<g class="fc-add" data-add="${id}" role="button" tabindex="0" aria-label="Tambah simbol di sini"><title>Tambah simbol di sini</title><circle cx="${x}" cy="${y}" r="10"/><path d="M${x},${y - 5} v10 M${x - 5},${y} h10"/></g>`);
    } };
  }
  function chunkOf(stmts, funcs, ctx) {
    const parts = [], edit = EDIT && ctx;
    if (edit) parts.push(addLeaf(ctx + '@0'));
    let j = 0;
    for (const s of stmts) { if (s.k === 'comment') continue; parts.push(stmtChunk(s, funcs)); j++; if (edit) parts.push(addLeaf(ctx + '@' + j)); }
    return seq(parts);
  }
  function stmtChunk(s, funcs) {
    switch (s.k) {
      case 'assign': return leaf(hasUserCall(s.expr, funcs) ? 'sub' : 'proc', stmtText(s), s.line);
      case 'append': return leaf('proc', stmtText(s), s.line);
      case 'call': return leaf('sub', stmtText(s), s.line);
      case 'input': case 'output': return leaf('io', stmtText(s), s.line);
      case 'return': return leaf('ret', stmtText(s), s.line);
      case 'if': return ifFrom(s, 0, funcs);
      case 'while': return loopChunk(pp(s.cond) + '?', s.line, chunkOf(s.body, funcs, s.line + ':body'));
      case 'for': {
        const neg = s.step && s.step.k === 'num' && s.step.v < 0;
        const stepTxt = s.step ? (neg ? `- ${fmtNum(-s.step.v)}` : `+ ${pp(s.step)}`) : '+ 1';
        return seq([leaf('proc', `${s.var} ← ${pp(s.from)}`, s.line),
          loopChunk(`${s.var} ${neg ? '≥' : '≤'} ${pp(s.to)}?`, s.line, seq([chunkOf(s.body, funcs, s.line + ':body'), leaf('proc', `${s.var} ← ${s.var} ${stepTxt}`, s.line)]))]);
      }
      case 'foreach': return loopChunk(`ada ${s.var} lagi DALAM ${pp(s.iter)}?`, s.line, chunkOf(s.body, funcs, s.line + ':body'));
    }
    return null;
  }
  function ifFrom(s, i, funcs) {
    const b = s.branches[i];
    const T = chunkOf(b.body, funcs, b.line + ':yes');
    let E = null, elseIsIf = false;
    if (i + 1 < s.branches.length) { E = ifFrom(s, i + 1, funcs); elseIsIf = true; }
    else if (EDIT || (s.elseBody && s.elseBody.some(x => x.k !== 'comment'))) E = chunkOf(s.elseBody || [], funcs, b.line + ':no');
    return ifChunk(pp(b.cond) + '?', b.line, T, E, elseIsIf);
  }
  let svgSeq = 0;
  function renderChart(chunk) {
    const pad = 18;
    const W = Math.ceil(chunk.w + pad * 2), H = Math.ceil(chunk.h + pad * 2);
    const out = [];
    chunk.draw(pad, pad, out);
    const id = 'ah' + (++svgSeq);
    const body = out.join('').replace(/url\(#AH\)/g, `url(#${id})`);
    return { w: W, h: H, svg: `<svg xmlns="http://www.w3.org/2000/svg" class="fc-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"><defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" class="fc-ah"/></marker></defs>${body}</svg>` };
  }
  /* Kerangka flowchart untuk mode Susun: posisi simbol dicatat, isinya dikosongkan */
  function flowPuzzle(prog) {
    SINK = [];
    let charts, slots;
    try {
      charts = flowcharts(prog);
      slots = SINK;
    } finally { SINK = null; }
    charts.forEach((c, i) => {
      const ids = (c.svg.match(/data-slot="\d+"/g) || []).map(m => +m.replace(/\D/g, ''));
      c.slots = ids;
      ids.forEach(id => { slots[id].chart = i; });
    });
    return { charts, slots };
  }
  /* Flowchart program utama dengan tombol + di setiap sambungan (untuk tab Rakit) */
  function flowEdit(prog) {
    EDIT = true;
    try { return flowcharts(prog).filter(c => c.kind === 'main'); } finally { EDIT = false; }
  }
  function flowcharts(prog) {
    const charts = [];
    if (!prog.main.empty || EDIT) {
      const body = chunkOf(prog.main.body, prog.funcs, 'main');
      const c = seq([leaf('term', 'MULAI', prog.main.line), body, (body && body.term) ? null : leaf('term', 'SELESAI', prog.main.endLine)]);
      charts.push(Object.assign({ title: 'Program utama', kind: 'main' }, renderChart(c)));
    }
    prog.order.filter(x => x.k === 'func').forEach(fn => {
      const body = chunkOf(fn.body, prog.funcs);
      const head = `${fn.kind} ${fn.name}(${fn.params.join(', ')})`;
      const c = seq([leaf('term', head, fn.line), body, (body && body.term) ? null : leaf('term', 'AKHIR ' + fn.kind, fn.endLine)]);
      charts.push(Object.assign({ title: head, kind: 'func' }, renderChart(c)));
    });
    return charts;
  }

  /* ───────────────────── syntax highlight ───────────────────── */
  const PY_KW = new Set('def return if elif else for in while import and or not True False None break from pass'.split(' '));
  const PY_BI = new Set('print input len range int float str abs round math random'.split(' '));
  function highlight(src, lang) {
    const lines = normalize(src).split('\n');
    const e = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return lines.map(L => {
      let out = '', i = 0;
      while (i < L.length) {
        const c = L[i];
        if (c === '#') { out += `<span class="t-com">${e(L.slice(i))}</span>`; break; }
        if (c === '"' || c === "'") { let j = L.indexOf(c, i + 1); if (j < 0) j = L.length - 1; out += `<span class="t-str">${e(L.slice(i, j + 1))}</span>`; i = j + 1; continue; }
        if (lang === 'py' && (c === 'f') && (L[i + 1] === '"' || L[i + 1] === "'")) { const qq = L[i + 1]; let j = L.indexOf(qq, i + 2); if (j < 0) j = L.length - 1; out += `<span class="t-str">${e(L.slice(i, j + 1))}</span>`; i = j + 1; continue; }
        const rest = L.slice(i);
        let m = /^\d+(\.\d+)?/.exec(rest);
        if (m && !/[A-Za-z_]/.test(L[i - 1] || '')) { out += `<span class="t-num">${m[0]}</span>`; i += m[0].length; continue; }
        m = /^[A-Za-z_À-ÖØ-öø-ɏ][A-Za-z0-9_À-ÖØ-öø-ɏ]*/.exec(rest);
        if (m) {
          const w = m[0];
          let cls = '';
          if (lang === 'py') cls = PY_KW.has(w) ? 't-kw' : PY_BI.has(w) ? 't-fn' : '';
          else cls = KEYWORDS.has(w) ? 't-kw' : BUILTINS.includes(w.toUpperCase()) && rest[w.length] === '(' ? 't-fn' : '';
          out += cls ? `<span class="${cls}">${w}</span>` : w; i += w.length; continue;
        }
        if (c === '←' || (c === '<' && L[i + 1] === '-' && lang !== 'py')) { const t = c === '←' ? '←' : '&lt;-'; out += `<span class="t-op">${t}</span>`; i += c === '←' ? 1 : 2; continue; }
        out += e(c); i++;
      }
      return out;
    }).join('\n');
  }

  const API = { lex, parse, createRun, runHeadless, callHeadless, toPython, flowcharts, flowPuzzle, flowEdit, shapeInner, fitText, highlight, pp, stmtText, fmt, fmtNum, coerceInput, deepEq, stats, walk, LabError, NONE, KEYWORDS, BUILTINS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LabCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
