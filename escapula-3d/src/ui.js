/* ============================================================================
   Escápula Viva 3D — src/ui.js
   Os controles da página em volta do canvas. Conversa com o 3D só pela API `window.EVAPP` (src/app.js):
   câmera (getCamera/setCamera), estado (setState), visibilidade (setVisible), números, respiração e tinta.
   Nada aqui roda em laço contínuo: os quadros só são pedidos enquanto existe uma transição em curso.
   ============================================================================ */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const plate = $('ev-plate'), canvas = $('ev-canvas');
if (!plate || !canvas) return;
const APP = window.EVAPP;
const DEG = Math.PI / 180;
const now = () => (window.performance && performance.now ? performance.now() : Date.now());
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);          // entra e sai suave
const calmo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

/* ------------------------------------------------------------ sem 3D
   `rede` = o three.js nem chegou (a página foi aberta sem conexão); senão, o aparelho não abriu o WebGL. */
function semTresD(rede){
  plate.classList.add('is-fail'); plate.removeAttribute('aria-busy');
  $('ev-page').classList.add('no3d');
  $('ev-fail').hidden = false;
  if (rede){ $('ev-fail-tit').textContent = 'O modelo 3D não carregou.'; $('ev-fail-txt').textContent = 'Confira a conexão e abra a página de novo.'; }
  for (const id of ['ev-sec-keys', 'ev-sec-move']) $(id).hidden = true;                // sem modelo, não há o que mexer
  for (const b of document.querySelectorAll('.leg-head')){ b.disabled = true; b.style.cursor = 'default'; const a = b.querySelector('.leg-act'); if (a) a.hidden = true; }
  for (const p of document.querySelectorAll('.leg-now')) p.hidden = true;
  $('ev-hint').hidden = true;
}
if (!APP || !APP.ready || !window.EV || !window.THREE){ semTresD(true); return; }
const webglFalhou = () => !!APP.noWebGL || (APP.errors || []).some(e => /^webgl:/.test(e));
if (webglFalhou()){ semTresD(false); return; }

/* ------------------------------------------------------- quadros sob demanda */
const anims = new Set(); let raf = 0;
function quadro(){
  raf = 0; const t = now();
  for (const a of Array.from(anims)) if (a(t) === false) anims.delete(a);
  if (anims.size) raf = requestAnimationFrame(quadro);
}
function animar(a){ anims.add(a); if (!raf) raf = requestAnimationFrame(quadro); return a; }

/* ===================================================================== câmera */
const CAMS = APP.cameras || {};
const EL_MIN = -35, EL_MAX = 89, D_MIN = 35, D_MAX = 420;                              // os mesmos limites do arraste (app.js)
const btnRef = $('ev-view-ref'), boxViews = $('ev-views');
const btnViews = Array.from(boxViews.querySelectorAll('[data-view]'));
const voltaAz = d => ((d % 360) + 540) % 360 - 180;                                    // diferença de azimute pelo caminho curto
function perto(c, v){
  if (!v) return false;
  const t = v.target || [0, 0, 0];
  return Math.abs(voltaAz(c.az - v.az)) < 0.6 && Math.abs(c.el - v.el) < 0.6 && Math.abs(c.dist - v.dist) < 1.2 &&
    Math.abs(c.fov - v.fov) < 0.3 && Math.abs((c.roll || 0) - (v.roll || 0)) < 0.4 &&
    Math.hypot(c.target[0] - t[0], c.target[1] - t[1], c.target[2] - t[2]) < 0.8;
}
let pronto = false, camAnim = null, camAlvo = '';

/* As vistas "De trás" e "De lado" do app centram o modelo, e a cabeça cairia por baixo da legenda do canto. Aqui o alvo
   da câmera desliza para o lado o bastante para a cabeça ficar à esquerda da legenda (o tamanho do modelo não muda).
   A conta usa a caixa do crânio e a posição real da legenda na tela; é refeita quando a prancha muda de tamanho. */
const keyBox = $('ev-key');
let caixaCabeca = null, vistasCache = {};
function inicioLegenda(){                              // fração da largura do canvas onde a legenda começa (1 = não cobre o desenho)
  try {
    const k = keyBox.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    if (!k.width || !c.width || k.left >= c.right - 4 || k.top >= c.bottom) return 1;
    return clamp((k.left - c.left) / c.width, 0, 1);
  } catch (e) { return 1; }
}
function vista(nome){
  const v = CAMS[nome];
  if (!v || nome === 'ref') return v;
  if (vistasCache[nome]) return vistasCache[nome];
  let r = v;
  try {
    const ini = inicioLegenda();
    if (ini < 1){
      const a = v.az * DEG, dx = Math.cos(a), dz = -Math.sin(a), t = v.target || [0, 0, 0];          // direita da tela, no mundo
      const larg = 2 * v.dist * Math.tan(v.fov * DEG / 2) * canvas.clientWidth / Math.max(1, canvas.clientHeight);
      let cab = 8;                                                                       // sem crânio: meia largura de uma cabeça
      const g = APP.parts.skull && APP.parts.skull.group;
      if (g){
        if (!caixaCabeca){ g.updateMatrixWorld(true); caixaCabeca = new window.THREE.Box3().setFromObject(g); }
        const b = caixaCabeca, m = Math.max((b.min.x - t[0]) * dx, (b.max.x - t[0]) * dx) + Math.max((b.min.z - t[2]) * dz, (b.max.z - t[2]) * dz);
        if (isFinite(m)) cab = m;
      }
      const d = clamp(cab + 1.5 - (ini - 0.5) * larg, 0, 0.2 * larg);
      if (d > 0.5) r = Object.assign({}, v, {target: [t[0] + dx * d, t[1], t[2] + dz * d]});
    }
  } catch (e) { r = v; }
  return (vistasCache[nome] = r);
}

/* Números legíveis: o app desenha os marcadores com tamanho fixo em centímetros; numa prancha estreita (celular) ou
   com a câmera longe eles ficam com uns 9 px. Aqui eles só AUMENTAM, até o mínimo legível na tela, conforme o
   tamanho real do canvas e a distância da câmera (de perto, voltam ao tamanho que o app deu). */
const marcBase = new Map();
function ajustarMarcadores(){
  try {
    const lista = APP.markers, h = canvas.clientHeight;
    if (!lista || !lista.length || !h) return;
    const c = APP.getCamera(), pxPorCm = h / (2 * c.dist * Math.tan(c.fov * DEG / 2));
    const minPx = clamp(canvas.clientWidth * 0.036, 22, 30);                             // lado do sprite; o disco visível tem ~87% disso
    let mudou = false;
    for (const m of lista){
      const sp = m && m.sprite; if (!sp || !sp.scale) continue;
      if (!marcBase.has(sp)) marcBase.set(sp, sp.scale.x);
      const b = marcBase.get(sp), s = clamp(minPx / pxPorCm, b, b * 3);
      if (Math.abs(sp.scale.x - s) > 0.004){ sp.scale.set(s, s, 1); mudou = true; }
    }
    if (mudou) APP.invalidate();
  } catch (e) { /* os marcadores ficam como o app os fez */ }
}
function sincVista(){
  if (!pronto) return;
  const c = APP.getCamera();
  const naRef = perto(c, CAMS.ref);
  btnRef.hidden = naRef || (!!camAnim && camAlvo === 'ref');
  plate.classList.toggle('is-away', !naRef);
  ajustarMarcadores();
  for (const b of btnViews) b.setAttribute('aria-pressed', String(camAlvo === b.dataset.view || (!camAnim && perto(c, vista(b.dataset.view)))));
}
function pararCam(){ if (camAnim){ anims.delete(camAnim); camAnim = null; camAlvo = ''; } }
/* Vai para uma vista nomeada interpolando az, el, fov, roll, alvo e o TAMANHO aparente (a distância sai dele e do fov:
   assim o modelo não "respira" no meio do caminho quando a vista de chegada tem outra lente). */
function irPara(nome){
  const v = vista(nome); if (!v) return;
  if (camAnim && camAlvo === nome) return;
  pararCam();
  const a = APP.getCamera(), dur = calmo() ? 0 : 650;
  const daz = voltaAz(v.az - a.az), rollB = v.roll || 0;
  const hA = a.dist * Math.tan(a.fov * DEG / 2), hB = v.dist * Math.tan(v.fov * DEG / 2), tB = v.target || [0, 0, 0];
  const t0 = now();
  camAlvo = nome;
  camAnim = animar(t => {
    const k = dur ? clamp((t - t0) / dur, 0, 1) : 1;
    if (k >= 1){ APP.setCamera(Object.assign({roll: 0}, v)); camAnim = null; camAlvo = ''; sincVista(); return false; }
    const e = ease(k), fov = lerp(a.fov, v.fov, e), h = hA * Math.pow(hB / hA, e);
    APP.setCamera({az: a.az + daz * e, el: lerp(a.el, v.el, e), fov, dist: h / Math.tan(fov * DEG / 2), roll: lerp(a.roll || 0, rollB, e),
      target: [lerp(a.target[0], tB[0], e), lerp(a.target[1], tB[1], e), lerp(a.target[2], tB[2], e)]});
    sincVista();
  });
  sincVista();
}
btnRef.addEventListener('click', () => { irPara('ref'); canvas.focus({preventScroll: true}); });
for (const b of btnViews) b.addEventListener('click', () => irPara(b.dataset.view));

/* o arraste, a pinça e a roda são do app.js; aqui só se acompanha o resultado (e um arraste interrompe a transição) */
let toques = 0, tap = {t: 0, x: 0, y: 0}, down = null;
canvas.addEventListener('pointerdown', e => {
  pararCam(); toques++;
  down = toques === 1 ? {t: e.timeStamp || now(), x: e.clientX, y: e.clientY, tipo: e.pointerType} : null;
});
canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || e.buttons) sincVista(); });
const soltou = e => {
  toques = Math.max(0, toques - 1); sincVista();
  /* dois toques rápidos no mesmo lugar voltam à vista original (o dblclick do navegador não é confiável no toque).
     A hora é a do evento (e.timeStamp), não a de quando o código rodou: um quadro lento não estraga a contagem. */
  if (e.type !== 'pointerup' || !down || down.tipo === 'mouse'){ down = null; return; }
  const t = e.timeStamp || now(), curto = t - down.t < 300 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12;
  down = null;
  if (!curto){ tap.t = 0; return; }
  if (t - tap.t < 380 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 40){ tap.t = 0; irPara('ref'); }
  else tap = {t, x: e.clientX, y: e.clientY};
};
canvas.addEventListener('pointerup', soltou); canvas.addEventListener('pointercancel', soltou);
canvas.addEventListener('wheel', () => { pararCam(); sincVista(); }, {passive: true});
/* o duplo clique do app.js pula direto para a vista; interceptado aqui (na captura, antes dele) para voltar com transição */
plate.addEventListener('dblclick', e => { if (e.target === canvas){ e.stopPropagation(); irPara('ref'); } }, true);

/* teclado no canvas: setas giram, + e − aproximam, 0 (ou Home) volta */
canvas.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const c = APP.getCamera(); let mexeu = true;
  switch (e.key){
    case 'ArrowLeft': c.az += 6; break;
    case 'ArrowRight': c.az -= 6; break;
    case 'ArrowUp': c.el = clamp(c.el + 4, EL_MIN, EL_MAX); break;
    case 'ArrowDown': c.el = clamp(c.el - 4, EL_MIN, EL_MAX); break;
    case '+': case '=': c.dist = clamp(c.dist / 1.1, D_MIN, D_MAX); break;
    case '-': case '_': c.dist = clamp(c.dist * 1.1, D_MIN, D_MAX); break;
    case '0': case 'Home': e.preventDefault(); irPara('ref'); return;
    default: mexeu = false;
  }
  if (!mexeu) return;
  e.preventDefault(); pararCam();
  c.roll = Math.abs(c.roll) < 0.3 ? 0 : c.roll * 0.6;                                  // como no arraste: a câmera se endireita
  APP.setCamera(c); sincVista();
});

/* ============================================================ peças escondidas */
const MUSC = {1: 'levator', 2: 'rhomboids', 3: 'rhomboids', 4: 'serratus'};
const PECAS_MUSC = ['levator', 'rhomboids', 'serratus'];
let corpoOn = true, sel = 0;                                                            // sel: 0 = todos; 1..4 = só aquele músculo
function aplicarVisiveis(){
  const hide = [];
  if (!corpoOn) hide.push('body');
  if (sel) for (const p of PECAS_MUSC) if (p !== MUSC[sel]) hide.push(p);
  APP.setVisible({hide});
  soUmRomboide();
}

/* Romboide menor × maior: a peça `rhomboids` traz as duas lâminas no mesmo grupo e não diz qual malha é qual.
   Para o "ver só este" mostrar uma só, descobre-se a dona de cada número pelos marcadores (o ponto de cada um fica
   sobre a sua lâmina): vale o par de geometrias que deixa os DOIS marcadores mais perto, e só se ganhar com folga
   do par trocado. Se não der para separar com segurança, as duas aparecem juntas. */
let romb = null;                                                                        // {2: [malhas], 3: [malhas]} · false = não separa
function separarRomboides(){
  if (romb !== null) return romb;
  romb = false;
  try {
    const malhas = [], geos = [], pt = {};
    for (const m of APP.markers || []) if (m.part === 'rhomboids' && m.def && (m.def.n === 2 || m.def.n === 3)) pt[m.def.n] = m.def.pos(APP.state).clone();
    APP.parts.rhomboids.group.updateMatrixWorld(true);
    APP.parts.rhomboids.group.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position){ malhas.push(o); if (geos.indexOf(o.geometry) < 0) geos.push(o.geometry); } });
    if (!pt[2] || !pt[3] || geos.length < 2) return romb;
    /* distância de cada marcador ao vértice mais próximo de cada geometria (em qualquer das malhas que a usam) */
    const dist = n => geos.map(g => {
      let d2 = Infinity;
      for (const o of malhas){
        if (o.geometry !== g) continue;
        const q = o.worldToLocal(pt[n].clone()), a = g.attributes.position;
        for (let i = 0; i < a.count; i++){ const d = (a.getX(i) - q.x) ** 2 + (a.getY(i) - q.y) ** 2 + (a.getZ(i) - q.z) ** 2; if (d < d2) d2 = d; }
      }
      return Math.sqrt(d2);
    });
    const d2 = dist(2), d3 = dist(3);
    let melhor = null, soma = Infinity;
    for (let a = 0; a < geos.length; a++) for (let b = 0; b < geos.length; b++) if (a !== b && d2[a] + d3[b] < soma){ soma = d2[a] + d3[b]; melhor = [a, b]; }
    if (!melhor || soma > 5 || d2[melhor[1]] + d3[melhor[0]] < soma * 1.5) return romb;   // longe demais ou empate: não arrisca
    romb = {2: malhas.filter(o => o.geometry === geos[melhor[0]]), 3: malhas.filter(o => o.geometry === geos[melhor[1]])};
  } catch (e) { romb = false; }
  return romb;
}
function soUmRomboide(){
  const um = sel === 2 || sel === 3;
  if (!um && !romb) return;                                                             // nada foi separado ainda: nada a desfazer
  const r = pronto ? separarRomboides() : false; if (!r) return;
  try {
    for (const n of [2, 3]) for (const o of r[n]) o.visible = !um || sel === n;
    for (const m of APP.markers) if (m.part === 'rhomboids' && m.sprite && m.sprite.material) m.sprite.material.opacity = um && m.def.n !== sel ? 0 : 1;
    APP.invalidate();
  } catch (e) { /* fica como o app mostrou */ }
}

/* ============================================================ leitura ao vivo */
function medir(peca, cache){
  if (peca in cache) return cache[peca];
  let s = null;
  try { const p = APP.parts[peca]; if (p && p.strain){ s = Number(p.strain(APP.state)); if (!isFinite(s)) s = null; } } catch (e) { s = null; }
  return (cache[peca] = s);
}
function frase(s){
  const pct = Math.min(99, Math.round(Math.abs(s) * 100));
  return pct < 1 ? {txt: 'em repouso', cls: ''} : s < 0 ? {txt: 'encurtado ' + pct + '%', cls: 'is-short'} : {txt: 'alongado ' + pct + '%', cls: 'is-long'};
}
const ultimo = {};
function leituras(){
  const cache = {};
  for (let n = 1; n <= 4; n++){
    const s = medir(MUSC[n], cache), f = s === null ? null : frase(s), assinatura = (f ? f.txt : '-') + (sel === n ? '*' : '');
    if (ultimo[n] === assinatura) continue;
    ultimo[n] = assinatura;
    const p = $('ev-now-' + n), k = $('ev-key-now-' + n);
    p.hidden = !f; k.hidden = !f || sel !== n;
    if (!f) continue;
    p.className = 'leg-now ' + f.cls; p.lastElementChild.textContent = f.txt;
    k.className = 'key-now ' + f.cls; k.textContent = f.txt;
  }
}
let leituraPedida = false;
function pedirLeituras(){
  if (leituraPedida) return; leituraPedida = true;
  animar(() => { leituraPedida = false; leituras(); return false; });
}

/* =================================================================== legenda */
const itens = Array.from(document.querySelectorAll('[data-muscle]'));
function selecionar(n){
  sel = sel === n ? 0 : n;
  for (const b of itens){
    const on = Number(b.dataset.muscle) === sel;
    b.setAttribute('aria-pressed', String(on));
    const a = b.querySelector('.leg-act'); if (a) a.textContent = on ? 'mostrar todos' : 'ver só este';
  }
  keyBox.classList.toggle('has-sel', !!sel);
  aplicarVisiveis(); leituras();
}
for (const b of itens) b.addEventListener('click', () => selecionar(Number(b.dataset.muscle)));

/* ==================================================================== chaves */
function chave(id, inicial, fn){
  const b = $(id); let on = inicial;
  b.setAttribute('aria-pressed', String(on));
  b.addEventListener('click', () => { on = !on; b.setAttribute('aria-pressed', String(on)); fn(on); });
  return () => on;
}
const numerosOn = chave('ev-t-num', true, on => APP.setMarkers(on));
chave('ev-t-body', true, on => { corpoOn = on; aplicarVisiveis(); });
let respTimer = 0;
chave('ev-t-breath', false, on => {
  APP.setBreathing(on);
  clearInterval(respTimer); respTimer = 0;
  if (on) respTimer = setInterval(leituras, 250);                                      // a respiração mexe nas leituras; só enquanto ligada
  else pedirLeituras();
});
chave('ev-t-tint', false, on => { APP.setTint(on); $('ev-tint-key').hidden = !on; });

/* ========================================================== mover a escápula */
const EIXOS = {
  elev: {min: -1, pos: 'sobe', neg: 'desce'},
  retr: {min: -1, pos: 'junta', neg: 'afasta'},
  rot: {min: 0, pos: 'gira', neg: ''}
};
const PRESETS = {
  rest: {elev: 0, retr: 0, rot: 0},
  shrug: {elev: 1, retr: 0.1, rot: 0.1},
  retract: {elev: 0, retr: 1, rot: 0},
  push: {elev: 0, retr: -1, rot: 0.25},
  raise: {elev: 0.35, retr: -0.3, rot: 1}
};
const btnPresets = Array.from(document.querySelectorAll('[data-preset]'));
for (const k in EIXOS){ EIXOS[k].el = $('ev-' + k); EIXOS[k].out = $('ev-' + k + '-out'); }
function sincControles(){
  const st = APP.state;
  for (const k in EIXOS){
    const x = EIXOS[k], v = clamp(Number(st[k]) || 0, x.min, 1), f = (v - x.min) / (1 - x.min), f0 = (0 - x.min) / (1 - x.min);
    if (Number(x.el.value) !== v) x.el.value = String(v);
    x.el.style.setProperty('--lo', Math.min(f, f0).toFixed(4)); x.el.style.setProperty('--hi', Math.max(f, f0).toFixed(4));
    const pct = Math.round(Math.abs(v) * 100), txt = pct < 1 ? 'repouso' : (v > 0 ? x.pos : x.neg) + ' ' + pct + '%';
    if (x.out.textContent !== txt) x.out.textContent = txt;
    x.el.setAttribute('aria-valuetext', txt);
  }
  for (const b of btnPresets){
    const p = PRESETS[b.dataset.preset];
    b.setAttribute('aria-pressed', String(Math.abs(st.elev - p.elev) < 0.006 && Math.abs(st.retr - p.retr) < 0.006 && Math.abs(st.rot - p.rot) < 0.006));
  }
}
let estAnim = null;
function pararEstado(){ if (estAnim){ anims.delete(estAnim); estAnim = null; } }
function moverPara(alvo){
  pararEstado();
  const de = {elev: APP.state.elev, retr: APP.state.retr, rot: APP.state.rot}, dur = calmo() ? 0 : 700, t0 = now();
  estAnim = animar(t => {
    const k = dur ? clamp((t - t0) / dur, 0, 1) : 1, e = ease(k);
    APP.setState(k >= 1 ? alvo : {elev: lerp(de.elev, alvo.elev, e), retr: lerp(de.retr, alvo.retr, e), rot: lerp(de.rot, alvo.rot, e)});
    sincControles(); leituras();
    if (k >= 1){ estAnim = null; return false; }
  });
}
for (const b of btnPresets) b.addEventListener('click', () => moverPara(Object.assign({}, PRESETS[b.dataset.preset])));
/* no teclado cada seta anda 5% (o passo fino de 1% é para o arraste) e Page Up / Page Down andam 25% */
const PASSOS = new Map([['ArrowRight', 0.05], ['ArrowUp', 0.05], ['ArrowLeft', -0.05], ['ArrowDown', -0.05], ['PageUp', 0.25], ['PageDown', -0.25]]);
for (const k in EIXOS){
  const el = EIXOS[k].el, min = EIXOS[k].min;
  const mexer = v => { pararEstado(); const o = {}; o[k] = clamp(v, min, 1); APP.setState(o); sincControles(); pedirLeituras(); };
  el.addEventListener('input', () => mexer(Number(el.value) || 0));
  el.addEventListener('keydown', e => {
    const passo = PASSOS.get(e.key);
    if (!passo || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    mexer(Math.round(((Number(el.value) || 0) + passo) * 20) / 20);                    // cai sempre num múltiplo de 5%
  });
}

/* ================================================================== montagem */
const barra = $('ev-bar'), faixa = $('ev-loading');
const total = Math.max(1, Object.keys((window.EV && window.EV.parts) || {}).length);
function progresso(f){ barra.style.transform = 'scaleX(' + clamp(f, 0.04, 1).toFixed(3) + ')'; }
progresso(Object.keys(APP.timings || {}).length / total);                               // o app já pode ter começado
APP.onProgress = f => { progresso(f); aplicarVisiveis(); ajustarMarcadores(); };       // peça nova: segue o que já foi escolhido
APP.setMarkers(numerosOn());
sincControles();
APP.ready.then(() => {
  if (webglFalhou()){ semTresD(false); return; }
  pronto = true;
  plate.removeAttribute('aria-busy');
  progresso(1); faixa.classList.add('is-done');
  setTimeout(() => { faixa.hidden = true; }, calmo() ? 0 : 380);
  boxViews.hidden = false;
  APP.setMarkers(numerosOn()); aplicarVisiveis(); sincControles(); leituras(); sincVista();
  const mudouTamanho = () => { vistasCache = {}; ajustarMarcadores(); sincVista(); };
  if (window.ResizeObserver) new ResizeObserver(mudouTamanho).observe(canvas); else window.addEventListener('resize', mudouTamanho);
  canvas.addEventListener('webglcontextrestored', () => { try { APP.setState({}); APP.invalidate(); } catch (e) { /* o app redesenha no próximo quadro */ } });
});
})();
