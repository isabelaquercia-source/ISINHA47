/* ============================================================================
   Escápula Viva 3D — src/core.js
   Biblioteca compartilhada `window.EV`: utilidades, coluna, crânio, costelas,
   tórax, cinemática da escápula, malhas (SDF, tubo, lâmina) e materiais.

   Sistema de coordenadas (cm): +X = direita do corpo, +Y = para cima,
   +Z = posterior. Y = 0 no topo do sacro (junção L5/S1). Plano mediano X = 0.
   Tudo é calculado para o lado DIREITO e espelhado em X para o esquerdo.

   Além do contrato da SPEC, este arquivo oferece alguns extras opcionais
   (marcados com "extra:" nos comentários). Nenhum nome do contrato foi mudado.

   DADOS COMPARTILHADOS (somente leitura): os Vector3/Quaternion que são CAMPOS
   — EV.spine.v(n).pos / .quat / .spinousTip, EV.skull.center / .quat / .inion,
   EV.sternum.notch / .angle / .xiphoid e todos os pontos de EV.scap.L — são um
   único objeto para todas as peças e ficam CONGELADOS (Object.freeze): um
   .add()/.lerp()/.applyMatrix4() direto neles não tem efeito (ou lança erro em
   modo estrito). Use .clone() ou copie para um vetor seu (meu.copy(campo)).
   Tudo o que vem de uma FUNÇÃO (tpTip(), mastoid(), sc(), medial(), toWorld(),
   matrix(), ribs.point()…) já é cópia nova e pode ser modificado à vontade.
   ============================================================================ */
(() => {
'use strict';
const T = THREE;

/* ------------------------------------------------------------------ utilidades */
const V = (x, y, z) => new T.Vector3(x, y, z);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;

const frz = o => Object.freeze(o);                                // ver "DADOS COMPARTILHADOS" no topo
const EV = window.EV = {
  parts: {},
  register(nome, fabrica){ this.parts[nome] = fabrica; },
  V, clamp, lerp, smoothstep,
  REST: Object.freeze({elev: 0, retr: 0, rot: 0, breath: 0})
};

/* Curva Catmull-Rom centrípeta. `at(t)` e `tangent(t)` usam t proporcional ao comprimento de arco (0..1).
   Os dois aceitam um Vector3 de destino opcional (para não alocar em laços de animação). */
EV.curve = (pontos, fechado) => {
  const c = new T.CatmullRomCurve3(pontos.map(p => p.clone()), !!fechado, 'centripetal');
  c.arcLengthDivisions = Math.max(48, pontos.length * 12);
  const length = c.getLength();
  return {
    length,
    at: (t, alvo) => c.getPointAt(clamp(t, 0, 1), alvo || new T.Vector3()),
    tangent: (t, alvo) => c.getTangentAt(clamp(t, 0, 1), alvo || new T.Vector3())
  };
};

/* Interpolação cúbica de Hermite 1D por nós (xs crescente) — usada na curva sagital da coluna. */
function hermite1D(xs, ys){
  const n = xs.length, m = new Array(n);
  for (let i = 0; i < n; i++){
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    m[i] = (ys[b] - ys[a]) / (xs[b] - xs[a]);
  }
  const f = (x, deriv) => {
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = clamp((x - xs[i]) / h, -0.5, 1.5), u2 = u * u, u3 = u2 * u;
    if (deriv) return ((6*u2 - 6*u) * ys[i] + (3*u2 - 4*u + 1) * h * m[i] + (-6*u2 + 6*u) * ys[i+1] + (3*u2 - 2*u) * h * m[i+1]) / h;
    return (2*u3 - 3*u2 + 1) * ys[i] + (u3 - 2*u2 + u) * h * m[i] + (-2*u3 + 3*u2) * ys[i+1] + (u3 - u2) * h * m[i+1];
  };
  return f;
}

/* Ponto de uma Catmull-Rom centrípeta no trecho k (entre P[k] e P[k+1]), u em 0..1. Escreve em `out`. */
const _cr0 = V(0,0,0), _cr3 = V(0,0,0);
function crPoint(P, k, u, out){
  const n = P.length, p1 = P[k], p2 = P[k + 1];
  const p0 = k > 0 ? P[k - 1] : _cr0.copy(p1).multiplyScalar(2).sub(p2);
  const p3 = k + 2 < n ? P[k + 2] : _cr3.copy(p2).multiplyScalar(2).sub(p1);
  let d1 = Math.pow(p0.distanceToSquared(p1), 0.25), d2 = Math.pow(p1.distanceToSquared(p2), 0.25), d3 = Math.pow(p2.distanceToSquared(p3), 0.25);
  if (d2 < 1e-4) d2 = 1; if (d1 < 1e-4) d1 = d2; if (d3 < 1e-4) d3 = d2;
  const u2 = u * u, u3 = u2 * u;
  const h = (a0, a1, a2, a3) => {
    const t1 = ((a1 - a0) / d1 - (a2 - a0) / (d1 + d2) + (a2 - a1) / d2) * d2;
    const t2 = ((a2 - a1) / d2 - (a3 - a1) / (d2 + d3) + (a3 - a2) / d3) * d2;
    return a1 + t1 * u + (-3 * a1 + 3 * a2 - 2 * t1 - t2) * u2 + (2 * a1 - 2 * a2 + t1 + t2) * u3;
  };
  return out.set(h(p0.x, p1.x, p2.x, p3.x), h(p0.y, p1.y, p2.y, p3.y), h(p0.z, p1.z, p2.z, p3.z));
}

/* ====================================================================== COLUNA
   A linha dos centros dos corpos vertebrais é uma curva no plano sagital, parametrizada pelo comprimento de arco
   `s` a partir do topo do sacro (s = 0). As vértebras são empilhadas ao longo dela pelas suas alturas. */
const LEVELS = [];
for (let i = 1; i <= 7; i++) LEVELS.push('C' + i);
for (let i = 1; i <= 12; i++) LEVELS.push('T' + i);
for (let i = 1; i <= 5; i++) LEVELS.push('L' + i);
LEVELS.push('S1');

/* altura (corpo + disco) de cada nível, em cm */
const ALT = {C1: 1.5, C2: 2.2, C3: 1.7, C4: 1.7, C5: 1.7, C6: 1.75, C7: 1.95, S1: 3.0};
for (let k = 0; k < 12; k++) ALT['T' + (k + 1)] = 1.95 + 0.77 * k / 11;          // T1 1,95 … T12 2,72 (total ≈ 28)
[3.5, 3.55, 3.6, 3.65, 3.7].forEach((h, k) => { ALT['L' + (k + 1)] = h; });      // total 18
/* fatores por região (cervical, torácica, lombar) para as proporções do modelo da referência */
const ESCALA = {C: 1.02, T: 1.065, L: 0.965};
for (const n in ALT) if (n !== 'S1') ALT[n] *= ESCALA[n[0]];

/* z (posterior +) do centro do corpo nos níveis de controle da curva sagital (lordoses negativas, cifose positiva) */
const SAG = {S1: 0.8, L5: -1.3, L4: -2.2, L3: -2.7, L2: -2.5, L1: -1.9, T12: -0.65, T10: 0.58, T8: 1.88, T7: 2.26, T6: 2.39,
             T4: 1.88, T2: 0.78, T1: 0.19, C7: 0.1, C5: -0.6, C4: -0.8, C2: -0.7, C1: -0.6};

/* ponta do processo espinhoso em coordenadas locais da vértebra: [dy (cranial+), dz (posterior+)] */
const ESPINHOSO = {C1: [0, 2.6], C2: [-1.1, 4.8], C3: [-0.5, 3.9], C4: [-0.6, 4.0], C5: [-0.7, 4.2], C6: [-0.7, 4.4], C7: [-0.65, 5.5],
  T1: [-0.9, 5.5], T2: [-1.4, 5.6], T3: [-1.9, 5.6], T4: [-2.3, 5.5], T5: [-2.7, 5.4], T6: [-2.9, 5.3], T7: [-3.0, 5.3],
  T8: [-2.9, 5.4], T9: [-2.5, 5.5], T10: [-1.9, 5.6], T11: [-1.2, 5.7], T12: [-0.7, 5.8],
  L1: [-0.2, 7.3], L2: [-0.3, 7.4], L3: [-0.7, 7.4], L4: [-0.6, 7.3], L5: [-1.7, 6.6], S1: [-0.6, 3.4]};

/* ponta do processo transverso (lado direito) em coordenadas locais: [dx, dy, dz] */
const TRANSVERSO = {C1: [4.85, 0, 0.3], C2: [3.0, -0.2, 0.4], C3: [3.0, 0, 0.2], C4: [3.05, 0, 0.2], C5: [3.1, 0, 0.2], C6: [3.2, 0, 0.3], C7: [3.5, 0, 0.7],
  T1: [3.9, 0.3, 2.0], T2: [3.7, 0.3, 2.3], T3: [3.55, 0.3, 2.5], T4: [3.45, 0.3, 2.6], T5: [3.4, 0.3, 2.6], T6: [3.4, 0.3, 2.6], T7: [3.4, 0.3, 2.6],
  T8: [3.35, 0.3, 2.6], T9: [3.25, 0.3, 2.6], T10: [3.0, 0.2, 2.5], T11: [2.6, 0.1, 2.3], T12: [2.3, 0, 2.0],
  L1: [3.7, 0, 1.2], L2: [4.2, 0, 1.2], L3: [4.7, 0, 1.2], L4: [4.4, 0, 1.2], L5: [4.6, -0.1, 1.0], S1: [7.0, 1.0, -1.0]};

const spine = EV.spine = {levels: LEVELS.slice()};
(() => {
  /* posição `s` do centro de cada nível (subindo a partir do topo do sacro) */
  const sC = {S1: -ALT.S1 / 2};
  let s = 0;
  for (let i = LEVELS.length - 2; i >= 0; i--){ const n = LEVELS[i]; sC[n] = s + ALT[n] / 2; s += ALT[n]; }
  const sTop = s;
  /* nós da curva z(s) */
  const ks = [-ALT.S1 - 1.5, sC.S1, 0], kz = [SAG.S1 + 1.4, SAG.S1, 0];
  for (let i = LEVELS.length - 2; i >= 0; i--){ const n = LEVELS[i]; if (SAG[n] !== undefined){ ks.push(sC[n]); kz.push(SAG[n]); } }
  ks.push(sTop + 2.5); kz.push(SAG.C1 + 0.5);
  const zOf = hermite1D(ks, kz);
  /* y(s) integrando sqrt(1 − z'²) (a curva está parametrizada pelo comprimento de arco) */
  const ds = 0.02, yUp = [0], yDown = [0];
  const dy = x => Math.sqrt(Math.max(0.2, 1 - Math.pow(zOf(x, true), 2)));
  for (let x = 0; x < sTop + 3; x += ds) yUp.push(yUp[yUp.length - 1] + dy(x + ds / 2) * ds);
  for (let x = 0; x > -ALT.S1 - 2; x -= ds) yDown.push(yDown[yDown.length - 1] - dy(x - ds / 2) * ds);
  const yOf = x => { const a = x >= 0 ? yUp : yDown, f = Math.abs(x) / ds, i = Math.min(a.length - 2, Math.floor(f)); return lerp(a[i], a[i + 1], f - i); };
  /* extra: ponto e tangente da linha da coluna num `s` qualquer (cm a partir do topo do sacro) */
  spine.at = x => { const tz = zOf(x, true), ty = dy(x); const k = 1 / Math.hypot(ty, tz); return {pos: V(0, yOf(x), zOf(x)), tangent: V(0, ty * k, tz * k)}; };
  spine.sOf = n => sC[n];
  spine.length = sTop;

  const recs = {};
  LEVELS.forEach((name, index) => {
    const region = name[0], num = +name.slice(1), a = spine.at(sC[name]);
    const ey = a.tangent, ez = V(0, -ey.z, ey.y), ex = V(1, 0, 0);
    const quat = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(ex, ey, ez));
    const bodyR = region === 'C' ? (num === 1 ? 1.0 : num === 2 ? 0.9 : 0.85 + 0.05 * (num - 3)) :
                  region === 'T' ? 1.35 + 0.65 * (num - 1) / 11 : region === 'L' ? 2.4 + 0.08 * (num - 1) : 2.8;
    /* atenção: pos, quat e spinousTip são compartilhados por todos (congelados) — clone antes de modificar */
    const rec = {name, index, region, num, pos: frz(a.pos), quat: frz(quat), height: ALT[name], bodyR, s: sC[name]};
    /* extra: local(x, y, z) → Vector3 no mundo (eixos locais: +X direita, +Y cranial ao longo da coluna, +Z posterior) */
    rec.local = (x, y, z) => V(x, y, z).applyQuaternion(quat).add(rec.pos);
    rec.spinousTip = frz(rec.local(0, ESPINHOSO[name][0], ESPINHOSO[name][1]));
    const tp = TRANSVERSO[name], tpR = rec.local(tp[0], tp[1], tp[2]), tpL = rec.local(-tp[0], tp[1], tp[2]);
    rec.tpTip = side => (side < 0 ? tpL : tpR).clone();
    recs[name] = rec;
  });
  spine.v = nome => { const r = recs[nome]; if (!r) throw new Error('EV.spine.v: nível desconhecido ' + nome); return r; };
})();

/* ====================================================================== CRÂNIO
   Eixos locais do crânio: +X direita, +Y para cima, +Z posterior; origem no centro da calota; unidade = cm × scale. */
(() => {
  const c1 = spine.v('C1'), scale = 1.05;
  const center = V(0, c1.pos.y + 8.45, c1.pos.z - 0.6), quat = new T.Quaternion();
  const local = (x, y, z) => V(x, y, z).multiplyScalar(scale).applyQuaternion(quat).add(center);
  EV.skull = {center: frz(center), quat: frz(quat), scale, local,                       // extra: local(x,y,z) → mundo
    inion: frz(local(0, -3.3, 8.6)),
    mastoid: side => local((side < 0 ? -1 : 1) * 5.5, -6.6, 2.6)};
})();

/* ==================================================================== COSTELAS
   Cada costela é uma Catmull-Rom por 9 pontos de controle: cabeça, tubérculo, ângulo, 2 intermediários, ponto mais
   lateral, 2 intermediários e extremidade anterior. A respiração gira os pontos em torno do eixo cabeça→tubérculo
   (o eixo do colo): nas costelas de cima isso levanta a frente ("braço de bomba"), nas de baixo abre a lateral
   ("alça de balde"). */
/* W = meia-largura máxima; drop = queda até a extremidade; Dp = profundidade ântero-posterior (a partir do centro do
   corpo vertebral) da extremidade; xcc = distância da extremidade à linha média; xa = distância do ângulo à linha média;
   insp = rotação (graus) em torno do eixo do colo na inspiração completa;
   ka = fração da queda já vencida no ângulo (as de baixo descem logo depois do tubérculo); kl = fração da queda no
   ponto mais lateral; ke = fração da queda na extremidade (a 10ª volta a subir até a margem costal).
   Opcionais (as costelas 8–12 foram ajustadas às DUAS vistas da referência — o lado direito e o esquerdo da prancha
   são um par estéreo do mesmo arco): za = quanto o ângulo fica atrás do tubérculo (cm; padrão 0,75); da = queda do
   tubérculo ao ângulo em cm (substitui ka); fl = fração frente/trás do ponto mais lateral (padrão 0,47);
   py / yq = expoentes do perfil de queda entre ângulo → lateral e lateral → extremidade (1 = linear), ou
   yp / ya = as frações da queda nos dois pontos intermediários de cada trecho, dadas diretamente;
   nas flutuantes: e1, ez = expoentes da curva em planta (x e z) e py = perfil de queda até a ponta. */
const COST = [null,
  {W: 5.4,  drop: 4.0,  Dp: 5.6,  xcc: 3.2,  xa: 4.5, insp: 3.8, ka: 0,    kl: 0.56, ke: 1},
  {W: 7.9,  drop: 6.0,  Dp: 8.0,  xcc: 4.2,  xa: 5.3, insp: 4.5, ka: 0.08, kl: 0.58, ke: 1},
  {W: 9.7,  drop: 7.5,  Dp: 10.0, xcc: 5.0,  xa: 6.0, insp: 5.2, ka: 0.08, kl: 0.62, ke: 1},
  {W: 10.9, drop: 8.5,  Dp: 11.5, xcc: 5.8,  xa: 6.5, insp: 5.8, ka: 0.08, kl: 0.64, ke: 1},
  {W: 11.8, drop: 9.5,  Dp: 12.5, xcc: 6.7,  xa: 6.9, insp: 6.0, ka: 0.08, kl: 0.66, ke: 1},
  {W: 12.5, drop: 10.5, Dp: 13.3, xcc: 7.7,  xa: 7.3, insp: 6.2, ka: 0.08, kl: 0.68, ke: 1},
  {W: 13.0, drop: 11.5, Dp: 13.8, xcc: 8.9,  xa: 7.6, insp: 6.5, ka: 0.08, kl: 0.70, ke: 1},
  {W: 13.3, drop: 12.5, Dp: 11.0, xcc: 9.3, xa: 7.7, insp: 6.5, ka: 0.10, kl: 0.768, ke: 0.94, za: 1.5, da: 0.7, fl: 0.63, py: 0.85, yq: 0.5},
  {W: 12.65, drop: 12.5, Dp: 8.8, xcc: 9.5, xa: 6.05, insp: 6.2, ka: 0.18, kl: 0.846, ke: 0.90, za: 2.6, da: 0.43, fl: 0.574, yp: [0.293, 0.651], ya: [0.3, 0.68]},
  {W: 11.03, drop: 12.18, Dp: 7.45, xcc: 10.26, xa: 4.92, insp: 5.8, ka: 0.40, kl: 1,  ke: 0.891, za: 3.0, da: 0.88, fl: 0.653, yp: [0.372, 0.722], ya: [0.05, 0.661]},
  {W: 10.43, drop: 11.06, Dp: 2.97, xcc: 10.43, xa: 4.41, insp: 4.2, ka: 0.30, kl: 0,  ke: 1, za: 1.44, da: 0.41, e1: 0.5, py: 0.51, ez: 0.7},
  {W: 8.4,  drop: 6.65, Dp: -1.4, xcc: 8.4,  xa: 5.5, insp: 3.0, ka: 0.30, kl: 0,    ke: 1, za: 1.7, da: 2.4, e1: 0.95, py: 0.59, ez: 0.9}];
const RIB_T = [0, 0.10, 0.22, 0.33, 0.44, 0.55, 0.70, 0.85, 1];   // parâmetro t de cada ponto de controle
const RIB_N = 96;                                                  // amostras da tabela densa por costela

const ribs = EV.ribs = {};
const ribCtl = [null];        // pontos de controle em repouso (lado direito)
(() => {
  for (let i = 1; i <= 12; i++){
    const v = spine.v('T' + i), c = COST[i];
    const curta = (i === 1 || i >= 11);
    const head = v.local(v.bodyR * 0.9, (curta ? 0.1 : 0.4) * v.height, v.bodyR * 0.55);
    const tub = v.tpTip(1).add((i <= 10 ? V(0.25, -0.2, -0.7) : V(0.6, -0.5, -0.2)).applyQuaternion(v.quat));
    const y0 = head.y, zf = v.pos.z - c.Dp;
    const xa = i >= 11 ? c.xa : Math.max(c.xa, tub.x + 0.5);
    const da = c.da !== undefined ? c.da : (i === 1 ? 0.15 : Math.max(0.35 + 0.045 * c.drop, c.ka * c.drop));
    const ang = V(xa, tub.y - da, tub.z + (c.za !== undefined ? c.za : (i === 1 ? 0.15 : 0.75)));
    const P = [head, tub, ang];
    if (i <= 10){
      const zl = lerp(ang.z, zf, c.fl !== undefined ? c.fl : (i === 1 ? 0.52 : 0.47)), yl = y0 - c.drop * c.kl, ye = y0 - c.drop * c.ke;
      const e1 = 0.95, e2 = i <= 7 ? 0.82 : 0.95;            // expoentes das superelipses (frente mais achatada)
      const py = c.py || 1, yq = c.yq || 1;
      for (let n = 0; n < 2; n++){
        const f = (n + 1) / 3, a = f * Math.PI / 2;
        P.push(V(xa + (c.W - xa) * Math.pow(Math.sin(a), e1), lerp(ang.y, yl, c.yp ? c.yp[n] : Math.pow(f, py) * 0.96), zl + (ang.z - zl) * Math.pow(Math.cos(a), e1)));
      }
      P.push(V(c.W, yl, zl));
      for (let n = 0; n < 2; n++){
        const f = (n + 1) / 3, a = f * Math.PI / 2;
        P.push(V(c.xcc + (c.W - c.xcc) * Math.pow(Math.cos(a), e2), lerp(yl, ye, c.ya ? c.ya[n] : Math.pow(f, yq)), zl + (zf - zl) * Math.pow(Math.sin(a), e2)));
      }
      P.push(V(c.xcc, ye, zf));
    } else {
      /* flutuantes: do ângulo descem para fora e um pouco para a frente até a ponta livre */
      const tip = V(c.W, y0 - c.drop, zf);
      const e1 = c.e1 || 1, ez = c.ez || 1.2, py = c.py || 0.9;
      for (let k = 1; k <= 5; k++){
        const f = k / 6, a = f * Math.PI / 2;
        P.push(V(xa + (tip.x - xa) * Math.pow(Math.sin(a), e1), lerp(ang.y, tip.y, Math.pow(f, py)), tip.z + (ang.z - tip.z) * Math.pow(Math.cos(a), ez)));
      }
      P.push(tip);
    }
    ribCtl.push(P);
  }
})();

/* Tabela densa (RIB_N+1 pontos) da costela i para um valor de respiração. Guarda 2 valores por costela:
   o de repouso (permanente) e o último pedido. */
const ribCache = [];
const _q = new T.Quaternion(), _ax = V(0,0,0), _tmp = V(0,0,0), _tmp2 = V(0,0,0);
function ribTable(i, breath){
  if (!ribCtl[i]) throw new Error('EV.ribs: a costela ' + i + ' não existe (use 1..12)');
  let c = ribCache[i];
  if (!c) c = ribCache[i] = {rest: null, b: NaN, tab: new Float32Array((RIB_N + 1) * 3), ctl: ribCtl[i].map(p => p.clone())};
  if (breath === 0 && c.rest) return c.rest;
  if (breath === c.b) return c.tab;
  const src = ribCtl[i], P = c.ctl;
  P[0].copy(src[0]); P[1].copy(src[1]);
  _ax.copy(src[1]).sub(src[0]).normalize();
  _q.setFromAxisAngle(_ax, COST[i].insp * DEG * breath);
  for (let k = 2; k < 9; k++) P[k].copy(src[k]).sub(src[0]).applyQuaternion(_q).add(src[0]);
  const tab = breath === 0 ? (c.rest = new Float32Array((RIB_N + 1) * 3)) : c.tab;
  let seg = 0;
  for (let n = 0; n <= RIB_N; n++){
    const t = n / RIB_N;
    while (seg < 7 && t > RIB_T[seg + 1]) seg++;
    crPoint(P, seg, (t - RIB_T[seg]) / (RIB_T[seg + 1] - RIB_T[seg]), _tmp);
    tab[n * 3] = _tmp.x; tab[n * 3 + 1] = _tmp.y; tab[n * 3 + 2] = _tmp.z;
  }
  if (breath !== 0) c.b = breath;
  return tab;
}
const breathOf = st => (st && st.breath) ? clamp(st.breath, 0, 1.2) : 0;
function ribAt(i, t, breath, out){
  const tab = ribTable(i, breath), f = clamp(t, 0, 1) * RIB_N, n = Math.min(RIB_N - 1, Math.floor(f)), u = f - n, a = n * 3;
  return out.set(lerp(tab[a], tab[a + 3], u), lerp(tab[a + 1], tab[a + 4], u), lerp(tab[a + 2], tab[a + 5], u));
}

/* Linha central da costela i (1..12). `alvo` (extra) é um Vector3 de destino opcional. */
ribs.point = (i, t, side, state, alvo) => {
  const p = ribAt(i, t, breathOf(state), alvo || new T.Vector3());
  if (side < 0) p.x = -p.x;
  return p;
};
/* Referencial ao longo da costela: p, tangent (sentido de t crescente), out (para fora do tórax), up.
   `alvo` (extra): objeto {p, tangent, out, up} reaproveitado — passe o mesmo objeto (pode começar vazio, {}) em
   laços de animação para não alocar 4 Vector3 por chamada. */
ribs.frame = (i, t, side, state, alvo) => {
  const b = breathOf(state), s = side < 0 ? -1 : 1, h = 1.5 / RIB_N, o = alvo || {};
  const p = ribAt(i, t, b, o.p || (o.p = new T.Vector3()));
  const tangent = ribAt(i, Math.min(1, t + h), b, o.tangent || (o.tangent = new T.Vector3())).sub(ribAt(i, Math.max(0, t - h), b, _tmp)).normalize();
  const out = (o.out || (o.out = new T.Vector3())).set(p.x, 0, p.z - thoraxZc(p.y));
  out.addScaledVector(tangent, -out.dot(tangent)).normalize();
  const up = (o.up || (o.up = new T.Vector3())).crossVectors(out, tangent).normalize();
  if (s < 0){ p.x = -p.x; tangent.x = -tangent.x; out.x = -out.x; up.x = -up.x; }
  return o;
};
/* Seção achatada: [meia-altura (ao longo de `up`), meia-espessura (ao longo de `out`)]. A 1ª costela é deitada.
   Na referência as costelas são FITAS: cabeça e colo roliços (~0,8 cm), 1,2–1,6 cm de altura no corpo (as de
   baixo são as mais largas); a 10ª afina na ponta que sobe para a margem costal e as flutuantes são lâminas que
   terminam em ponta. A meia-espessura do corpo (0,27) não mudou: é ela que entra na
   superfície de EV.thorax. */
ribs.radii = (i, t) => {
  const pesc = smoothstep(0.0, 0.2, t);                           // cabeça/colo roliços → corpo achatado
  if (i === 1) return [lerp(0.38, 0.30, pesc), lerp(0.40, 0.75, pesc)];
  if (i === 2) return [lerp(0.40, 0.46, pesc) + 0.07 * smoothstep(0.2, 0.5, t), lerp(0.38, 0.36, pesc)];
  if (i >= 11){
    /* flutuantes: lâminas (a 12ª já larga desde o colo, a 11ª alarga aos poucos) que acabam em ponta */
    const ponta = 1 - smoothstep(i === 11 ? 0.84 : 0.9, 1, t), k = 0.2 + 0.8 * Math.pow(ponta, 0.8);
    const a = i === 11 ? lerp(lerp(0.38, 0.29, smoothstep(0.02, 0.12, t)), 0.58, smoothstep(0.15, 0.7, t)) : lerp(0.36, 0.46, smoothstep(0.05, 0.3, t));
    return [a * k, lerp(0.36, i === 11 ? 0.24 : 0.21, pesc) * (0.5 + 0.5 * ponta)];
  }
  /* 3ª–8ª: a fita já tem quase a altura toda no tubérculo (vista por trás ela fica de perfil até o ângulo);
     9ª e 10ª: colo esbelto mais comprido, que alarga depois do ângulo */
  const alto = i >= 9 ? 0.75 : 0.54 + 0.025 * i;                  // corpo: 3ª 0,62 … 8ª 0,74; 9ª e 10ª 0,75
  let a = i >= 9 ? lerp(lerp(0.38, 0.31, smoothstep(0.02, 0.12, t)), alto, smoothstep(0.13, 0.31, t)) : lerp(0.38, alto, smoothstep(0.04, 0.30, t));
  if (i === 10) a *= 1 - 0.6 * smoothstep(0.86, 1, t);
  return [a, lerp(0.38, 0.27, pesc) + (i >= 9 ? 0.04 * smoothstep(0.16, 0.42, t) : 0)];
};
ribs.count = 12;
/* extra: parâmetros de cada costela (somente leitura) */
ribs.table = i => COST[i];

/* ---------------------------------------------------------------------- esterno
   Pontos em repouso; com a respiração o esterno se move como CORPO RÍGIDO: o ângulo esternal acompanha a ponta da
   2ª costela e o osso gira em torno do eixo X para a junção xifoesternal apontar para onde foi a ponta da 6ª
   (os comprimentos do osso não mudam). */
const sternum = EV.sternum = {};
const STERN = {};
(() => {
  const e1 = ribCtl[1][8], e2 = ribCtl[2][8], e7 = ribCtl[7][8];
  STERN.notch = V(0, e1.y + 0.9, e1.z - 1.0);
  STERN.angle = V(0, e2.y + 0.1, e2.z - 1.5);
  STERN.xj = V(0, e7.y + 7.0, e7.z - 1.2);                 // junção xifoesternal
  STERN.xiphoid = V(0, STERN.xj.y - 3.2, STERN.xj.z + 0.5);
  /* inserções das cartilagens 1–7 na borda do esterno (lado direito) */
  STERN.att = [null];
  STERN.att[1] = V(2.4, STERN.notch.y - 1.5, lerp(STERN.notch.z, STERN.angle.z, 0.3) + 0.3);
  STERN.att[2] = V(1.75, STERN.angle.y, STERN.angle.z + 0.25);
  for (let i = 3; i <= 7; i++){
    const f = [0, 0, 0, 0.2, 0.42, 0.62, 0.8, 0.95][i];
    STERN.att[i] = V(lerp(1.7, 1.25, f), lerp(STERN.angle.y, STERN.xj.y, f), lerp(STERN.angle.z, STERN.xj.z, f) + 0.25);
  }
})();
const _d2 = V(0,0,0), _d6 = V(0,0,0), _sx = {b: NaN, dy: 0, dz: 0, c: 1, s: 0};
/* pose rígida do esterno para uma respiração b: translação (dy, dz) do ângulo esternal + rotação (c, s) em torno de X */
function sternXf(b){
  if (_sx.b === b) return _sx;
  ribAt(2, 1, b, _d2).sub(ribCtl[2][8]); ribAt(6, 1, b, _d6).sub(ribCtl[6][8]);
  const y0 = STERN.xj.y - STERN.angle.y, z0 = STERN.xj.z - STERN.angle.z;
  const phi = Math.atan2(z0 + _d6.z - _d2.z, y0 + _d6.y - _d2.y) - Math.atan2(z0, y0);
  _sx.b = b; _sx.dy = _d2.y; _sx.dz = _d2.z; _sx.c = Math.cos(phi); _sx.s = Math.sin(phi);
  return _sx;
}
/* ponto do esterno (dado em repouso) levado à pose da respiração b; escreve em `out` */
function sternMove(p, b, out){
  if (!b) return out.copy(p);
  const x = sternXf(b), y = p.y - STERN.angle.y, z = p.z - STERN.angle.z;
  return out.set(p.x, STERN.angle.y + y * x.c - z * x.s + x.dy, STERN.angle.z + y * x.s + z * x.c + x.dz);
}
const sternPt = (p, b) => sternMove(p, b, new T.Vector3());
sternum.notch = frz(STERN.notch.clone()); sternum.angle = frz(STERN.angle.clone()); sternum.xiphoid = frz(STERN.xiphoid.clone());
/* articulação esternoclavicular (aceita state opcional, extra) */
STERN.sc = V(2.3, STERN.notch.y + 0.5, STERN.notch.z + 0.5);
sternum.sc = (side, state, alvo) => { const p = sternMove(STERN.sc, breathOf(state), alvo || new T.Vector3()); if (side < 0) p.x = -p.x; return p; };
/* extra: pontos do esterno já com a respiração aplicada */
sternum.pose = state => { const b = breathOf(state); return {notch: sternPt(STERN.notch, b), angle: sternPt(STERN.angle, b), xj: sternPt(STERN.xj, b), xiphoid: sternPt(STERN.xiphoid, b)}; };
/* extra: inserção da cartilagem i (1..7) na borda do esterno */
sternum.attach = (i, side, state) => { const p = sternPt(STERN.att[i], breathOf(state)); if (side < 0) p.x = -p.x; return p; };

/* Cartilagem costal i (1..10): s = 0 na junção costocondral, s = 1 no esterno (1–7) ou na cartilagem de cima (8–10). */
const _cs = []; for (let i = 0; i <= 10; i++) _cs.push([V(0,0,0), V(0,0,0), V(0,0,0), V(0,0,0), V(0,0,0)]);   // rascunho por costela (há recursão 10→9→8→7)
const CART_JOIN = 0.42;                                    // onde a cartilagem 8–10 encontra a de cima
function cartAt(i, s, b, out){
  const c0 = _cs[i][0], c1 = _cs[i][1], c2 = _cs[i][2], c3 = _cs[i][3], d = _cs[i][4];
  ribAt(i, 1, b, c0);
  c1.copy(c0).sub(ribAt(i, 1 - 2 / RIB_N, b, _tmp)).normalize();            // direção em que a costela chega
  if (i <= 7){
    sternMove(STERN.att[i], b, c3);
    const L = c0.distanceTo(c3);
    c1.multiplyScalar(L * 0.42).add(c0);
    c2.set(c3.x + L * 0.34, c3.y - L * (i <= 2 ? 0.0 : 0.05 + 0.035 * (i - 2)), c3.z + L * 0.06);
  } else {
    /* 8–10: sobem e se fundem à cartilagem de cima (margem costal) */
    cartAt(i - 1, CART_JOIN, b, c3);
    cartAt(i - 1, CART_JOIN + 0.08, b, d).sub(c3).normalize();
    const L = c0.distanceTo(c3);
    c1.multiplyScalar(L * 0.38).add(c0);
    c2.copy(c3).addScaledVector(d, -L * 0.4);
  }
  const u = clamp(s, 0, 1), w = 1 - u;
  const b0 = w * w * w, b1 = 3 * w * w * u, b2 = 3 * w * u * u, b3 = u * u * u;
  return out.set(b0 * c0.x + b1 * c1.x + b2 * c2.x + b3 * c3.x, b0 * c0.y + b1 * c1.y + b2 * c2.y + b3 * c3.y, b0 * c0.z + b1 * c1.z + b2 * c2.z + b3 * c3.z);
}
ribs.cartilage = (i, s, side, state, alvo) => {
  if (i < 1 || i > 10) throw new Error('EV.ribs.cartilage: só as costelas 1..10 têm cartilagem');
  const p = cartAt(i, s, breathOf(state), alvo || new T.Vector3());
  if (side < 0) p.x = -p.x;
  return p;
};

/* ======================================================================= TÓRAX
   Superfície externa do gradil em coordenadas cilíndricas em torno de um eixo central (0, y, zc(y)):
   R(θ, y), θ = 0 para trás (+Z), 90° para o lado, 180° para a frente. A tabela é montada a partir das próprias
   costelas e cartilagens (em repouso, em meia inspiração e em inspiração completa; entre elas, interpolação).
   Atrás, entre os dois ângulos das costelas, a superfície é plana (ponte sobre a goteira paravertebral).
   A superfície passa por FORA do osso (o raio inclui a meia-espessura de cada costela) e só existe na faixa das
   costelas: acima da 1ª o raio cai a zero em ~4 cm e abaixo da mais baixa em ~2 cm (cúpulas), de modo que
   pescoço, crânio e lombar ficam "fora" do gradil (wrap não mexe neles). */
const TH = {NT: 65, NY: 0, y0: 0, y1: 0, tabs: [], cartHalf: 0.33, folga: 0.06, queda: 0.3};
let thoraxZc;
(() => {
  /* eixo central: reta ajustada entre o meio (frente/trás) na altura da 2ª e da 9ª costelas. Os dois pontos ficam
     CONGELADOS nos valores da fundação: o eixo é só o referencial cilíndrico de wrap/out/clearance/frame, e não
     deve andar quando o trajeto de uma costela é afinado (quem já assentou peças sobre o gradil não se desloca). */
  const a = {y: 40.0156, z: -2.08483}, b = {y: 15.8911, z: -2.14212}, k = (b.z - a.z) / (b.y - a.y);
  thoraxZc = y => a.z + k * (clamp(y, b.y - 6, a.y + 3) - a.y);
})();
function buildThoraxTable(breath){
  if (!TH.NY){
    /* faixa de alturas da tabela: das pontas mais baixas (−6 cm) ao topo da 1ª costela (+6 cm); nas bordas o raio já é 0 */
    let lo = 1e9, hi = -1e9;
    for (let i = 1; i <= 12; i++) for (const q of ribCtl[i]){ if (q.y < lo) lo = q.y; if (q.y > hi) hi = q.y; }
    TH.y0 = Math.floor(lo - 6); TH.y1 = Math.ceil(hi + 6); TH.NY = Math.round((TH.y1 - TH.y0) * 2) + 1;
  }
  const {NT, NY, y0, y1} = TH, tab = new Float32Array(NT * NY), p = V(0,0,0);
  /* polilinha (θ, y, r) de cada costela + cartilagem; r já inclui a meia-espessura do osso naquele ponto */
  const polys = [];
  for (let i = 1; i <= 12; i++){
    const L = [];
    const push = (q, meia) => { const dz = q.z - thoraxZc(q.y); L.push([Math.atan2(Math.abs(q.x), dz), q.y, Math.hypot(q.x, dz) + meia + TH.folga, meia + TH.folga]); };
    for (let n = Math.round(0.22 * RIB_N); n <= RIB_N; n += 2) push(ribAt(i, n / RIB_N, breath, p), ribs.radii(i, n / RIB_N)[1]);
    if (i <= 10){ const fim = ribs.radii(i, 1)[1]; for (let s = 0.1; s <= 1.001; s += 0.1) push(cartAt(i, s, breath, p), lerp(Math.max(fim, TH.cartHalf), TH.cartHalf, smoothstep(0, 0.6, s))); }
    /* ponte plana até a linha média: atrás (θ → 0) e, nas costelas com cartilagem, na frente (θ → π).
       O plano passa a uma meia-espessura inteira do eixo do osso (não só a componente radial dela). */
    const f = L[0], zb = (f[2] - f[3]) * Math.cos(f[0]) + f[3];
    const pre = []; for (let th = 0; th < f[0] - 0.02; th += 0.05) pre.push([th, f[1], zb / Math.cos(th)]);
    const l = L[L.length - 1];
    if (i <= 10 && l[0] > 2.2){ const zfr = (l[2] - l[3]) * Math.cos(l[0]) - l[3]; for (let th = l[0] + 0.04; th < Math.PI + 0.04; th += 0.04){ const t2 = Math.min(th, Math.PI); L.push([t2, l[1], zfr / Math.cos(t2)]); } }
    /* flutuantes: a superfície continua ~1,5 cm além da ponta livre (senão a ponta ficaria fora, na cúpula de baixo) */
    if (i > 10) for (let d = 0.05; d < 0.16; d += 0.05) L.push([l[0] + d, l[1], l[2]]);
    polys.push(pre.concat(L));
  }
  const fade = new Float32Array(NT * NY), ents = [];
  for (let j = 0; j < NT; j++){
    const th = j / (NT - 1) * Math.PI, ent = [];
    for (const L of polys){
      for (let m = 0; m < L.length - 1; m++){
        const A = L[m], B = L[m + 1];
        if ((A[0] <= th && th <= B[0]) || (B[0] <= th && th <= A[0])){
          const u = Math.abs(B[0] - A[0]) < 1e-6 ? 0 : (th - A[0]) / (B[0] - A[0]);
          ent.push([lerp(A[1], B[1], u), lerp(A[2], B[2], u)]); break;
        }
      }
    }
    ent.sort((A, B) => B[0] - A[0]);                              // de cima para baixo
    ents.push(ent);
  }
  /* fundo de cada coluna = a altura mais baixa entre ela e as vizinhas (±2 colunas ≈ ±6°): a margem costal sobe
     quase na vertical e, sem isso, a cúpula de baixo cortaria a cartilagem (e a ponta da 10ª) ao meio. A cúpula
     começa 1 cm abaixo do eixo da costela mais baixa (a fita tem até ~0,8 cm de meia-altura). */
  const fundo = new Float32Array(NT);
  for (let j = 0; j < NT; j++){
    let m = 1e9;
    for (let d = -2; d <= 2; d++){ const e = ents[clamp(j + d, 0, NT - 1)]; if (e.length && e[e.length - 1][0] < m) m = e[e.length - 1][0]; }
    fundo[j] = m;
  }
  for (let j = 0; j < NT; j++){
    const ent = ents[j], top = ent[0], bot = ent[ent.length - 1];
    for (let k = 0; k < NY; k++){
      const y = lerp(y0, y1, k / (NY - 1));
      let r = 0, f = 0;
      if (ent.length){
        /* acima da costela mais alta e abaixo da mais baixa o raio fica constante aqui e some no `fade` (cúpula) */
        if (y >= top[0]) r = top[1];
        else if (y <= bot[0]) r = bot[1];
        else { let m = 0; while (ent[m + 1][0] > y) m++; const A = ent[m], B = ent[m + 1]; r = lerp(A[1], B[1], (A[0] - y) / Math.max(1e-6, A[0] - B[0])); }
        f = (1 - smoothstep(0.7, 3.7, y - top[0])) * (1 - smoothstep(1.0, 2.6, fundo[j] - y));
      }
      tab[k * NT + j] = r; fade[k * NT + j] = f;
    }
  }
  /* envoltória externa: onde uma costela passa logo abaixo de outra com raio bem menor (11ª/12ª, margem costal) a
     superfície cairia num degrau que a tabela não resolve e o osso de fora ficaria para fora dela. Aqui a queda
     é limitada a TH.queda cm por célula, sempre levantando o lado de baixo (nunca rebaixando nada). */
  for (let pass = 0; pass < 10; pass++){
    let mudou = false;
    for (let k = 0; k < NY; k++) for (let j = 0; j < NT; j++){
      const n = k * NT + j;
      let m = tab[n];
      if (j > 0 && tab[n - 1] - TH.queda > m) m = tab[n - 1] - TH.queda;
      if (j < NT - 1 && tab[n + 1] - TH.queda > m) m = tab[n + 1] - TH.queda;
      if (k > 0 && tab[n - NT] - TH.queda > m) m = tab[n - NT] - TH.queda;
      if (k < NY - 1 && tab[n + NT] - TH.queda > m) m = tab[n + NT] - TH.queda;
      if (m > tab[n]){ tab[n] = m; mudou = true; }
    }
    if (!mudou) break;
  }
  /* suaviza um pouco (enche os vales entre costelas) sem nunca descer abaixo do valor original: a superfície
     continua por fora do osso */
  const cru = tab.slice(), tmp = new Float32Array(tab.length);
  for (let pass = 0; pass < 3; pass++){
    for (let k = 0; k < NY; k++) for (let j = 0; j < NT; j++){
      const jm = Math.max(0, j - 1), jp = Math.min(NT - 1, j + 1), km = Math.max(0, k - 1), kp = Math.min(NY - 1, k + 1);
      const s = (tab[k * NT + jm] + 2 * tab[k * NT + j] + tab[k * NT + jp] + tab[km * NT + j] + 2 * tab[k * NT + j] + tab[kp * NT + j]) / 8;
      tmp[k * NT + j] = Math.max(s, cru[k * NT + j]);
    }
    tab.set(tmp);
  }
  for (let n = 0; n < tab.length; n++) tab[n] *= fade[n];
  return tab;
}
/* R(θ, y) com respiração b (interpolação bilinear nas tabelas de b = 0, 0,5 e 1; linear por trechos em b) */
function thoraxR(th, y, b){
  if (!TH.tabs[0]){ TH.tabs[0] = buildThoraxTable(0); TH.tabs[1] = buildThoraxTable(0.5); TH.tabs[2] = buildThoraxTable(1); }
  const {NT, NY, y0, y1} = TH;
  const fj = clamp(th / Math.PI, 0, 1) * (NT - 1), j = Math.min(NT - 2, Math.floor(fj)), uj = fj - j;
  const fk = clamp((y - y0) / (y1 - y0), 0, 1) * (NY - 1), k = Math.min(NY - 2, Math.floor(fk)), uk = fk - k;
  const a = k * NT + j, t0 = TH.tabs[0];
  let r = lerp(lerp(t0[a], t0[a + 1], uj), lerp(t0[a + NT], t0[a + NT + 1], uj), uk);
  if (b){
    const t1 = TH.tabs[1], r1 = lerp(lerp(t1[a], t1[a + 1], uj), lerp(t1[a + NT], t1[a + NT + 1], uj), uk);
    if (b <= 0.5) r = lerp(r, r1, b * 2);
    else { const t2 = TH.tabs[2]; r = lerp(r1, lerp(lerp(t2[a], t2[a + 1], uj), lerp(t2[a + NT], t2[a + NT + 1], uj), uk), b * 2 - 1); }
  }
  return r;
}
const thorax = EV.thorax = {};
/* Se p está dentro da superfície externa do gradil (+margem), devolve o ponto empurrado para fora até ela
   (radialmente, na horizontal); senão devolve uma cópia de p. `alvo` (extra) evita alocação. Acima da 1ª costela
   e abaixo da mais baixa não há gradil: p volta intacto. */
thorax.wrap = (p, margem, state, alvo) => {
  const out = alvo || new T.Vector3();
  const zc = thoraxZc(p.y), dz = p.z - zc, r = Math.hypot(p.x, dz);
  const r0 = thoraxR(Math.atan2(Math.abs(p.x), dz), p.y, breathOf(state));
  /* na cúpula (onde o raio vai a zero) a margem some junto, para não sobrar uma "coluna" fina de raio = margem */
  const rs = r0 + (margem || 0) * clamp(r0 / 1.5, 0, 1);
  if (r >= rs) return out.copy(p);
  if (r < 1e-4) return out.set(p.x, p.y, zc + rs);
  const k = rs / r;
  return out.set(p.x * k, p.y, zc + dz * k);
};
/* Normal aproximada para fora do gradil na direção de p. */
thorax.out = (p, state, alvo) => {
  const out = alvo || new T.Vector3(), b = breathOf(state);
  const zc = thoraxZc(p.y), dz = p.z - zc, sx = p.x < 0 ? -1 : 1, th = Math.atan2(Math.abs(p.x), dz);
  const hT = 0.06, hY = 0.6, R = thoraxR(th, p.y, b);
  const dT = (thoraxR(Math.min(Math.PI, th + hT), p.y, b) - thoraxR(Math.max(0, th - hT), p.y, b)) / (Math.min(Math.PI, th + hT) - Math.max(0, th - hT));
  const dY = (thoraxR(th, p.y + hY, b) - thoraxR(th, p.y - hY, b)) / (2 * hY);
  const s = Math.sin(th), c = Math.cos(th), g = dT / Math.max(R, 1);
  return out.set(sx * (s - g * c), -dY, c + g * s).normalize();
};
thorax.center = y => V(0, y, thoraxZc(y));
/* extra: distância (cm) de p até a superfície externa, medida na radial horizontal (negativa = dentro) */
thorax.clearance = (p, state) => { const dz = p.z - thoraxZc(p.y); return Math.hypot(p.x, dz) - thoraxR(Math.atan2(Math.abs(p.x), dz), p.y, breathOf(state)); };
/* extra: faixa de alturas [yMin, yMax] em que existe gradil (fora dela o raio é 0) */
thorax.range = () => { if (!TH.tabs[0]) thoraxR(0, 0, 0); return [TH.y0, TH.y1]; };
/* extra: ponto da superfície externa (+margem) no azimute θ (rad; 0 = trás, π/2 = lado, π = frente) e altura y */
thorax.surface = (theta, y, side, state, margem) => { const r = thoraxR(theta, y, breathOf(state)) + (margem || 0); return V((side < 0 ? -1 : 1) * r * Math.sin(theta), y, thoraxZc(y) + r * Math.cos(theta)); };

/* ===================================================================== ESCÁPULA
   Coordenadas locais da escápula DIREITA (cm): +x lateral (rumo à glenoide), +y cranial ao longo da borda medial,
   +z = normal da face dorsal; origem na raiz da espinha, sobre a borda medial.

   Cinemática: a pose de repouso é dada por ângulos (rotação interna, inclinação anterior, rotação para cima) e pela
   posição da raiz; a escápula é "assentada" sobre o gradil guardando uma folga. Nos outros estados ela desliza em
   volta do tórax (retração/protração), sobe/desce (elevação/depressão) e gira em torno da normal (rotação para
   cima); três pontos de apoio (ângulo superior, ângulo inferior e colo) mantêm a mesma folga do repouso, o que faz
   a escápula acompanhar a curvatura do gradil sem atravessá-lo. */
const scap = EV.scap = {};
const ESC_K = 0.952;                                            // tamanho da escápula (1 = medidas abaixo, em cm)
const sv = (x, y, z) => V(x * ESC_K, y * ESC_K, z * ESC_K);
const SL = scap.L = {
  root: sv(0, 0, 0),                    // raiz da espinha (extremo medial da crista), sobre a borda medial
  supAngle: sv(1.0, 3.6, -1.0),
  infAngle: sv(0.85, -13.4, 0.1),
  acromionTip: sv(13.4, 2.4, -1.6),     // ponta anterior do acrômio
  acromionAngle: sv(11.0, 0.9, 1.6),    // ângulo do acrômio (extremo lateral da crista da espinha)
  glenoid: sv(10.2, -1.8, -1.2),        // centro da cavidade glenoide
  coracoidTip: sv(9.2, 1.6, -4.8),
  spineMid: sv(5.2, 0.3, 1.4),          // meio da crista da espinha
  ac: sv(12.1, 2.7, -2.1)               // extra: articulação acromioclavicular (ponta lateral da clavícula)
};
const SCAP = {
  /* posição da raiz (x; dy = acima do centro de T3) e ângulos em graus, ajustados à referência: IR = rotação interna
     (plano da escápula a 32° do plano frontal), AT = inclinação anterior, UR = rotação para cima; gap = folga mínima
     (cm) entre os pontos de teste da face costal e a superfície externa do gradil */
  rest: {x: 8.06, dy: -0.1, IR: 32, AT: 2.0, UR: 2.3, gap: 0.75},
  pivot: sv(5.0, -1.0, 0),                                    // centro da rotação para cima (local)
  tri: [sv(1.2, 2.6, -0.9), sv(0.9, -11.3, -0.2), sv(8.8, -3.4, -0.9)],   // pontos de apoio (face costal)
  /* pontos de teste do assentamento: [x, y, z local, folga extra (somada a gap)] */
  seat: [[1.0, 3.3, -1.0, 0], [0.2, 0, -0.3, 0], [0, -4.4, -0.3, 0], [0.4, -8.4, -0.3, 0], [0.9, -12.4, -0.2, 0], [3.6, -8, -0.4, 0.2], [4.6, -2.6, -0.5, 0.5], [8.2, -3.8, -0.8, 1.0],
         [2.6, -11.2, -0.6, -0.3], [4.8, -8.6, -0.75, -0.3], [6.9, -6.2, -0.9, -0.3]]            // crista da borda lateral (mais espessa que a lâmina)
    .map(q => [q[0] * ESC_K, q[1] * ESC_K, q[2] * ESC_K, q[3]]),
  elevUp: 4.5, elevDown: 1.5, retr: 0.20, protr: 0.34, rotMax: 45
};
SCAP.rest.y = spine.v('T3').pos.y + SCAP.rest.dy;
for (const k in SL) frz(SL[k]);
frz(SCAP.rest); frz(SCAP.pivot); SCAP.tri.forEach(frz); frz(SCAP.tri); SCAP.seat.forEach(frz); frz(SCAP.seat); frz(SCAP);
const _medial = EV.curve([SL.supAngle, sv(0.45, 1.9, -0.4), SL.root, sv(-0.6, -4.4, 0.15), sv(-0.55, -9.2, 0.2), SL.infAngle]);
/* Borda medial (local): t = 0 ângulo superior, t = 1 ângulo inferior. */
scap.medial = (t, alvo) => _medial.at(t, alvo);

/* raio do "trilho" da escápula: o gradil, tratado como cilindro acima de T2 (o ângulo superior passa por cima) */
let scapYTop = 0;
const railR = (th, y, b) => thoraxR(th, Math.min(y, scapYTop), b);
const railClear = (p, b) => { const dz = p.z - thoraxZc(p.y); return Math.hypot(p.x, dz) - railR(Math.atan2(Math.abs(p.x), dz), p.y, b); };

/* cópias privadas para o solver: EV.scap.L e EV.scap.params são públicos, e uma peça distraída não pode mudar a cinemática */
const K_AC = SL.ac.clone(), K_TRI = SCAP.tri.map(q => q.clone()), K_PIV = SCAP.pivot.clone(), K_SEAT = SCAP.seat.map(q => q.slice());
/* pontos de teste da segurança (passo 4 do solver): os do assentamento + borda lateral e ângulo inferior, que são
   os primeiros a encostar no gradil nos extremos. [x, y, z local] já na escala da escápula. */
const K_SAFE = K_SEAT.map(q => q.slice(0, 3)).concat([[7.6, -5.4, -0.9], [5.6, -7.6, -0.8], [3.4, -10.0, -0.6], [1.7, -12.2, -0.4], [1.0, -13.0, -0.2], [2.4, -5.0, -0.4], [5.0, 1.6, -1.0]].map(q => [q[0] * ESC_K, q[1] * ESC_K, q[2] * ESC_K]));
const SAFE_GAP = 0.9;                                           // folga mínima (cm) desses pontos: meia-espessura do osso + costela saliente + serrátil
const _triLocalInv = new T.Matrix4();
function triad(a, b, c, out){
  const e1 = _tmp.copy(b).sub(a).normalize(), e3 = _tmp2.copy(c).sub(a); e3.crossVectors(e1, e3).normalize();
  const e2 = new T.Vector3().crossVectors(e3, e1);
  return out.makeBasis(e1, e2, e3).setPosition(a);
}
let scapRest = null;
function scapInit(){
  scapYTop = spine.v('T2').pos.y + 0.5;
  const r = SCAP.rest;
  const rot = new T.Matrix4().makeRotationY(r.IR * DEG)
    .multiply(new T.Matrix4().makeRotationX(-r.AT * DEG))
    .multiply(new T.Matrix4().makeRotationZ(r.UR * DEG));
  /* assenta ao longo de Z: o menor z em que todos os pontos de teste guardam a folga */
  const M = new T.Matrix4(), p = V(0,0,0);
  const minClear = z => { M.copy(rot).setPosition(r.x, r.y, z); let m = 1e9; for (const s of K_SEAT){ p.set(s[0], s[1], s[2]).applyMatrix4(M); m = Math.min(m, railClear(p, 0) - r.gap - s[3]); } return m; };
  let lo = -8, hi = 30;
  for (let it = 0; it < 40; it++){ const mid = (lo + hi) / 2; if (minClear(mid) >= 0) hi = mid; else lo = mid; }
  M.copy(rot).setPosition(r.x, r.y, hi);
  const gaps = K_TRI.map(t => railClear(p.copy(t).applyMatrix4(M), 0));
  _triLocalInv.copy(triad(K_TRI[0], K_TRI[1], K_TRI[2], new T.Matrix4())).invert();
  /* comprimento da clavícula (esternoclavicular → acromioclavicular) em repouso: fica constante nos outros estados */
  const clav = sternum.sc(1).distanceTo(p.copy(K_AC).applyMatrix4(M));
  /* folga de segurança de cada ponto de teste: SAFE_GAP, mas nunca mais que a folga do próprio repouso
     (senão o passo 4 daria um salto ao sair do repouso) */
  const safe = K_SAFE.map(q => Math.min(SAFE_GAP, railClear(p.set(q[0], q[1], q[2]).applyMatrix4(M), 0)));
  scapRest = {M: M.clone(), gaps, clav, safe};
}
const _mA = new T.Matrix4(), _mB = new T.Matrix4(), _mC = new T.Matrix4(), _m0 = new T.Matrix4();
const _w = [V(0,0,0), V(0,0,0), V(0,0,0)], _sc = V(0,0,0), _ac = V(0,0,0);
/* reassenta `out`: os três apoios voltam à folga de repouso (o apoio lateral com `extra` a mais), radialmente,
   e a pose rígida é refeita por eles */
function scapReseat(out, b, extra){
  for (let it = 0; it < 3; it++){
    for (let k = 0; k < 3; k++){
      const p = _w[k].copy(K_TRI[k]).applyMatrix4(out);
      const zc2 = thoraxZc(p.y), dz = p.z - zc2, r = Math.hypot(p.x, dz);
      const alvo = railR(Math.atan2(Math.abs(p.x), dz), p.y, b) + scapRest.gaps[k] + (k === 2 ? extra : 0), f = alvo / Math.max(r, 1e-4);
      p.x *= f; p.z = zc2 + dz * f;
    }
    out.copy(triad(_w[0], _w[1], _w[2], _mC)).multiply(_triLocalInv);
  }
  return out;
}
function scapSolve(st, out){
  if (!scapRest) scapInit();
  const e = clamp(st.elev || 0, -1.2, 1.2), re = clamp(st.retr || 0, -1.2, 1.2), ro = clamp(st.rot || 0, 0, 1.2), b = breathOf(st);
  if (!e && !re && !ro && !b) return out.copy(scapRest.M);
  /* 1) rotação para cima em torno do pivô (no referencial local) */
  const phi = (ro * SCAP.rotMax + Math.max(0, e) * 4) * DEG;
  _mA.makeTranslation(K_PIV.x, K_PIV.y, 0).multiply(_mB.makeRotationZ(phi)).multiply(_mB.makeTranslation(-K_PIV.x, -K_PIV.y, 0));
  _m0.copy(scapRest.M).multiply(_mA);
  /* 2) deslizamento em volta do eixo do tórax + subida/descida */
  const dTh = (re >= 0 ? -re * SCAP.retr : -re * SCAP.protr) + ro * 0.20;
  const dY = (e >= 0 ? e * SCAP.elevUp : e * SCAP.elevDown) + ro * 1.0;
  const yc = SCAP.rest.y - 5, zc = thoraxZc(yc);
  _mA.makeTranslation(0, dY, zc).multiply(_mB.makeRotationY(dTh)).multiply(_mB.makeTranslation(0, 0, -zc));
  _m0.premultiply(_mA);
  /* 3) reassenta sobre o gradil; a folga do apoio lateral é a incógnita que mantém o comprimento da clavícula
        (a clavícula segura o acrômio afastado: ao subir ou protrair, a parte lateral se afasta das costelas) */
  sternum.sc(1, st, _sc);
  const erro = extra => _ac.copy(K_AC).applyMatrix4(scapReseat(out.copy(_m0), b, extra)).distanceTo(_sc) - scapRest.clav;
  let lo = 0.5 - scapRest.gaps[2], hi = 9, f0 = erro(0);
  if (Math.abs(f0) > 0.01){
    if (f0 > 0) hi = 0; else lo = 0;
    for (let it = 0; it < 16; it++){ const mid = (lo + hi) / 2; if (erro(mid) > 0) hi = mid; else lo = mid; }
    erro((lo + hi) / 2);
  }
  /* 4) segurança: nenhum ponto de teste da face costal chega a menos de SAFE_GAP do gradil (sobra lugar para as
        costelas salientes e para o serrátil, que passa por baixo). A escápula é afastada ao longo da radial do
        ponto mais apertado; duas passadas bastam. */
  for (let it = 0; it < 2; it++){
    let falta = 0, px = 0, pz = 0;
    for (let n = 0; n < K_SAFE.length; n++){
      const s = K_SAFE[n], q = _ac.set(s[0], s[1], s[2]).applyMatrix4(out), c = railClear(q, b) - scapRest.safe[n];
      if (c < falta){ falta = c; px = q.x; pz = q.z - thoraxZc(q.y); }
    }
    if (falta >= -1e-3) break;
    const el = out.elements, k = -falta * 1.02 / Math.max(1e-4, Math.hypot(px, pz));
    el[12] += px * k; el[14] += pz * k;
  }
  return out;
}
/* cache: repouso + últimos estados pedidos (toWorld é chamado muitas vezes por quadro) */
const scapSlots = [0, 1, 2, 3].map(() => ({e: NaN, r: NaN, o: NaN, b: NaN, R: new T.Matrix4(), L: new T.Matrix4()}));
let scapNext = 0;
const _mirror = new T.Matrix4().makeScale(-1, 1, 1);
function scapSlot(st){
  const e = st ? st.elev || 0 : 0, r = st ? st.retr || 0 : 0, o = st ? st.rot || 0 : 0, b = st ? st.breath || 0 : 0;
  for (let i = 0; i < scapSlots.length; i++){ const s = scapSlots[i]; if (s.e === e && s.r === r && s.o === o && s.b === b) return s; }
  const rest = !e && !r && !o && !b;
  const s = rest ? scapSlots[0] : scapSlots[1 + (scapNext++ % (scapSlots.length - 1))];
  s.e = e; s.r = r; s.o = o; s.b = b;
  scapSolve({elev: e, retr: r, rot: o, breath: b}, s.R);
  s.L.copy(_mirror).multiply(s.R);
  return s;
}
/* Matriz local→mundo (o lado esquerdo é o direito espelhado em X). Devolve uma cópia. */
scap.matrix = (side, state) => { const s = scapSlot(state); return (side < 0 ? s.L : s.R).clone(); };
scap.toWorld = (local, side, state, alvo) => { const s = scapSlot(state); return (alvo || new T.Vector3()).copy(local).applyMatrix4(side < 0 ? s.L : s.R); };
/* Aplica a matriz local→mundo num Object3D (posição/rotação/escala; no lado esquerdo a escala fica negativa
   e o three.js inverte sozinho a face frontal). */
scap.place = (obj, side, state) => {
  const s = scapSlot(state);
  (side < 0 ? s.L : s.R).decompose(obj.position, obj.quaternion, obj.scale);
  obj.updateMatrix(); obj.matrixWorldNeedsUpdate = true;
  return obj;
};
/* extra: parâmetros da cinemática (somente leitura; o solver usa cópias próprias) */
scap.params = SCAP;
/* extra: folga (cm) entre os pontos de teste da face costal e o gradil num estado — [mínima, em repouso] */
scap.clearance = state => {
  const s = scapSlot(state); let m = 1e9, r = 1e9;
  for (let n = 0; n < K_SAFE.length; n++){ const q = K_SAFE[n]; m = Math.min(m, railClear(_ac.set(q[0], q[1], q[2]).applyMatrix4(s.R), breathOf(state))); r = Math.min(r, scapRest.safe[n]); }
  return [m, r];
};

/* ========================================================================= SDF
   Funções de distância com sinal: cada uma devolve (x, y, z) → distância (negativa dentro). */
const sdf = EV.sdf = {};
sdf.sphere = (c, r) => { const cx = c[0], cy = c[1], cz = c[2]; return (x, y, z) => { const dx = x - cx, dy = y - cy, dz = z - cz; return Math.sqrt(dx * dx + dy * dy + dz * dz) - r; }; };
/* Elipsoide (distância aproximada). A estimativa de 1ª ordem k0·(k0−1)/k1 é boa junto da superfície, mas:
   · por dentro ela não tem limite (num elipsoide achatado vale ≈ −rmax a um passo do centro) — aqui fica limitada
     pela distância até a superfície ao longo de cada eixo, que nunca é menor que a distância verdadeira;
   · por fora ela subestima nas diagonais de formas achatadas (dava oclusão falsa) — um 2º passo a partir do pé
     estimado corrige (erro de poucos %). */
sdf.ellipsoid = (c, r) => {
  const cx = c[0], cy = c[1], cz = c[2], rx = r[0], ry = r[1], rz = r[2], ix2 = 1 / (rx * rx), iy2 = 1 / (ry * ry), iz2 = 1 / (rz * rz);
  return (x, y, z) => {
    let dx = x - cx, dy = y - cy, dz = z - cz;
    let ax = dx * dx * ix2, ay = dy * dy * iy2, az = dz * dz * iz2;
    const k0 = Math.sqrt(ax + ay + az), k1 = Math.sqrt(ax * ix2 + ay * iy2 + az * iz2);
    if (k0 < 1){
      const bx = rx * Math.sqrt(Math.max(0, 1 - ay - az)) - Math.abs(dx), by = ry * Math.sqrt(Math.max(0, 1 - ax - az)) - Math.abs(dy), bz = rz * Math.sqrt(Math.max(0, 1 - ax - ay)) - Math.abs(dz);
      const m = -(bx < by ? (bx < bz ? bx : bz) : (by < bz ? by : bz));
      if (k1 < 1e-9) return m;
      const d = k0 * (k0 - 1) / k1;
      return d > m ? d : m;
    }
    const d = k0 * (k0 - 1) / k1, s = d / k1;
    dx -= dx * ix2 * s; dy -= dy * iy2 * s; dz -= dz * iz2 * s;                 // pé estimado: p − d·∇k0/|∇k0|
    ax = dx * dx * ix2; ay = dy * dy * iy2; az = dz * dz * iz2;
    const q0 = Math.sqrt(ax + ay + az), q1 = Math.sqrt(ax * ix2 + ay * iy2 + az * iz2);
    return q1 < 1e-9 ? d : d + q0 * (q0 - 1) / q1;
  };
};
/* cápsula de a até b; com rb, o raio varia linearmente (cone arredondado) */
sdf.capsule = (a, b, ra, rb) => {
  const ax = a[0], ay = a[1], az = a[2], bx = b[0] - ax, by = b[1] - ay, bz = b[2] - az, il = 1 / Math.max(1e-9, bx * bx + by * by + bz * bz), dr = (rb === undefined ? ra : rb) - ra;
  return (x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az;
    let h = (px * bx + py * by + pz * bz) * il; h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - bx * h, dy = py - by * h, dz = pz - bz * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + dr * h);
  };
};
sdf.box = (c, h, raio) => {
  const cx = c[0], cy = c[1], cz = c[2], r = raio || 0, hx = h[0] - r, hy = h[1] - r, hz = h[2] - r;
  return (x, y, z) => {
    const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z - cz) - hz;
    const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0, m = Math.max(qx, qy, qz);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + (m < 0 ? m : 0) - r;
  };
};
/* placa triangular arredondada (triângulo a, b, c com a espessura dada) */
sdf.plate = (a, b, c, espessura) => {
  const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2], cx = c[0], cy = c[1], cz = c[2];
  const bax = bx - ax, bay = by - ay, baz = bz - az, cbx = cx - bx, cby = cy - by, cbz = cz - bz, acx = ax - cx, acy = ay - cy, acz = az - cz;
  const nx = bay * acz - baz * acy, ny = baz * acx - bax * acz, nz = bax * acy - bay * acx;
  const iba = 1 / (bax * bax + bay * bay + baz * baz), icb = 1 / (cbx * cbx + cby * cby + cbz * cbz), iac = 1 / (acx * acx + acy * acy + acz * acz), inn = 1 / (nx * nx + ny * ny + nz * nz);
  /* normais das arestas no plano (aresta × n) */
  const e1x = bay * nz - baz * ny, e1y = baz * nx - bax * nz, e1z = bax * ny - bay * nx;
  const e2x = cby * nz - cbz * ny, e2y = cbz * nx - cbx * nz, e2z = cbx * ny - cby * nx;
  const e3x = acy * nz - acz * ny, e3y = acz * nx - acx * nz, e3z = acx * ny - acy * nx;
  const half = espessura / 2;
  return (x, y, z) => {
    const pax = x - ax, pay = y - ay, paz = z - az, pbx = x - bx, pby = y - by, pbz = z - bz, pcx = x - cx, pcy = y - cy, pcz = z - cz;
    const s = (e1x * pax + e1y * pay + e1z * paz < 0 ? -1 : 1) + (e2x * pbx + e2y * pby + e2z * pbz < 0 ? -1 : 1) + (e3x * pcx + e3y * pcy + e3z * pcz < 0 ? -1 : 1);
    let d2;
    if (s < 2){
      let h = (bax * pax + bay * pay + baz * paz) * iba; h = h < 0 ? 0 : h > 1 ? 1 : h;
      let ux = bax * h - pax, uy = bay * h - pay, uz = baz * h - paz; d2 = ux * ux + uy * uy + uz * uz;
      h = (cbx * pbx + cby * pby + cbz * pbz) * icb; h = h < 0 ? 0 : h > 1 ? 1 : h;
      ux = cbx * h - pbx; uy = cby * h - pby; uz = cbz * h - pbz; d2 = Math.min(d2, ux * ux + uy * uy + uz * uz);
      h = (acx * pcx + acy * pcy + acz * pcz) * iac; h = h < 0 ? 0 : h > 1 ? 1 : h;
      ux = acx * h - pcx; uy = acy * h - pcy; uz = acz * h - pcz; d2 = Math.min(d2, ux * ux + uy * uy + uz * uz);
    } else { const k = nx * pax + ny * pay + nz * paz; d2 = k * k * inn; }
    return Math.sqrt(d2) - half;
  };
};
sdf.union = (...f) => {
  const n = f.length;
  if (n === 1) return f[0];
  if (n === 2){ const a = f[0], b = f[1]; return (x, y, z) => { const p = a(x, y, z), q = b(x, y, z); return p < q ? p : q; }; }
  return (x, y, z) => { let m = f[0](x, y, z); for (let i = 1; i < n; i++){ const d = f[i](x, y, z); if (d < m) m = d; } return m; };
};
/* união suave: k = raio aproximado (cm) da concordância entre as formas */
sdf.smooth = (k, ...f) => {
  const n = f.length, q = 0.25 / k;
  return (x, y, z) => {
    let m = f[0](x, y, z);
    for (let i = 1; i < n; i++){ const d = f[i](x, y, z); const h = k - Math.abs(m - d); m = (m < d ? m : d) - (h > 0 ? h * h * q : 0); }
    return m;
  };
};
/* a menos b (com k, a aresta do corte fica arredondada) */
sdf.sub = (a, b, k) => {
  if (!k) return (x, y, z) => { const p = a(x, y, z), q = -b(x, y, z); return p > q ? p : q; };
  const q4 = 0.25 / k;
  return (x, y, z) => { const p = a(x, y, z), q = -b(x, y, z), h = k - Math.abs(p - q); return (p > q ? p : q) + (h > 0 ? h * h * q4 : 0); };
};
sdf.inter = (a, b) => (x, y, z) => { const p = a(x, y, z), q = b(x, y, z); return p > q ? p : q; };
/* f transformada pela matriz M (local de f → mundo). Escala uniforme é compensada. */
sdf.xform = (f, M) => {
  const e = new T.Matrix4().copy(M).invert().elements, s = Math.cbrt(Math.abs(M.determinant()));
  const m0 = e[0], m1 = e[1], m2 = e[2], m4 = e[4], m5 = e[5], m6 = e[6], m8 = e[8], m9 = e[9], m10 = e[10], m12 = e[12], m13 = e[13], m14 = e[14];
  return (x, y, z) => f(m0 * x + m4 * y + m8 * z + m12, m1 * x + m5 * y + m9 * z + m13, m2 * x + m6 * y + m10 * z + m14) * s;
};

/* ======================================================================= MALHAS */
const mesh = EV.mesh = {};

/* Surface nets: malha da superfície f = 0 dentro da caixa [min, max] com células de `cell` cm.
   opts: {min, max, cell, ao?: true (cor de vértice com oclusão de ambiente), aoRadius?: 1.6, aoStrength?: 1,
          aoColor?: [r,g,b] da sombra (padrão creme-oliva [0.62, 0.56, 0.42]; o crânio usa lavanda [0.50, 0.47, 0.64]), uv?: (x,y,z) → [u, v], exact?: true (avalia a grade inteira; use se f estiver
          muito longe de ser uma distância), lip?: fator de segurança da busca hierárquica (1.5)}.
   Normais pelo gradiente de f. Devolve BufferGeometry indexada (position, normal, color e, se pedido, uv). */
mesh.fromSDF = (f, opts) => {
  const cell = opts.cell, mn = opts.min, mx = opts.max;
  const nx = Math.max(2, Math.ceil((mx[0] - mn[0]) / cell)), ny = Math.max(2, Math.ceil((mx[1] - mn[1]) / cell)), nz = Math.max(2, Math.ceil((mx[2] - mn[2]) / cell));
  const sx = nx + 1, sy = ny + 1, sxy = sx * sy, vals = new Float32Array(sxy * (nz + 1));
  const x0 = mn[0], y0 = mn[1], z0 = mn[2];
  if (opts.exact){
    let n = 0;
    for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) vals[n++] = f(x0 + i * cell, y0 + j * cell, z0 + k * cell);
  } else {
    /* blocos de B células: só avalia a grade fina onde a superfície pode passar */
    const B = 4, lip = opts.lip || 1.5, far = [];
    vals.fill(NaN);
    for (let k0 = 0; k0 < nz; k0 += B) for (let j0 = 0; j0 < ny; j0 += B) for (let i0 = 0; i0 < nx; i0 += B){
      const i1 = Math.min(nx, i0 + B), j1 = Math.min(ny, j0 + B), k1 = Math.min(nz, k0 + B);
      const c = f(x0 + (i0 + i1) * 0.5 * cell, y0 + (j0 + j1) * 0.5 * cell, z0 + (k0 + k1) * 0.5 * cell);
      const hd = 0.5 * cell * Math.sqrt((i1 - i0) * (i1 - i0) + (j1 - j0) * (j1 - j0) + (k1 - k0) * (k1 - k0));
      if (Math.abs(c) > hd * lip + cell){
        /* longe pelo centro: confere os 8 cantos (ficam guardados na grade). Se algum troca de sinal ou está perto
           da superfície, f não é uma distância de verdade ali e o bloco é avaliado inteiro (antes era pulado e
           virava um degrau na malha). */
        let longe = true;
        const lim = 0.25 * hd + cell;
        for (let q = 0; q < 8 && longe; q++){
          const i = q & 1 ? i1 : i0, j = q & 2 ? j1 : j0, k = q & 4 ? k1 : k0, n = i + j * sx + k * sxy;
          let v = vals[n];
          if (v !== v) v = vals[n] = f(x0 + i * cell, y0 + j * cell, z0 + k * cell);
          if ((v < 0) !== (c < 0) || Math.abs(v) < lim) longe = false;
        }
        if (longe){ far.push(i0, i1, j0, j1, k0, k1, c); continue; }
      }
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++){
        let n = i0 + j * sx + k * sxy;
        for (let i = i0; i <= i1; i++, n++) if (vals[n] !== vals[n]) vals[n] = f(x0 + i * cell, y0 + j * cell, z0 + k * cell);
      }
    }
    for (let q = 0; q < far.length; q += 7){
      const c = far[q + 6];
      for (let k = far[q + 4]; k <= far[q + 5]; k++) for (let j = far[q + 2]; j <= far[q + 3]; j++){
        let n = far[q] + j * sx + k * sxy;
        for (let i = far[q]; i <= far[q + 1]; i++, n++) if (vals[n] !== vals[n]) vals[n] = c;
      }
    }
  }
  /* um vértice por célula cortada pela superfície: média dos cruzamentos nas 12 arestas */
  const cellV = new Int32Array(nx * ny * nz).fill(-1);
  let pos = new Float32Array(3 * 8192), nv = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++){
    let n = j * sx + k * sxy;
    for (let i = 0; i < nx; i++, n++){
      const a = vals[n], b = vals[n + 1], c = vals[n + sx], d = vals[n + sx + 1], e = vals[n + sxy], g = vals[n + sxy + 1], h = vals[n + sxy + sx], m = vals[n + sxy + sx + 1];
      const A = a < 0, Bb = b < 0, C = c < 0, D = d < 0, E = e < 0, G = g < 0, H = h < 0, Mm = m < 0;
      if (A === Bb && A === C && A === D && A === E && A === G && A === H && A === Mm) continue;
      let px = 0, py = 0, pz = 0, cnt = 0, t;
      if (A !== Bb){ t = a / (a - b); px += t; cnt++; }
      if (C !== D){ t = c / (c - d); px += t; py += 1; cnt++; }
      if (E !== G){ t = e / (e - g); px += t; pz += 1; cnt++; }
      if (H !== Mm){ t = h / (h - m); px += t; py += 1; pz += 1; cnt++; }
      if (A !== C){ t = a / (a - c); py += t; cnt++; }
      if (Bb !== D){ t = b / (b - d); py += t; px += 1; cnt++; }
      if (E !== H){ t = e / (e - h); py += t; pz += 1; cnt++; }
      if (G !== Mm){ t = g / (g - m); py += t; px += 1; pz += 1; cnt++; }
      if (A !== E){ t = a / (a - e); pz += t; cnt++; }
      if (Bb !== G){ t = b / (b - g); pz += t; px += 1; cnt++; }
      if (C !== H){ t = c / (c - h); pz += t; py += 1; cnt++; }
      if (D !== Mm){ t = d / (d - m); pz += t; px += 1; py += 1; cnt++; }
      if (nv * 3 + 3 > pos.length){ const p2 = new Float32Array(pos.length * 2); p2.set(pos); pos = p2; }
      const ic = 1 / cnt;
      pos[nv * 3] = x0 + (i + px * ic) * cell; pos[nv * 3 + 1] = y0 + (j + py * ic) * cell; pos[nv * 3 + 2] = z0 + (k + pz * ic) * cell;
      cellV[i + j * nx + k * nx * ny] = nv++;
    }
  }
  /* um quadrilátero por aresta da grade com troca de sinal */
  let idx = new Uint32Array(6 * 8192), ni = 0;
  const nxy = nx * ny;
  const quad = (c0, c1, c2, c3, flip) => {
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) return;
    if (ni + 6 > idx.length){ const i2 = new Uint32Array(idx.length * 2); i2.set(idx); idx = i2; }
    if (flip){ const s = c1; c1 = c3; c3 = s; }
    /* divide pela diagonal mais curta */
    const dx1 = pos[c0 * 3] - pos[c2 * 3], dy1 = pos[c0 * 3 + 1] - pos[c2 * 3 + 1], dz1 = pos[c0 * 3 + 2] - pos[c2 * 3 + 2];
    const dx2 = pos[c1 * 3] - pos[c3 * 3], dy2 = pos[c1 * 3 + 1] - pos[c3 * 3 + 1], dz2 = pos[c1 * 3 + 2] - pos[c3 * 3 + 2];
    if (dx1 * dx1 + dy1 * dy1 + dz1 * dz1 <= dx2 * dx2 + dy2 * dy2 + dz2 * dz2){ idx[ni++] = c0; idx[ni++] = c1; idx[ni++] = c2; idx[ni++] = c0; idx[ni++] = c2; idx[ni++] = c3; }
    else { idx[ni++] = c0; idx[ni++] = c1; idx[ni++] = c3; idx[ni++] = c1; idx[ni++] = c2; idx[ni++] = c3; }
  };
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++){
    const n = i + j * sx + k * sxy, a = vals[n] < 0;
    if (i < nx && j > 0 && j < ny && k > 0 && k < nz && a !== (vals[n + 1] < 0)){
      const c = i + j * nx + k * nxy;
      quad(cellV[c - nx - nxy], cellV[c - nxy], cellV[c], cellV[c - nx], !a);
    }
    if (j < ny && i > 0 && i < nx && k > 0 && k < nz && a !== (vals[n + sx] < 0)){
      const c = i + j * nx + k * nxy;
      quad(cellV[c - 1 - nxy], cellV[c - 1], cellV[c], cellV[c - nxy], !a);
    }
    if (k < nz && i > 0 && i < nx && j > 0 && j < ny && a !== (vals[n + sxy] < 0)){
      const c = i + j * nx + k * nxy;
      quad(cellV[c - 1 - nx], cellV[c - nx], cellV[c], cellV[c - 1], !a);
    }
  }
  /* normais (gradiente de f) e oclusão de ambiente (quanto f cresce menos que o esperado ao longo da normal) */
  const position = pos.slice(0, nv * 3), normal = new Float32Array(nv * 3), h = cell * 0.5;
  const ao = opts.ao ? new Float32Array(nv * 3) : null;
  const aoR = opts.aoRadius || 1.6, aoS = opts.aoStrength === undefined ? 1 : opts.aoStrength, aoC = opts.aoColor || [0.62, 0.56, 0.42];
  for (let v = 0; v < nv; v++){
    const x = position[v * 3], y = position[v * 3 + 1], z = position[v * 3 + 2];
    let gx = f(x + h, y, z) - f(x - h, y, z), gy = f(x, y + h, z) - f(x, y - h, z), gz = f(x, y, z + h) - f(x, y, z - h);
    const il = 1 / (Math.sqrt(gx * gx + gy * gy + gz * gz) || 1);
    gx *= il; gy *= il; gz *= il;
    normal[v * 3] = gx; normal[v * 3 + 1] = gy; normal[v * 3 + 2] = gz;
    if (ao){
      /* f0 = valor de f no próprio vértice (≈ 0; não é exatamente 0 em malhas grossas): descontado, para o erro de
         posição do vértice não virar sombra falsa */
      let occ = 0;
      const f0 = f(x, y, z);
      for (let s = 0; s < 4; s++){
        const d = aoR * (s === 0 ? 0.18 : s === 1 ? 0.42 : s === 2 ? 0.72 : 1), w = s === 0 ? 0.34 : s === 1 ? 0.28 : s === 2 ? 0.22 : 0.16;
        const q = (d - (f(x + gx * d, y + gy * d, z + gz * d) - f0)) / d;
        occ += w * (q < 0 ? 0 : q > 1 ? 1 : q);
      }
      occ = Math.min(1, occ * aoS);
      ao[v * 3] = 1 - occ * (1 - aoC[0]); ao[v * 3 + 1] = 1 - occ * (1 - aoC[1]); ao[v * 3 + 2] = 1 - occ * (1 - aoC[2]);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(position, 3));
  g.setAttribute('normal', new T.BufferAttribute(normal, 3));
  g.setAttribute('color', new T.BufferAttribute(ao || new Float32Array(nv * 3).fill(1), 3));
  if (opts.uv){
    const uv = new Float32Array(nv * 2);
    for (let v = 0; v < nv; v++){ const q = opts.uv(position[v * 3], position[v * 3 + 1], position[v * 3 + 2]); uv[v * 2] = q[0]; uv[v * 2 + 1] = q[1]; }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  }
  g.setIndex(new T.BufferAttribute(nv > 65535 ? idx.slice(0, ni) : new Uint16Array(idx.subarray(0, ni)), 1));
  g.computeBoundingSphere();
  return g;
};

/* ------------------------------------------------------------------------ tubo
   EV.mesh.tube(caminho, opts): caminho = Vector3[] ou (t) → Vector3 (t em 0..1).
   opts: {segments (24), radial (10), radius: número | [a, b] | (t) → número | [a, b], up?: Vector3 | (t) → Vector3
          (direção do semi-eixo a; sem `up` o referencial é transportado sem torção), caps?: true (pontas arredondadas)}.
   uv.x ao longo do tubo (0..1), uv.y em volta. Com um array de exatamente segments+1 pontos, eles são usados
   diretamente (bom para `update`); outros arrays são suavizados por EV.curve. */
let _tc = new Float32Array(0);
const _tA = V(0,0,0), _tB = V(0,0,0), _tT = V(0,0,0), _tP = V(0,0,0);
/* as resoluções são arredondadas aqui: `segments: 44 * quality` pode chegar fracionário sem corromper a malha */
function tubeDims(o){ const seg = Math.max(1, Math.round(o.segments || 24)), rad = Math.max(3, Math.round(o.radial || 10)), cap = o.caps ? Math.max(2, Math.round(o.capRings || 3)) : 0; return {seg, rad, cap, rows: seg + 1 + 2 * cap, cols: rad + 1}; }
function tubeFill(g, caminho, o){
  const {seg, rad, cap, cols} = g.userData.tube;
  const pos = g.attributes.position.array, nor = g.attributes.normal.array;
  /* centros */
  if (_tc.length < (seg + 1) * 3) _tc = new Float32Array((seg + 1) * 3);
  const C = _tc;
  let fn = caminho;
  if (Array.isArray(caminho)){
    if (caminho.length === seg + 1) fn = null;
    else { const cv = EV.curve(caminho); fn = t => cv.at(t, _tP); }
  }
  for (let k = 0; k <= seg; k++){ const p = fn ? fn(k / seg) : caminho[k]; C[k * 3] = p.x; C[k * 3 + 1] = p.y; C[k * 3 + 2] = p.z; }
  const rOpt = o.radius === undefined ? 0.5 : o.radius, rFn = typeof rOpt === 'function' ? rOpt : null;
  const upFn = typeof o.up === 'function' ? o.up : null, upV = (o.up && !upFn) ? o.up : null;
  let first = true;
  const ring = (row, cx, cy, cz, ra, rb, sc, off, hc) => {
    /* anel: centro deslocado por `off` ao longo da tangente, raios × sc; hc ≠ 0 nas calotas (inclina a normal) */
    let n = row * cols * 3;
    const ox = cx + _tT.x * off, oy = cy + _tT.y * off, oz = cz + _tT.z * off, sn = hc ? Math.sqrt(Math.max(0, 1 - sc * sc)) * (off < 0 ? -1 : 1) : 0;
    for (let j = 0; j <= rad; j++, n += 3){
      const a = j / rad * Math.PI * 2, cs = Math.cos(a), sn2 = Math.sin(a);
      pos[n] = ox + (_tA.x * ra * cs + _tB.x * rb * sn2) * sc; pos[n + 1] = oy + (_tA.y * ra * cs + _tB.y * rb * sn2) * sc; pos[n + 2] = oz + (_tA.z * ra * cs + _tB.z * rb * sn2) * sc;
      const ka = cs / ra * sc, kb = sn2 / rb * sc, kt = hc ? sn / hc : 0;
      let x = _tA.x * ka + _tB.x * kb + _tT.x * kt, y = _tA.y * ka + _tB.y * kb + _tT.y * kt, z = _tA.z * ka + _tB.z * kb + _tT.z * kt;
      const il = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
      nor[n] = x * il; nor[n + 1] = y * il; nor[n + 2] = z * il;
    }
  };
  for (let k = 0; k <= seg; k++){
    const t = k / seg, a = Math.max(0, k - 1) * 3, b = Math.min(seg, k + 1) * 3;
    _tT.set(C[b] - C[a], C[b + 1] - C[a + 1], C[b + 2] - C[a + 2]);
    if (_tT.lengthSq() < 1e-12) _tT.set(0, 1, 0); else _tT.normalize();
    if (upFn || upV){ _tA.copy(upFn ? upFn(t) : upV); }
    else if (first){ _tA.set(0, 1, 0); if (Math.abs(_tT.y) > 0.9) _tA.set(1, 0, 0); }
    _tA.addScaledVector(_tT, -_tA.dot(_tT));
    if (_tA.lengthSq() < 1e-10){                              // `up` paralelo à tangente: usa o eixo menos alinhado com ela
      if (Math.abs(_tT.x) < 0.9) _tA.set(1, 0, 0); else _tA.set(0, 1, 0);
      _tA.addScaledVector(_tT, -_tA.dot(_tT));
    }
    _tA.normalize(); first = false;
    _tB.crossVectors(_tT, _tA);
    const r = rFn ? rFn(t) : rOpt;
    let ra = typeof r === 'number' ? r : r[0], rb = typeof r === 'number' ? r : r[1];
    if (!(ra > 1e-4)) ra = 1e-4; if (!(rb > 1e-4)) rb = 1e-4;   // raio 0 (ponta de fuso) daria normais NaN
    const cx = C[k * 3], cy = C[k * 3 + 1], cz = C[k * 3 + 2];
    ring(cap + k, cx, cy, cz, ra, rb, 1, 0, 0);
    if (cap && (k === 0 || k === seg)){
      const hc = Math.min(ra, rb) * (o.capLength || 1);
      for (let e = 1; e <= cap; e++){
        const ps = e / cap * Math.PI / 2, sc = e === cap ? 0 : Math.cos(ps);
        ring(k === 0 ? cap - e : cap + seg + e, cx, cy, cz, ra, rb, Math.max(sc, 1e-4), (k === 0 ? -1 : 1) * hc * Math.sin(ps), hc);
      }
    }
  }
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  return g;
}
mesh.tube = (caminho, opts) => {
  const o = opts || {}, d = tubeDims(o), {seg, rad, cap, rows, cols} = d, nV = rows * cols;
  const g = new T.BufferGeometry();
  g.userData.tube = d;
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(nV * 3), 3));
  g.setAttribute('normal', new T.BufferAttribute(new Float32Array(nV * 3), 3));
  g.setAttribute('color', new T.BufferAttribute(new Float32Array(nV * 3).fill(1), 3));
  const uv = new Float32Array(nV * 2);
  for (let r = 0; r < rows; r++) for (let j = 0; j < cols; j++){ uv[(r * cols + j) * 2] = clamp((r - cap) / seg, 0, 1); uv[(r * cols + j) * 2 + 1] = j / rad; }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  const idx = nV > 65535 ? new Uint32Array((rows - 1) * rad * 6) : new Uint16Array((rows - 1) * rad * 6);
  let n = 0;
  for (let r = 0; r < rows - 1; r++) for (let j = 0; j < rad; j++){
    const a = r * cols + j, b = a + cols, c = b + 1, e = a + 1;
    idx[n++] = a; idx[n++] = e; idx[n++] = b; idx[n++] = b; idx[n++] = e; idx[n++] = c;
  }
  g.setIndex(new T.BufferAttribute(idx, 1));
  tubeFill(g, caminho, o);
  g.computeBoundingSphere();
  return g;
};
/* Reescreve position/normal no lugar (mesma topologia: mesmos segments/radial/caps da criação). */
mesh.tubeUpdate = (geom, caminho, opts) => { tubeFill(geom, caminho, opts || {}); if (geom.boundingSphere) geom.boundingSphere.radius = 1e4; return geom; };

/* ---------------------------------------------------------------------- lâmina
   EV.mesh.sheet(opts): músculo em lâmina com espessura.
   opts: {rows (24, ao longo de u), cols (12, ao longo de v), point: (u, v) → Vector3 (superfície média),
          normal: (u, v) → Vector3 (lado de fora), thickness: (u, v) → cm | número, edge?: [eu, ev] (largura, em
          fração de u e de v, da faixa onde a borda se arredonda; padrão automático)}.
   u = origem → inserção (direção das fibras), v = através. Casca fechada: face de fora, face de dentro e bordas
   arredondadas. uv = (u, v). Os Vector3 devolvidos por point/normal podem ser reaproveitados (são copiados). */
function sheetParams(n, e){
  /* n+1 parâmetros em 0..1 com 3 anéis apertados junto de cada borda (perfil circular da borda) */
  const a = [0, e * 0.16, e * 0.5, e];
  const out = new Float32Array(n + 1), w = new Float32Array(n + 1);
  const inner = n - 6;
  for (let k = 0; k <= n; k++){
    let u;
    if (k <= 3) u = a[k]; else if (k >= n - 3) u = 1 - a[n - k]; else u = lerp(e, 1 - e, (k - 3) / inner);
    out[k] = u;
    const d = Math.min(u, 1 - u) / e;
    w[k] = d >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - d) * (1 - d)));
  }
  return {t: out, w};
}
function sheetFill(g, o){
  const s = g.userData.sheet, {R, C, U, V2, n1} = s;
  const pos = g.attributes.position.array, nor = g.attributes.normal.array;
  const thF = typeof o.thickness === 'function' ? o.thickness : null, thC = thF ? 0 : (o.thickness === undefined ? 0.6 : o.thickness);
  for (let i = 0; i <= R; i++) for (let j = 0; j <= C; j++){
    const u = U.t[i], v = V2.t[j];
    const p = o.point(u, v); const px = p.x, py = p.y, pz = p.z;
    const nn = o.normal(u, v); const il = 1 / (Math.hypot(nn.x, nn.y, nn.z) || 1);
    const h = 0.5 * (thF ? thF(u, v) : thC) * U.w[i] * V2.w[j];
    const hx = nn.x * il * h, hy = nn.y * il * h, hz = nn.z * il * h;
    const a = (i * (C + 1) + j) * 3, b = a + n1 * 3;
    pos[a] = px + hx; pos[a + 1] = py + hy; pos[a + 2] = pz + hz;
    pos[b] = px - hx; pos[b + 1] = py - hy; pos[b + 2] = pz - hz;
  }
  /* normais suaves: soma das normais das faces (os vértices da borda são compartilhados entre as duas faces) */
  nor.fill(0);
  const idx = g.index.array;
  for (let q = 0; q < idx.length; q += 3){
    const a = idx[q] * 3, b = idx[q + 1] * 3, c = idx[q + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    nor[a] += x; nor[a + 1] += y; nor[a + 2] += z; nor[b] += x; nor[b + 1] += y; nor[b + 2] += z; nor[c] += x; nor[c + 1] += y; nor[c + 2] += z;
  }
  for (let q = 0; q < nor.length; q += 3){ const il = 1 / (Math.hypot(nor[q], nor[q + 1], nor[q + 2]) || 1); nor[q] *= il; nor[q + 1] *= il; nor[q + 2] *= il; }
  /* cópias (não usadas) da borda na grade de dentro acompanham a de fora */
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  return g;
}
mesh.sheet = opts => {
  const R = Math.max(8, Math.round(opts.rows || 24)), C = Math.max(8, Math.round(opts.cols || 12)), n1 = (R + 1) * (C + 1);   // arredonda (rows: 22 * quality)
  /* largura da faixa de borda: ~ metade da espessura, em fração do comprimento/largura da lâmina */
  let eu, ev;
  if (opts.edge){ eu = opts.edge[0]; ev = opts.edge[1]; }
  else {
    const th = typeof opts.thickness === 'function' ? opts.thickness(0.5, 0.5) : (opts.thickness === undefined ? 0.6 : opts.thickness);
    const a = opts.point(0, 0.5).clone(), b = opts.point(1, 0.5).clone(), c = opts.point(0.5, 0).clone(), d = opts.point(0.5, 1).clone(), m = opts.point(0.5, 0.5).clone();
    eu = clamp(0.7 * th / Math.max(0.1, a.distanceTo(m) + m.distanceTo(b)), 0.01, 0.14);
    ev = clamp(0.7 * th / Math.max(0.1, c.distanceTo(m) + m.distanceTo(d)), 0.01, 0.14);
  }
  const g = new T.BufferGeometry();
  const U = sheetParams(R, eu), V2 = sheetParams(C, ev);
  g.userData.sheet = {R, C, U, V2, n1};
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(n1 * 6), 3));
  g.setAttribute('normal', new T.BufferAttribute(new Float32Array(n1 * 6), 3));
  g.setAttribute('color', new T.BufferAttribute(new Float32Array(n1 * 6).fill(1), 3));
  const uv = new Float32Array(n1 * 4);
  for (let i = 0; i <= R; i++) for (let j = 0; j <= C; j++){ const a = (i * (C + 1) + j) * 2; uv[a] = uv[a + n1 * 2] = U.t[i]; uv[a + 1] = uv[a + n1 * 2 + 1] = V2.t[j]; }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  /* orientação: (dP/du × dP/dv) deve apontar para o lado de fora */
  const p0 = opts.point(0.5, 0.5).clone(), du = opts.point(0.56, 0.5).clone().sub(p0), dv = opts.point(0.5, 0.56).clone().sub(p0);
  const flip = du.cross(dv).dot(opts.normal(0.5, 0.5)) < 0;
  const border = (i, j) => i === 0 || i === R || j === 0 || j === C;
  const o = (i, j) => i * (C + 1) + j, inn = (i, j) => border(i, j) ? o(i, j) : n1 + o(i, j);
  const idx = n1 * 2 > 65535 ? new Uint32Array(R * C * 12) : new Uint16Array(R * C * 12);
  let n = 0;
  const tri = (a, b, c, inv) => { idx[n++] = a; if (inv){ idx[n++] = c; idx[n++] = b; } else { idx[n++] = b; idx[n++] = c; } };
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++){
    tri(o(i, j), o(i + 1, j), o(i + 1, j + 1), flip); tri(o(i, j), o(i + 1, j + 1), o(i, j + 1), flip);
    tri(inn(i, j), inn(i + 1, j), inn(i + 1, j + 1), !flip); tri(inn(i, j), inn(i + 1, j + 1), inn(i, j + 1), !flip);
  }
  g.setIndex(new T.BufferAttribute(idx, 1));
  sheetFill(g, opts);
  g.computeBoundingSphere();
  return g;
};
mesh.sheetUpdate = (geom, opts) => { sheetFill(geom, opts); if (geom.boundingSphere) geom.boundingSphere.radius = 1e4; return geom; };

/* extra: garante o atributo `color` (branco) — os materiais de EV usam cor de vértice (oclusão de ambiente) e uma
   geometria sem esse atributo sairia preta. O app chama isto para toda malha das peças. */
mesh.ensureColor = geom => {
  if (geom && geom.attributes && geom.attributes.position && !geom.attributes.color)
    geom.setAttribute('color', new T.BufferAttribute(new Float32Array(geom.attributes.position.count * 3).fill(1), 3));
  return geom;
};

/* ==================================================================== TEXTURAS */
/* extra: paleta compartilhada (cores CSS em sRGB, "como se vê na tela"). Texturas e cores feitas dentro das peças
   devem ler daqui, para o conjunto mudar junto quando a paleta for afinada. São as cores da SUPERFÍCIE (albedo):
   na tela as sombras saem mais escuras e as luzes mais claras, por causa da luz e do acabamento dos materiais. */
EV.pal = {
  muscle: {base: '#b25421', light: '#d47a40', dark: '#6a280d'},
  tendon: {base: '#e2c188', light: '#f3dfb4', dark: '#b9945c'},
  bone: '#f6ecd0', cartilage: '#efe2b8', ghost: '#f4e6df'
};
const tex = EV.tex = {};
function rng(seed){ let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* Textura de fibras correndo ao longo de X (uv.x), ladrilhável nas duas direções. Cada estria é uma lente fina
   (ponta afilada, como um fascículo), em várias escalas: faixas tonais largas e muito suaves, feixes grossos,
   feixes, fibras finas e uns poucos septos escuros compridos — assim as fibras continuam visíveis quando a
   textura é reduzida na tela (num dedo do serrátil cada texel vale ~0,1 mm), sem virar veio de madeira.
   opts: {size (512), base, light, dark (cores CSS), streaks (1 = densidade padrão), seed (7), contrast (1),
          gray: true (versão em tons de cinza para bumpMap, com o mesmo desenho da versão colorida de mesma seed)}. */
tex.fibers = opts => {
  const o = opts || {}, S = o.size || 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'), rnd = rng(o.seed || 7), gray = !!o.gray, k = o.contrast === undefined ? 1 : o.contrast, dens = o.streaks === undefined ? 1 : o.streaks;
  const base = gray ? '#808080' : (o.base || EV.pal.muscle.base), light = gray ? '#ffffff' : (o.light || EV.pal.muscle.light), dark = gray ? '#000000' : (o.dark || EV.pal.muscle.dark);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  const e = S / 512;                                                    // as medidas abaixo são para 512 px
  /* [quantidade, largura mín., máx. (px), opacidade mín., máx., comprimento mín., máx. (fração de S), fração de claras] */
  const niveis = [
    [18, 30, 80, 0.05, 0.11, 0.7, 1.5, 0.5],                           // faixas tonais largas
    [110, 9, 24, 0.06, 0.15, 0.35, 1.1, 0.5],                          // feixes grossos
    [380, 3.0, 9.0, 0.07, 0.18, 0.30, 1.0, 0.48],                      // feixes
    [1400, 0.8, 2.4, 0.08, 0.26, 0.10, 0.60, 0.42],                    // fibras finas
    [34, 1.4, 4.2, 0.26, 0.50, 0.40, 1.2, 0],                          // septos escuros entre os feixes
    [12, 4.5, 9.0, 0.16, 0.30, 0.55, 1.3, 0]];                         // …e uns poucos sulcos mais largos
  for (const [n, w0, w1, a0, a1, l0, l1, fc] of niveis){
    for (let i = 0; i < n * dens; i++){
      const y = rnd() * S, x0 = rnd() * S, len = S * lerp(l0, l1, rnd() * rnd()), w = e * lerp(w0, w1, rnd() * rnd()), claro = rnd() < fc;
      const al = lerp(a0, a1, rnd()) * k * (claro ? 0.9 : 1), ang = (rnd() - 0.5) * 0.035;
      x.fillStyle = claro ? light : dark; x.globalAlpha = Math.min(1, al);
      const rx = len / 2, ry = w / 2, by = ry + Math.abs(ang) * rx + 1;
      for (const ox of [-S, 0, S]){
        if (x0 + ox + rx < 0 || x0 + ox - rx > S) continue;
        for (const oy of [-S, 0, S]){                                   // repete nas bordas para ladrilhar
          if (y + oy + by < 0 || y + oy - by > S) continue;
          x.beginPath(); x.ellipse(x0 + ox, y + oy, rx, ry, ang, 0, 6.2832); x.fill();
        }
      }
    }
  }
  x.globalAlpha = 1;
  const t = new T.CanvasTexture(cv);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
  if (!gray) t.encoding = T.sRGBEncoding;
  return t;
};

/* =================================================================== MATERIAIS
   Cada chamada devolve uma instância nova. Todos usam cor de vértice (branca por padrão; EV.mesh.fromSDF grava
   nela a oclusão de ambiente). Geometrias próprias sem atributo `color`: use EV.mesh.ensureColor (o app já faz). */
const mats = EV.mats = {};
/* No three.js r128 as cores em hexadecimal são tomadas como lineares; srgb() converte uma cor "como se vê na tela"
   (sRGB) para o espaço linear dos materiais. (extra: EV.srgb) */
const srgb = EV.srgb = hex => new T.Color(hex).convertSRGBToLinear();
/* extra: EV.mats.look — parâmetros globais do acabamento, lidos por todos os materiais (o app os ajusta):
   px.value = espessura do traço de contorno em pixels do canvas (o app a escala com o tamanho da tela);
   cage.value = (y de baixo, y de cima, z do eixo) do gradil costal, para a penumbra do lado de dentro;
   box.value = direção, no espaço da CÂMERA, da caixa de luz virtual que dá o brilho largo (junto da câmera, um
   pouco acima: na prancha só o que está bem de frente para quem olha — a escápula direita, o sacro — fica branco). */
const LOOK = mats.look = {px: {value: 1.3}, cage: {value: new T.Vector3(3, 51, -2.1)}, box: {value: new T.Vector3(0.0, 0.16, 1).normalize()}};
try { const r = EV.thorax.range(); LOOK.cage.value.set(r[0], r[1], EV.thorax.center((r[0] + r[1]) / 2).z); } catch (e) { /* fica o padrão */ }
/* Acabamento de "render de atlas" aplicado sobre o MeshStandardMaterial:
   - ganho: exposição própria do material (as luzes da cena ficam como o corpo fantasma precisa), com um joelho
     opcional que comprime as luzes canal a canal (como um filme): no osso, o claro-escuro e a cor pintados nas
     malhas (oclusão de ambiente creme ou lavanda) saem suaves como as peças os calibraram, e o marfim não estoura;
   - brilho: reflexo LARGO e macio de uma caixa de luz virtual junto da câmera (porcelana / osso polido / músculo
     úmido): clareia o que está de frente para quem olha, só onde chega luz direta (some na sombra e por dentro);
   - embaixo: o que olha para o chão escurece e esfria (osso: lavanda; músculo: castanho) — é o que separa a
     face de cima da de baixo das costelas e cava os sulcos entre os feixes;
   - dentro: as superfícies do tronco viradas para o EIXO do gradil (face interna das costelas do outro lado, face
     costal da escápula, o lado de baixo dos músculos) recebem uma penumbra oliva — a luz de céu não entra na caixa;
   - sombra: nas partes escuras a cor é multiplicada por uma tinta (osso: lavanda; músculo: vermelho-tijolo),
     de modo que a cor muda de matiz da luz para a sombra em vez de só escurecer;
   - borda: escurece e tinge a superfície nos ângulos rasantes (faixa larga e suave, dá volume aos feixes);
   - traço: contorno fino de espessura constante NA TELA (distância até a silhueta estimada pelas derivadas de N·V),
     que não engrossa nas faces planas vistas de raspão;
   - tinta de estado: m.userData.evTint.value = (r, g, b lineares, quantidade 0..1). O app escreve aqui para tingir
     o músculo (vermelho = encurtado, azul = esticado); a cor final é MISTURADA com a tinta modulada pela
     luminância, de modo que o azul aparece azul mesmo sobre a textura laranja.
   c: {gain, knee (saída = gain·x / (1 + knee·x)), toe (pé da curva: subtrai um pouco de cada canal nas partes
       iluminadas, o que aviva o laranja sem enegrecer as sombras), spec: [r,g,b] cor do brilho,
       specP: expoente (menor = mais largo), box: [x,y,z] direção própria da caixa de luz (padrão:
       EV.mats.look.box), rim: [r,g,b] cor na borda, rimS: força, rimP: potência, line: [r,g,b] cor do traço,
       lineS: força do traço, shade: [r,g,b] tinta das sombras, shadeL: luminância (linear) acima da qual a tinta
       some, in: [r,g,b] penumbra de dentro, inS: força, under: [r,g,b] tinta do que olha para baixo,
       underS: quanto escurece (1 = nada)}. */
function rim(m, c){
  const tint = m.userData.evTint = {value: new T.Vector4(0, 0, 0, 0)};
  m.onBeforeCompile = sh => {
    const v3 = a => new T.Vector3(a[0], a[1], a[2]);
    sh.uniforms.evGain = {value: new T.Vector3(c.gain, c.knee || 0, c.toe || 0)};
    sh.uniforms.evSpec = {value: new T.Vector4(c.spec[0], c.spec[1], c.spec[2], c.specP)};
    sh.uniforms.evRimC = {value: v3(c.rim)};
    sh.uniforms.evRimS = {value: new T.Vector3(c.rimS, c.rimP, c.lineS)};
    sh.uniforms.evLineC = {value: v3(c.line)};
    sh.uniforms.evShade = {value: new T.Vector4(c.shade[0], c.shade[1], c.shade[2], c.shadeL)};
    sh.uniforms.evIn = {value: new T.Vector4(c.in[0], c.in[1], c.in[2], c.inS)};
    sh.uniforms.evUnder = {value: new T.Vector4(c.under[0], c.under[1], c.under[2], c.underS)};
    sh.uniforms.evCage = LOOK.cage; sh.uniforms.evPx = LOOK.px;
    sh.uniforms.evBox = c.box ? {value: v3(c.box).normalize()} : LOOK.box;
    sh.uniforms.evTint = tint;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEvW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vEvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEvW;\nuniform vec3 evGain;\nuniform vec4 evSpec;\nuniform vec3 evRimC;\nuniform vec3 evRimS;\nuniform vec3 evLineC;\nuniform vec4 evShade;\nuniform vec4 evIn;\nuniform vec4 evUnder;\nuniform vec3 evCage;\nuniform vec3 evBox;\nuniform float evPx;\nuniform vec4 evTint;')
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', [
        'vec3 evV = normalize(vViewPosition);',
        'float evNV = clamp(abs(dot(evV, geometryNormal)), 0.0, 1.0);',
        'float evF = 1.0 - evNV;',
        /* dentro do gradil */
        'vec3 evWN = inverseTransformDirection(geometryNormal, viewMatrix);',
        'vec2 evR = vEvW.xz - vec2(0.0, evCage.z);',
        'float evRd = max(length(evR), 1e-3);',
        'float evK = clamp(-dot(evWN.xz, evR) / evRd, 0.0, 1.0) * smoothstep(2.5, 7.0, evRd) * smoothstep(evCage.x - 3.0, evCage.x + 7.0, vEvW.y) * (1.0 - smoothstep(evCage.y - 7.0, evCage.y + 1.0, vEvW.y));',
        /* pé + ganho + brilho largo da caixa de luz (só onde há luz direta) */
        'float evE = dot(reflectedLight.directDiffuse, vec3(0.3333)) / max(dot(material.diffuseColor, vec3(0.3333)), 0.02);',
        'outgoingLight = max(outgoingLight - evGain.z * min(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)) / 0.12, 1.0), vec3(0.0));',
        'outgoingLight *= evGain.x / (1.0 + evGain.y * outgoingLight);',
        'outgoingLight += evSpec.rgb * pow(max(dot(normal, normalize(evV + evBox)), 0.0), evSpec.a) * smoothstep(0.10, 0.42, evE) * (1.0 - evK);',
        'outgoingLight *= mix(vec3(1.0), evIn.rgb, evIn.a * evK);',
        /* embaixo + sombras tingidas; as duas tintas somem onde a cor de vértice já vem lavanda — o crânio traz a
           sua própria sombra de baixo pintada na malha */
        'float evLav = 0.0;',
        '#ifdef USE_COLOR',
        '  evLav = clamp((vColor.b - 0.5 * (vColor.r + vColor.g)) * 14.0, 0.0, 1.0);',
        '#endif',
        'outgoingLight *= mix(vec3(1.0), evUnder.rgb * evUnder.a, smoothstep(-0.05, -0.75, evWN.y) * (1.0 - evLav));',
        'float evL = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));',
        'outgoingLight *= mix(mix(evShade.rgb, vec3(dot(evShade.rgb, vec3(0.3333))), evLav), vec3(1.0), smoothstep(0.0, evShade.a, evL));',
        /* borda larga + traço fino */
        'outgoingLight *= mix(vec3(1.0), evRimC, clamp(evRimS.x * pow(evF, evRimS.y), 0.0, 1.0));',
        'float evD = evNV / max(fwidth(evNV), 1e-5);',
        'float evLn = (1.0 - smoothstep(evPx, evPx * 2.4, evD)) * (1.0 - smoothstep(0.30, 0.62, evNV)) * evRimS.z;',
        'outgoingLight *= mix(vec3(1.0), evLineC, evLn);',
        /* tinta de estado */
        'outgoingLight = mix(outgoingLight, evTint.rgb * (0.22 + 1.7 * dot(outgoingLight, vec3(0.30, 0.59, 0.11))), evTint.a);',
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );'].join('\n  '));
  };
  m.customProgramCacheKey = () => 'evlook';
  return m;
}
const OSSO = {gain: 1.25, knee: 0.9, spec: [0.36, 0.36, 0.34], specP: 12, rim: [0.74, 0.70, 0.44], rimS: 0.75, rimP: 2.6, line: [0.30, 0.28, 0.22], lineS: 0.80,
  shade: [0.98, 0.96, 1.04], shadeL: 0.40, in: [0.86, 0.85, 0.78], inS: 0.72, under: [1.0, 0.95, 1.36], underS: 0.70};
/* no músculo a caixa de luz fica mais alta: o brilho corre pelo alto de cada feixe roliço e não lava as lâminas largas */
const CARNE = {gain: 1.10, toe: 0.006, spec: [0.24, 0.10, 0.038], specP: 14, box: [-0.25, 0.85, 1], rim: [0.46, 0.25, 0.17], rimS: 0.82, rimP: 1.7, line: [0.30, 0.16, 0.11], lineS: 0.75,
  shade: [1.0, 0.93, 0.86], shadeL: 0.15, in: [0.72, 0.62, 0.58], inS: 0.7, under: [1.0, 0.82, 0.76], underS: 0.76};
const FAIXA = {gain: 1.10, toe: 0.006, spec: [0.10, 0.09, 0.07], specP: 10, rim: [0.66, 0.54, 0.38], rimS: 0.55, rimP: 1.8, line: [0.40, 0.31, 0.22], lineS: 0.60,
  shade: [0.97, 0.92, 0.86], shadeL: 0.35, in: [0.60, 0.55, 0.45], inS: 0.8, under: [1.0, 0.92, 0.88], underS: 0.76};
mats.bone = o => rim(new T.MeshStandardMaterial(Object.assign({color: srgb(EV.pal.bone), roughness: 0.42, metalness: 0.0, vertexColors: true}, o || {})), OSSO);
mats.cartilage = o => rim(new T.MeshStandardMaterial(Object.assign({color: srgb(EV.pal.cartilage), roughness: 0.48, metalness: 0.0, vertexColors: true}, o || {})),
  Object.assign({}, OSSO, {spec: [0.20, 0.20, 0.18], rim: [0.70, 0.62, 0.40]}));
let _fibC = null, _fibB = null, _tenC = null;
/* Clones de textura por `repeat`, reaproveitados entre materiais: no r128 cada clone é um upload próprio na GPU,
   e um material por digitação multiplicaria as texturas. (Por isso `material.map` é compartilhado: para outro
   repeat, peça outro material com {repeat} em vez de mexer em map.repeat.) */
const _texCache = new Map();
const texClone = (t, rep) => {
  const key = t.uuid + '|' + (rep ? rep[0] + ',' + rep[1] : '');
  let c = _texCache.get(key);
  if (!c){ c = t.clone(); c.needsUpdate = true; if (rep) c.repeat.set(rep[0], rep[1]); _texCache.set(key, c); }
  return c;
};
/* Músculo: laranja de atlas com fibras ao longo de uv.x. opts: {repeat: [u, v] (padrão [1, 1]; em tubos v deve
   ser inteiro para não aparecer emenda), bump (relevo das fibras em cm, 0.04), ...demais opções do material}.
   Fosco de propósito (roughness 0.72): o reflexo branco das luzes lavava o laranja das lâminas largas; o brilho
   úmido do músculo vem da caixa de luz do acabamento, que é alaranjado. */
mats.muscle = opts => {
  const o = Object.assign({}, opts || {}), rep = o.repeat || [1, 1], bump = o.bump === undefined ? 0.04 : o.bump;
  delete o.repeat; delete o.bump;
  if (!_fibC){ _fibC = tex.fibers({seed: 11}); _fibB = tex.fibers({seed: 11, gray: true}); }
  return rim(new T.MeshStandardMaterial(Object.assign({color: 0xffffff, map: texClone(_fibC, rep), bumpMap: texClone(_fibB, rep), bumpScale: bump,
    roughness: 0.72, metalness: 0.0, vertexColors: true}, o)), CARNE);
};
/* Tendão / aponeurose: creme com fibras discretas. opts: {repeat: [u, v]}. */
mats.tendon = opts => {
  const o = Object.assign({}, opts || {}), rep = o.repeat || [2, 2];
  delete o.repeat;
  if (!_tenC) _tenC = tex.fibers({seed: 23, base: EV.pal.tendon.base, light: EV.pal.tendon.light, dark: EV.pal.tendon.dark, streaks: 0.8, contrast: 0.7});
  return rim(new T.MeshStandardMaterial(Object.assign({color: 0xffffff, map: texClone(_tenC, rep), roughness: 0.5, metalness: 0.0, vertexColors: true}, o)), FAIXA);
};
/* Corpo "fantasma": rosa-claro translúcido, desenhado ANTES de tudo e sem escrever profundidade (fica atrás dos
   ossos e músculos), mais opaco nos ângulos rasantes. opts: {color, opacity (centro), rim (borda)}. */
mats.ghost = opts => {
  const o = Object.assign({}, opts || {}), a0 = o.opacity === undefined ? 0.40 : o.opacity, a1 = o.rim === undefined ? 0.80 : o.rim;
  delete o.opacity; delete o.rim;
  const m = new T.MeshStandardMaterial(Object.assign({color: srgb(0x7a6154), emissive: srgb(0xb6927d), roughness: 0.85, metalness: 0.0, toneMapped: false,
    transparent: false, depthWrite: false, blending: T.CustomBlending, blendSrc: T.SrcAlphaFactor, blendDst: T.OneMinusSrcAlphaFactor,
    blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor}, o));
  m.userData.ghost = true;
  m.onBeforeCompile = sh => {
    sh.uniforms.evA0 = {value: a0}; sh.uniforms.evA1 = {value: a1};
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float evA0;\nuniform float evA1;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  float evF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));\n  gl_FragColor.a = mix(evA0, evA1, evF * evF);');
  };
  return m;
};
})();
