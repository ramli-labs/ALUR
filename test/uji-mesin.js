// Uji mesin pseudocode tanpa peramban: node test/uji-mesin.js
const assert = require('assert');
global.LabCore = require('../src/core.js');
const Core = global.LabCore;
const { EXAMPLES, MISSIONS } = require('../src/data.js');
const { checkMission } = require('../src/check.js');
let ok = 0;
const t = (name, fn) => { try { fn(); ok++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.message); process.exitCode = 1; } };
const run = (src, inputs) => Core.runHeadless(Core.parse(src), inputs || []);
const outs = r => r.out.filter(o => o.kind === 'out').map(o => o.text);

console.log('Contoh modul');
t('rata-rata dengan nilai sentinel', () => assert.deepStrictEqual(outs(run(EXAMPLES.find(e => e.id === 'rata').code, ['80', '90', '70', '-1'])), ['Rata-rata: 80', 'Total siswa: 3']));
t('faktorial 4 = 24', () => assert.deepStrictEqual(outs(run(EXAMPLES.find(e => e.id === 'faktorial').code, ['4'])), ['24']));
t('FizzBuzz 100 baris', () => { const o = outs(run(EXAMPLES.find(e => e.id === 'fizzbuzz').code)); assert.strictEqual(o.length, 100); assert.strictEqual(o[14], 'FizzBuzz'); });
t('bilangan prima ≤ 50', () => assert.deepStrictEqual(outs(run(EXAMPLES.find(e => e.id === 'prima').code)), ['[2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]']));
t('bubble sort', () => assert.deepStrictEqual(outs(run(EXAMPLES.find(e => e.id === 'bubble').code)), ['Hasil urut: [1, 2, 3, 5, 8, 9]']));
t('login menunjukkan bug counter_gagal', () => { const r = run(EXAMPLES.find(e => e.id === 'login').code, ['budi', '0000']); assert.ok(!r.ok && /counter_gagal/.test(r.error.message)); });
t('scope: variabel lokal tidak dikenal di luar fungsi', () => { const r = run(EXAMPLES.find(e => e.id === 'scope').code); assert.ok(!r.ok && /lokal/.test(r.error.message)); });
t('semua contoh bisa digambar flowchart-nya', () => EXAMPLES.forEach(e => assert.ok(Core.flowcharts(Core.parse(e.code)).length > 0)));

console.log('Aturan bahasa');
t('MOD mengikuti Python untuk bilangan negatif', () => assert.deepStrictEqual(outs(run('MULAI\n  OUTPUT -3 MOD 2\nSELESAI')), ['1']));
t('indeks dimulai dari 1', () => assert.deepStrictEqual(outs(run('MULAI\n  d ← [7, 8, 9]\n  OUTPUT d[1]\nSELESAI')), ['7']));
t('indeks 0 memberi pesan yang jelas', () => { const r = run('MULAI\n  d ← [7]\n  OUTPUT d[0]\nSELESAI'); assert.ok(/elemen pertama adalah \[1\]/.test(r.error.message)); });
t('kata kunci huruf kecil ditolak dengan petunjuk', () => assert.throws(() => Core.parse('MULAI\n  jika x > 1 MAKA\n  AKHIR JIKA\nSELESAI'), /KAPITAL/));
t('= sebagai penugasan ditolak dengan petunjuk', () => assert.throws(() => Core.parse('MULAI\n  x = 5\nSELESAI'), /←/));
t('JIKA belum ditutup', () => assert.throws(() => Core.parse('MULAI\n  JIKA 1 = 1 MAKA\n    OUTPUT 1\nSELESAI'), /AKHIR JIKA/));
t('pengulangan tanpa akhir dihentikan', () => { const r = Core.runHeadless(Core.parse('MULAI\n  i ← 1\n  SELAMA i ≤ 5\n    OUTPUT i\n  AKHIR SELAMA\nSELESAI'), [], { maxSteps: 5000 }); assert.ok(!r.ok && /tanpa akhir/.test(r.error.message)); });
t('konversi Python: range dan indeks', () => { const py = Core.toPython(Core.parse('MULAI\n  d ← [1, 2]\n  UNTUK i DARI 1 HINGGA PANJANG(d)\n    OUTPUT "Nilai " + d[i]\n  AKHIR UNTUK\nSELESAI')); assert.ok(py.includes('for i in range(1, len(d) + 1):')); assert.ok(py.includes('print(f"Nilai {d[i - 1]}")')); });

console.log('Misi LKPD (kerangka awal harus belum lulus)');
MISSIONS.filter(m => !m.kind).forEach(m => t(`${m.id} ${m.title}`, () => assert.strictEqual(checkMission(m, m.starter).passed, false)));

console.log(`\n${ok} uji lulus.`);
