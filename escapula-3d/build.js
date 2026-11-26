#!/usr/bin/env node
/* Junta src/shell.html + src/core.js + src/parts/*.js + src/app.js + src/ui.js num único index.html (o artefato).
   Cada arquivo vira a sua própria tag <script>, então um erro de sintaxe num arquivo não derruba os outros. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = __dirname;
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

function sources(){
  const parts = fs.readdirSync(path.join(ROOT, 'src/parts')).filter(f => f.endsWith('.js')).sort().map(f => 'src/parts/' + f);
  return ['src/core.js', ...parts, 'src/app.js', 'src/ui.js'].filter(f => fs.existsSync(path.join(ROOT, f)));
}
/* Devolve [{file, error}] com os erros de sintaxe de cada fonte. */
function check(){
  const out = [];
  for (const f of sources()){
    try { new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), {filename: f}); }
    catch (e) { out.push({file: f, error: String(e && e.stack || e).split('\n').slice(0, 5).join('\n')}); }
  }
  return out;
}
function build(){
  const shell = fs.readFileSync(path.join(ROOT, 'src/shell.html'), 'utf8');
  if (!shell.includes('<!--EV:SCRIPTS-->')) throw new Error('src/shell.html precisa conter <!--EV:SCRIPTS-->');
  const tags = [`<script src="${THREE_URL}"></script>`];
  for (const f of sources()){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script/gi, '<\\/script');
    tags.push(`<script>/* ${f} */\n${src}\n</script>`);
  }
  return shell.replace('<!--EV:SCRIPTS-->', tags.join('\n'));
}
module.exports = {build, check, sources, THREE_URL, ROOT};
if (require.main === module){
  const errs = check(); for (const e of errs) console.error('SYNTAX ' + e.file + '\n' + e.error);
  const html = build(); fs.writeFileSync(path.join(ROOT, 'index.html'), html);
  console.log('index.html', (html.length/1024).toFixed(0) + ' KB', sources().length + ' fontes', errs.length ? errs.length + ' com erro de sintaxe' : 'ok');
}
