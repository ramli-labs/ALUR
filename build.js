// Menyusun index.html mandiri dari berkas di folder src/
// Jalankan: node build.js
const fs = require('fs'), path = require('path');
const S = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const html = S('shell.html')
  .replace('/*STYLE*/', () => S('style.css'))
  .replace('/*CORE*/', () => safe(S('core.js')))
  .replace('/*DATA*/', () => safe(S('data.js')))
  .replace('/*CHECK*/', () => safe(S('check.js')))
  .replace('/*APP*/', () => safe(S('app.js')));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html ditulis (' + (html.length / 1024).toFixed(1) + ' KB)');
