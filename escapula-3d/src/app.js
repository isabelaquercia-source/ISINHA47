/* ============================================================================
   Escápula Viva 3D — src/app.js
   Cena, câmera, luzes, laço de animação e a API `window.EVAPP` (SPEC seção 7).

   EVAPP.ready (Promise) · timings · errors · stats() · parts · state · quality
   EVAPP.setState(parcial) · setCamera(cam) · getCamera() · setVisible({only?, hide?})
   EVAPP.shot({cam, state, only, hide, width, height, markers}) → dataURL PNG (síncrono)
   Extras: EVAPP.setBreathing(bool) · setMarkers(bool) · setTint(bool) · invalidate() ·
           EVAPP.cameras (vistas nomeadas) · EVAPP.three {renderer, scene, camera}
           window.EV_QUALITY (0.3..1), se definido ANTES deste script, força ctx.quality (para testar o celular)
   Sem WebGL: EVAPP.errors recebe 'webgl: …', `ready` resolve e todos os métodos existem como no-op.
   ============================================================================ */
(() => {
'use strict';
const T = THREE, EV = window.EV;
const canvas = document.getElementById('ev-canvas');
const DEG = Math.PI / 180;
const now = () => (window.performance && performance.now ? performance.now() : Date.now());

/* Vistas nomeadas. az: 0 = reto por trás, positivo = câmera indo para a direita do corpo; el = elevação (graus).
   roll (extra, opcional) = giro da câmera em torno do eixo de visão, em graus (a imagem gira no sentido horário).
   'ref' é a vista da imagem de referência (prancha 876 × 1200), que tem a câmera levemente inclinada. */
const CAMS = {
  ref:   {az: 31.4, el: 8.1, dist: 110, target: [14.4, 33.5, 0], fov: 36.6, roll: 2.7},
  back:  {az: 0, el: 4, dist: 185, target: [0, 31, 0], fov: 28},
  front: {az: 180, el: 4, dist: 185, target: [0, 31, 0], fov: 28},
  right: {az: 90, el: 4, dist: 185, target: [0, 31, 0], fov: 28},
  left:  {az: -90, el: 4, dist: 185, target: [0, 31, 0], fov: 28},
  top:   {az: 0, el: 89, dist: 150, target: [0, 36, -2], fov: 28}
};

const APP = window.EVAPP = {
  timings: {}, errors: [], parts: {}, cameras: CAMS,
  state: {elev: 0, retr: 0, rot: 0, breath: 0},
  quality: 1
};
let resolveReady; APP.ready = new Promise(ok => { resolveReady = ok; });

/* qualidade: 1 no desktop … 0.6 no celular (as peças escalam a resolução das malhas por ela) */
try {
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width || 1e4, screen.height || 1e4) < 720;
  APP.quality = (coarse && small) ? 0.6 : coarse ? 0.8 : 1;
} catch (e) { /* fica 1 */ }
if (typeof window.EV_QUALITY === 'number' && window.EV_QUALITY > 0) APP.quality = EV.clamp(window.EV_QUALITY, 0.3, 1);   // extra: força a qualidade (testes)

/* ------------------------------------------------------------------- renderer */
let renderer;
try {
  renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true});
} catch (e) {
  APP.errors.push('webgl: ' + (e && e.message || e));
  /* sem WebGL a API inteira continua existindo (no-op), para a interface não quebrar na primeira chamada */
  for (const k of ['setCamera', 'setVisible', 'setBreathing', 'setMarkers', 'setTint', 'invalidate']) APP[k] = () => {};
  APP.setState = parcial => { Object.assign(APP.state, parcial || {}); };
  APP.getCamera = () => ({az: 0, el: 0, dist: 0, fov: 0, roll: 0, target: [0, 0, 0]});
  APP.markers = []; APP.breathing = false; APP.three = null; APP.noWebGL = true;
  APP.shot = () => ''; APP.stats = () => ({triangles: 0, drawCalls: 0});
  resolveReady(); return;
}
renderer.outputEncoding = T.sRGBEncoding;
/* Curva de tons própria (THREE.CustomToneMapping): linear até o joelho K e, dali em diante, um ombro exponencial
   que tende a 1 sem nunca chegar — o marfim iluminado fica quase branco sem estourar no fundo da prancha e o
   meio-tom sai como o material o definiu (cada EV.mats traz o seu ganho e a sua compressão; o ACES acinzentava
   o osso). */
const TONE_STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
if (T.ShaderChunk.tonemapping_pars_fragment.indexOf(TONE_STUB) >= 0){
  T.ShaderChunk.tonemapping_pars_fragment = T.ShaderChunk.tonemapping_pars_fragment.replace(TONE_STUB, [
    'vec3 CustomToneMapping( vec3 color ) {',
    '  const float K = 0.55;',
    '  color = max(color * toneMappingExposure, vec3(0.0));',
    '  vec3 ombro = K + (1.0 - K) * (1.0 - exp(-(color - K) / (1.0 - K)));',
    '  return mix(color, ombro, step(vec3(K), color));',
    '}'].join('\n'));
  renderer.toneMapping = T.CustomToneMapping;
} else renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);                       // fundo transparente: a cor da prancha vem do CSS

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(28, 876 / 1200, 5, 900);
APP.three = {renderer, scene, camera};

/* ---------------------------------------------------------------------- luzes
   Estúdio suave, como na referência: luz principal de cima e um pouco da ESQUERDA da câmera, com sombra de
   contato macia; céu claro e chão bege amplos; um preenchimento fraco vindo da própria câmera e outro lateral,
   pela esquerda. As intensidades somam o mesmo que antes sobre uma superfície de frente para a câmera — o corpo
   fantasma (que não passa pela curva de tons) depende delas. O que dá o aspecto de atlas (o que olha para baixo
   esfria, o lado de dentro do gradil escurece, o brilho largo de porcelana, o traço de contorno) é feito nos
   materiais (EV.mats, em core.js). O conjunto gira com o azimute da câmera, para a luz acompanhar quem olha. */
const rig = new T.Group(); scene.add(rig);
const hemi = new T.HemisphereLight(new T.Color(1.0, 0.99, 0.96), new T.Color(0.60, 0.57, 0.52), 0.50); scene.add(hemi);
const key = new T.DirectionalLight(new T.Color(1.0, 0.96, 0.88), 0.95);
key.position.set(-30, 96, 110); key.castShadow = true;
/* mapa de sombra PEQUENO de propósito: com o filtro PCF suave cada texel (~0,15 cm) vira penumbra — a sombra de
   contato sai macia, de estúdio (nunca dura nem preta), e custa menos que o mapa de 2048² */
const SM = APP.quality < 1 ? 512 : 640;
key.shadow.mapSize.set(SM, SM);
const sc = key.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 52; sc.bottom = -52; sc.near = 20; sc.far = 360;
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.16;
const fill = new T.DirectionalLight(new T.Color(1.0, 0.98, 0.96), 0.10); fill.position.set(8, 12, 120);     // da própria câmera
const back = new T.DirectionalLight(new T.Color(1.0, 0.97, 0.92), 0.14); back.position.set(-112, 26, 38);   // lateral esquerda: abre o lado que a principal não alcança
for (const l of [key, fill, back]){ l.target.position.set(0, 32, 0); rig.add(l); rig.add(l.target); }
rig.position.set(0, 0, 0);

/* --------------------------------------------------------------------- câmera */
const cam = {az: 0, el: 0, dist: 100, target: new T.Vector3(), fov: 28, roll: 0};
function camFrom(c){
  if (typeof c === 'string'){ if (!CAMS[c]) throw new Error('EVAPP: câmera desconhecida ' + c); c = CAMS[c]; }
  return c || {};
}
function applyCam(){
  const a = cam.az * DEG, e = cam.el * DEG, ce = Math.cos(e);
  camera.position.set(cam.target.x + cam.dist * Math.sin(a) * ce, cam.target.y + cam.dist * Math.sin(e), cam.target.z + cam.dist * Math.cos(a) * ce);
  camera.up.set(0, 1, 0); camera.lookAt(cam.target);
  if (cam.roll) camera.rotateZ(cam.roll * DEG);
  camera.fov = cam.fov; camera.near = Math.max(2, cam.dist * 0.08); camera.far = cam.dist + 500;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  rig.rotation.y = a; rig.updateMatrixWorld(true);
}
APP.setCamera = c => {
  const nomeada = typeof c === 'string';
  c = camFrom(c);
  /* roll: vale o declarado; uma vista nomeada ou um objeto que define a direção (az/el) sem roll sai reto —
     assim {az, el, dist, target, fov} dá a mesma imagem aqui e em shot(), venha de que vista vier */
  if (c.roll !== undefined) cam.roll = c.roll;
  else if (nomeada || c.az !== undefined || c.el !== undefined) cam.roll = 0;
  if (c.az !== undefined) cam.az = c.az;
  if (c.el !== undefined) cam.el = c.el;
  if (c.dist !== undefined) cam.dist = c.dist;
  if (c.fov !== undefined) cam.fov = c.fov;
  if (c.target) cam.target.set(c.target[0], c.target[1], c.target[2]);
  applyCam(); invalidate();
};
APP.getCamera = () => ({az: cam.az, el: cam.el, dist: cam.dist, fov: cam.fov, roll: cam.roll, target: cam.target.toArray()});

/* ---------------------------------------------------------- tamanho da tela */
let pixelRatio = 1;
/* espessura do traço de contorno dos materiais (EV.mats.look.px), proporcional à altura do canvas em pixels reais:
   1,3 px na prancha de 1200 px de altura; nunca abaixo de 0,9 px, para não sumir em telas pequenas */
function setLine(hpx){ if (EV.mats && EV.mats.look && EV.mats.look.px) EV.mats.look.px.value = Math.max(0.9, 1.3 * hpx / 1200); }
function fit(){
  const w = Math.max(2, canvas.clientWidth || 876), h = Math.max(2, canvas.clientHeight || Math.round(w * 1200 / 876));
  pixelRatio = Math.min(window.devicePixelRatio || 1, APP.quality < 1 ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix(); setLine(h * pixelRatio); invalidate();
}

/* -------------------------------------------------------------------- estado */
let dirty = true;
function invalidate(){ dirty = true; }
APP.invalidate = invalidate;
const order = [];                                           // nomes das peças, na ordem de construção
const updErr = {};
function applyState(){
  const st = APP.state;
  for (const n of order){
    const p = APP.parts[n];
    if (p && p.update){ try { p.update(st); } catch (e) { if (!updErr[n]){ updErr[n] = 1; APP.errors.push(n + ' (update): ' + (e && e.message || e)); } } }
  }
  if (tintOn) applyTint();
  placeMarkers();
}
APP.setState = parcial => { Object.assign(APP.state, parcial || {}); applyState(); invalidate(); };
APP.setVisible = o => {
  o = o || {};
  for (const n of order){ const p = APP.parts[n]; if (p && p.group) p.group.visible = (!o.only || o.only.indexOf(n) >= 0) && !(o.hide && o.hide.indexOf(n) >= 0); }
  placeMarkers(); invalidate();
};

/* tinge os músculos pelo alongamento: vermelho = encurtado, azul = esticado.
   Materiais de EV.mats (têm userData.evTint) recebem a tinta MISTURADA no shader — o azul aparece azul mesmo sobre
   a textura laranja. Outros materiais: emissive na cor da tinta + cor de base esmaecida. */
let tintOn = false;
/* o vermelho é um carmim (puxado para o magenta): um vermelho-alaranjado mal se distinguia do laranja do músculo */
const TINT_RED = [0.88, 0.02, 0.085, 0.72], TINT_BLUE = [0.03, 0.20, 1.0, 0.80];          // r, g, b lineares + mistura máxima
const _c0 = new T.Color();
function applyTint(){
  for (const n of order){
    const p = APP.parts[n]; if (!p || !p.tint) continue;
    let s = 0; if (tintOn && p.strain){ try { s = p.strain(APP.state) || 0; } catch (e) { s = 0; } }
    const k = EV.clamp(Math.abs(s) / 0.22, 0, 1), c = s < 0 ? TINT_RED : TINT_BLUE;
    for (const m of p.tint){
      if (!m) continue;
      const u = m.userData && m.userData.evTint;
      if (u && u.value && u.value.isVector4){ u.value.set(c[0], c[1], c[2], k * c[3]); continue; }
      if (!m.color) continue;
      const ud = m.userData || (m.userData = {});
      if (!ud.evBase) ud.evBase = {color: m.color.clone(), emissive: m.emissive ? m.emissive.clone() : null};
      m.color.copy(ud.evBase.color).multiplyScalar(1 - 0.55 * k);
      if (m.emissive) m.emissive.copy(ud.evBase.emissive).lerp(_c0.setRGB(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5), k);
    }
  }
}
APP.setTint = on => { tintOn = !!on; applyTint(); invalidate(); };

/* ------------------------------------------------------- marcadores numerados
   Como na prancha: disco cinza-azulado escuro (#4a4f57, ~95% opaco) com o número em branco, sem contorno claro.
   O sprite mede 1,5 cm (o disco ocupa 87,5% dele: ~2,4% da largura da prancha na vista ref; a interface pode
   aumentá-lo em telas pequenas). A textura tem 256 px com mipmaps, para ficar nítida em telas de alta densidade. */
const markers = new T.Group(); markers.visible = false; scene.add(markers);
const markerList = [];
function markerSprite(n){
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  x.beginPath(); x.arc(S / 2, S / 2, S * 0.4375, 0, 7); x.fillStyle = 'rgba(74,79,87,.95)'; x.fill();
  x.fillStyle = '#fff'; x.font = '500 146px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const tx = String(n), mt = x.measureText(tx);
  /* centra pelo desenho real do número (não pela caixa da fonte) */
  const asc = mt.actualBoundingBoxAscent || 105, desc = mt.actualBoundingBoxDescent || 0;
  const esq = mt.actualBoundingBoxLeft || 0, dir = mt.actualBoundingBoxRight || mt.width;
  x.fillText(tx, S / 2 + (esq - dir) / 2, S / 2 + (asc - desc) / 2);
  const map = new T.CanvasTexture(cv); map.encoding = T.sRGBEncoding; map.anisotropy = 4;
  const sp = new T.Sprite(new T.SpriteMaterial({map, depthTest: false, depthWrite: false, transparent: true, toneMapped: false}));
  sp.map = map;
  sp.scale.set(1.5, 1.5, 1); sp.renderOrder = 999;
  return sp;
}
function placeMarkers(){
  for (const m of markerList){
    const g = APP.parts[m.part] && APP.parts[m.part].group;
    m.sprite.visible = !g || g.visible;
    try { const p = m.def.pos(APP.state); if (p) m.sprite.position.copy(p); } catch (e) { m.sprite.visible = false; }
  }
}
APP.setMarkers = on => { markers.visible = !!on; invalidate(); };
APP.markers = markerList;

/* --------------------------------------------------- construção das peças */
function prepare(group){
  group.traverse(o => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (ms.some(m => m && m.vertexColors)) EV.mesh.ensureColor(o.geometry);          // sem `color` a malha sairia preta
    if (ms.some(m => m && m.userData && m.userData.ghost)){ o.renderOrder = -10; o.castShadow = false; o.receiveShadow = false; }
  });
}
function buildPart(nome){
  const t0 = now();
  try {
    const inst = EV.parts[nome]({THREE: T, EV, quality: APP.quality});
    if (!inst || !inst.group) throw new Error('a fábrica não devolveu {group}');
    prepare(inst.group);
    APP.parts[nome] = inst; order.push(nome); scene.add(inst.group);
    if (inst.update) inst.update(APP.state);
    for (const def of inst.markers || []){ const sprite = markerSprite(def.n); markers.add(sprite); markerList.push({part: nome, def, sprite}); }
  } catch (e) {
    APP.errors.push(nome + ': ' + (e && (e.stack || e.message) || e).toString().split('\n').slice(0, 3).join(' | '));
  }
  APP.timings[nome] = Math.round(now() - t0);
}
/* Triângulos e malhas visíveis da cena (contados nas geometrias, sem a passada de sombra). */
APP.stats = () => {
  let tri = 0, calls = 0;
  scene.traverseVisible(o => { if (o.isMesh && o.geometry){ const g = o.geometry; tri += (g.index ? g.index.count : g.attributes.position.count) / 3; calls++; } });
  return {triangles: Math.round(tri), drawCalls: calls};
};

/* ----------------------------------------------------------------- animação */
let breathing = false, breathT0 = 0;
APP.setBreathing = on => { breathing = !!on; breathT0 = now(); if (!breathing) APP.setState({breath: 0}); invalidate(); };
Object.defineProperty(APP, 'breathing', {get: () => breathing});
const BREATH_PERIOD = 4600;                                // ms por ciclo (inspira ~40%, expira ~60%)
function breathCurve(ms){
  const u = (ms % BREATH_PERIOD) / BREATH_PERIOD;
  return u < 0.4 ? 0.5 - 0.5 * Math.cos(Math.PI * u / 0.4) : 0.5 + 0.5 * Math.cos(Math.PI * (u - 0.4) / 0.6);
}
function render(){ renderer.render(scene, camera); }
function frame(){
  requestAnimationFrame(frame);
  if (breathing && built){ APP.state.breath = breathCurve(now() - breathT0); applyState(); dirty = true; }
  if (!dirty) return;
  dirty = false; render();
}

/* ---------------------------------------------------------------------- shot
   Síncrono: tamanho exato em pixels (pixelRatio 1), câmera/estado/visibilidade pedidos, um quadro sem animação.
   Depois restaura o que estava na tela. */
APP.shot = o => {
  o = o || {};
  const w = o.width || 876, h = o.height || 1200;
  const keep = {cam: APP.getCamera(), state: Object.assign({}, APP.state), vis: order.map(n => APP.parts[n].group.visible), mk: markers.visible, size: renderer.getSize(new T.Vector2()), pr: renderer.getPixelRatio()};
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; setLine(h);
  APP.setCamera(o.cam || 'ref');
  Object.assign(APP.state, {elev: 0, retr: 0, rot: 0, breath: 0}, o.state || {});   // no lugar: EVAPP.state é sempre o mesmo objeto
  APP.setVisible({only: o.only, hide: o.hide});
  markers.visible = !!o.markers;
  applyState(); render();
  const url = canvas.toDataURL('image/png');
  /* restaura */
  renderer.setPixelRatio(keep.pr); renderer.setSize(keep.size.x, keep.size.y, false); camera.aspect = keep.size.x / Math.max(1, keep.size.y); setLine(keep.size.y * keep.pr);
  APP.setCamera(keep.cam);
  for (const k in APP.state) if (!(k in keep.state)) delete APP.state[k];
  Object.assign(APP.state, keep.state);
  order.forEach((n, i) => { APP.parts[n].group.visible = keep.vis[i]; });
  markers.visible = keep.mk; applyState(); invalidate();
  return url;
};

/* ------------------------------------------------- órbita (arraste) e zoom */
const ptr = new Map(); let pinch0 = 0, dist0 = 0;
const EL_MIN = -35, EL_MAX = 89, D_MIN = 35, D_MAX = 420;
canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', e => {
  ptr.set(e.pointerId, {x: e.clientX, y: e.clientY});
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
  if (ptr.size === 2){ const p = [...ptr.values()]; pinch0 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); dist0 = cam.dist; }
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', e => {
  const p = ptr.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptr.size === 1){
    const k = 180 / Math.max(240, canvas.clientWidth);                 // arrastar a largura inteira ≈ meia volta
    cam.az -= dx * k; cam.el = EV.clamp(cam.el + dy * k, EL_MIN, EL_MAX);
    cam.roll *= 0.9; if (Math.abs(cam.roll) < 0.02) cam.roll = 0;      // ao girar, a câmera se endireita aos poucos
    applyCam(); invalidate();
  } else if (ptr.size === 2 && pinch0 > 0){
    const q = [...ptr.values()], d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y);
    cam.dist = EV.clamp(dist0 * pinch0 / Math.max(8, d), D_MIN, D_MAX); applyCam(); invalidate();
  }
});
const pointerUp = e => { ptr.delete(e.pointerId); pinch0 = 0; if (!ptr.size) canvas.style.cursor = 'grab'; };
canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
const _ray = new T.Vector3(), _hit = new T.Vector3(), _fwd = new T.Vector3();
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const nd = EV.clamp(cam.dist * Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.0012)), D_MIN, D_MAX), k = nd / cam.dist;
  /* zoom na direção do ponteiro: o ponto sob o cursor (no plano do alvo) fica parado */
  const r = canvas.getBoundingClientRect();
  _ray.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  camera.getWorldDirection(_fwd);
  _hit.copy(camera.position).addScaledVector(_ray, cam.dist / Math.max(0.2, _ray.dot(_fwd)));
  cam.target.sub(_hit).multiplyScalar(k).add(_hit); cam.dist = nd;
  applyCam(); invalidate();
}, {passive: false});
canvas.addEventListener('dblclick', () => APP.setCamera('ref'));

/* --------------------------------------------------------------------- início */
let built = false;
APP.setCamera('ref');
fit();
if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas); else window.addEventListener('resize', fit);
requestAnimationFrame(frame);
/* constrói uma peça por tarefa (a página não trava e dá para mostrar progresso em EVAPP.onProgress) */
const nomes = Object.keys(EV.parts);
let ni = 0;
(function next(){
  if (ni < nomes.length){
    buildPart(nomes[ni++]);
    if (typeof APP.onProgress === 'function'){ try { APP.onProgress(ni / nomes.length, nomes[ni - 1]); } catch (e) { /* ignora */ } }
    invalidate(); setTimeout(next, 0); return;
  }
  built = true; applyState(); invalidate(); resolveReady();
})();
})();
