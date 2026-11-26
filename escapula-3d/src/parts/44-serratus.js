/* Peça `serratus` — serrátil anterior dos dois lados.
   Nove digitações ("dedos") gordas, das costelas 1–9 à face costal da borda medial da escápula. Cada dedo é uma
   malha própria em forma de salsicha achatada: fundo quase plano deitado sobre o gradil, dorso em superelipse
   (ombros arredondados), ponta rombuda e cheia onde nasce na costela. O trajeto corre na superfície externa do
   gradil em coordenadas cilíndricas (azimute θ, altura y): reta em (θ, y) — uma hélice — com uma barriga opcional.
   Os dedos de cima (1–5) correm quase horizontais e paralelos por baixo da escápula; os de baixo (6–9) convergem
   em leque para o ângulo inferior, empilhados como cartas (o de cima cobre o de baixo).
   Debaixo da lâmina o dorso é "prensado" pelo osso: cada vértice é limitado pela face costal da escápula (modelo
   analítico no referencial local, que acompanha todos os movimentos); no fim, o dedo sobe do gradil até a
   inserção, na face costal junto da borda medial.
   Os dois lados usam a MESMA geometria (o esquerdo é a malha espelhada em X), reescrita no lugar em `update`. */
(() => {
EV.register('serratus', ({THREE, EV, quality}) => {
  const clamp = EV.clamp, lerp = EV.lerp, sst = EV.smoothstep;
  const group = new THREE.Group();
  const V3 = () => new THREE.Vector3();
  const L = EV.scap.L, KS = -L.infAngle.y / 13.4;                     // escala da escápula (medidas nominais → cm)

  /* ------------------------------------------------------------------ gradil
     eixo do tórax zc(y) (tabela; a função do core aloca) e raio do "trilho" (o gradil tratado como cilindro
     acima de T2, como faz a cinemática da escápula) */
  const ZY0 = -12, ZDY = 0.5, ZN = 170, ZT = new Float32Array(ZN);
  for (let k = 0; k < ZN; k++) ZT[k] = EV.thorax.center(ZY0 + k * ZDY).z;
  const zc = y => { const f = clamp((y - ZY0) / ZDY, 0, ZN - 1.001), k = f | 0; return ZT[k] + (ZT[k + 1] - ZT[k]) * (f - k); };
  const Y_TOP = EV.spine.v('T2').pos.y + 0.5;
  const _w = V3(), _w2 = V3();
  const railR = (th, y, st) => {
    const yc = y < Y_TOP ? y : Y_TOP, z0 = zc(yc);
    _w.set(0.01 * Math.sin(th), yc, z0 + 0.01 * Math.cos(th));
    EV.thorax.wrap(_w, 0, st, _w2);
    return Math.hypot(_w2.x, _w2.z - z0);
  };
  /* normal da superfície do trilho em (θ, y) → out */
  const railN = (th, y, st, out) => {
    const yc = y < Y_TOP ? y : Y_TOP;
    _w.set(10 * Math.sin(th), yc, zc(yc) + 10 * Math.cos(th));
    EV.thorax.out(_w, st, out);
    if (y > Y_TOP - 1.5){ out.y *= 1 - sst(Y_TOP - 1.5, Y_TOP, y); out.normalize(); }
    return out;
  };

  /* ---------------------------------------------------------------- escápula
     contorno da lâmina e altura da face costal em coordenadas locais NOMINAIS (cm ÷ KS) */
  let _dl = 0;                                                        // distância para dentro da borda lateral (efeito colateral de `borda`)
  const borda = (x, y) => {                                           // > 0 fora do contorno (polígono convexo)
    let d = -0.75 - x, e;
    e = -((x + 0.25) * 0.958 - y * 0.285); if (e > d) d = e;          // borda medial, parte de cima
    e = -((x + 0.75) * 0.952 + (y + 9.2) * 0.306); if (e > d) d = e;  // borda medial, parte de baixo
    e = (x - 0.85) * 0.739 - (y + 13.6) * 0.6736; _dl = -e; e -= 0.2; if (e > d) d = e;   // borda lateral
    e = (x - 1.0) * 0.199 + (y - 3.9) * 0.98; if (e > d) d = e;       // borda superior
    e = x - 10.8; if (e > d) d = e;
    return d;
  };
  const zCostal = (x, y) => {                                         // chamar logo depois de borda(x, y)
    const xx = x < -1 ? -1 : x > 11 ? 11 : x, b = 1 - _dl * _dl / 2.56, cr = b > 0 ? b * b : 0;
    return -0.30 - 0.065 * xx - 0.2 * (y > 0 ? y : 0) + 0.1 * sst(-9, -13, y) - (0.12 + 0.03 * xx) * cr;
  };
  /* referencial da escápula direita num estado: origem e eixos no mundo (sem alocar) */
  const SO = V3(), SX = V3(), SY = V3(), SZ = V3(), _l = V3();
  const pegaEscapula = st => {
    EV.scap.toWorld(_l.set(0, 0, 0), 1, st, SO);
    EV.scap.toWorld(_l.set(1, 0, 0), 1, st, SX).sub(SO);
    EV.scap.toWorld(_l.set(0, 1, 0), 1, st, SY).sub(SO);
    EV.scap.toWorld(_l.set(0, 0, 1), 1, st, SZ).sub(SO);
  };

  /* -------------------------------------------------------------- digitações
     ref: onde a ponta do dedo (a origem) aparece na prancha de referência, em frações da prancha. Na construção, o
       raio da câmera 'ref' por esse ponto é cruzado com o gradil: assim as pontas caem onde a referência mostra
       mesmo que as costelas sejam retocadas. th/y: a mesma origem em coordenadas cilíndricas de repouso (azimute
       em graus, 0 = trás, 90 = lado; altura em cm) — conferência e reserva, se o raio não encontrar o gradil ali.
       Na respiração a origem acompanha a costela `rib` (os dedos da referência ficam logo abaixo da costela, no
       espaço intercostal).
     tm/ix/iy: inserção = borda medial em tm + (ix, iy) nominais para dentro da lâmina.
     a0/a1: meia-largura na origem / na inserção; pw: expoente da cunha; sa: onde começa a afinar;
     au: fator da metade de cima (a que fica escondida debaixo do dedo vizinho); h: altura do dorso;
     bow: barriga do trajeto no meio (cm, + para cima);
     tau: inclinação da seção (rad) — cada dedo é uma telha: a borda de baixo sobe e cobre o dedo seguinte
       (plena de s = 0,25 até t1 − 0,3; zero na ponta e de t1 em diante);
     ck/cn: comprimento (× meia-largura) e expoente da ponta rombuda. */
  const DIG = [
    {rib: 1, th: 105.2, y: 41.46, ref: [0.4306, 0.3815], tm: 0.03,  ix: 0.75, iy: 0.1, a0: 1.30, a1: 1.35, au: 1,    pw: 1,   h: 0.65, bow: 0,    tau: 0.04, t1: 0.55, sa: 0.3,  ck: 0.8,  cn: 2.6},
    {rib: 2, th: 105.8, y: 38.08, ref: [0.4618, 0.4270], tm: 0.26,  ix: 1.3, iy: 0,    a0: 1.55, a1: 1.6,  au: 1,    pw: 1,   h: 0.80, bow: 0,    tau: 0.06, t1: 0.55, sa: 0.3,  ck: 0.8,  cn: 2.6},
    {rib: 3, th: 106.4, y: 35.04, ref: [0.4858, 0.4677], tm: 0.50,  ix: 1.3, iy: 0,    a0: 1.60, a1: 2.0,  au: 1,    pw: 1,   h: 1.00, bow: 0,    tau: 0.07, t1: 0.55, sa: 0.3,  ck: 0.75, cn: 2.8},
    {rib: 4, th: 106.4, y: 31.97, ref: [0.5030, 0.5084], tm: 0.70,  ix: 1.3, iy: 0,    a0: 1.95, a1: 1.8,  au: 1,    pw: 1,   h: 1.05, bow: 0,    tau: 0.07, t1: 0.6,  sa: 0.3,  ck: 0.7,  cn: 3.0},
    {rib: 5, th: 108.8, y: 28.64, ref: [0.5189, 0.5509], tm: 0.85,  ix: 1.1, iy: 0,    a0: 1.75, a1: 1.1,  au: 1,    pw: 1,   h: 1.05, bow: 0.1,  tau: 0.08, t1: 0.7,  sa: 0.35, ck: 0.75, cn: 2.8},
    {rib: 6, th: 103.9, y: 25.54, ref: [0.5210, 0.5935], tm: 0.95,  ix: 0.9, iy: 0,    a0: 1.60, a1: 0.3,  au: 1.1,  pw: 1.0, h: 1.05, bow: 0.5,  tau: 0.09, t1: 1.0,  sa: 0.06, ck: 0.75, cn: 2.8},
    {rib: 7, th:  97.9, y: 22.62, ref: [0.5142, 0.6346], tm: 0.968, ix: 0.8, iy: 0,    a0: 1.80, a1: 0.3,  au: 1.1,  pw: 2.1, h: 1.05, bow: 0.75, tau: 0.09, t1: 1.0,  sa: 0.06, ck: 0.8,  cn: 2.6},
    {rib: 8, th:  90.2, y: 19.85, ref: [0.4950, 0.6745], tm: 0.985, ix: 0.7, iy: 0.1,  a0: 1.80, a1: 0.3,  au: 1.6, pw: 1.0, h: 0.95, bow: 0.15, tau: 0.09, t1: 1.0,  sa: 0.06, ck: 0.8,  cn: 2.6},
    {rib: 9, th:  91.8, y: 15.88, ref: [0.4810, 0.7220], tm: 0.998, ix: 0.5, iy: 0.3,  a0: 1.42, a1: 0.3,  au: 1.2,  pw: 0.8, h: 0.88, bow: -0.3, tau: 0.06, t1: 1.0,  sa: 0.06, ck: 0.8,  cn: 2.6}
  ];
  const ND = DIG.length;
  const MARG = 0.05, HB = 0.16, H1 = 0.30;                            // folga sobre o gradil; meia-altura do fundo; dorso na inserção
  /* câmera 'ref' (a mesma do app) e o ponto do gradil visto numa fração (fx, fy) da prancha → [θ, y] ou null */
  const camRef = (() => {
    const c = {az: 31.4, el: 8.1, dist: 110, target: [14.4, 33.5, 0], fov: 36.6, roll: 2.7}, D = Math.PI / 180, a = c.az * D, e = c.el * D;
    const cam = new THREE.PerspectiveCamera(c.fov, 876 / 1200, 1, 2000);
    cam.position.set(c.target[0] + c.dist * Math.sin(a) * Math.cos(e), c.target[1] + c.dist * Math.sin(e), c.target[2] + c.dist * Math.cos(a) * Math.cos(e));
    cam.up.set(0, 1, 0); cam.lookAt(c.target[0], c.target[1], c.target[2]); cam.rotateZ(c.roll * D);
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    return cam;
  })();
  const naVista = (fx, fy) => {
    const o = camRef.position, dir = EV.V(2 * fx - 1, 1 - 2 * fy, 0.5).unproject(camRef).sub(o).normalize(), p = V3();
    const folga = t => { p.copy(o).addScaledVector(dir, t); if (p.x <= 0) return 1; const dz = p.z - zc(p.y); return Math.hypot(p.x, dz) - railR(Math.atan2(p.x, dz), p.y, EV.REST) - MARG; };
    let ant = 1;
    for (let t = 70; t <= 170; t += 0.5){
      const c = folga(t);
      if (c <= 0 && ant > 0 && t > 70){
        let lo = t - 0.5, hi = t;
        for (let it = 0; it < 24; it++){ const m = (lo + hi) / 2; if (folga(m) > 0) lo = m; else hi = m; }
        folga((lo + hi) / 2);
        return [Math.atan2(p.x, p.z - zc(p.y)), p.y];
      }
      ant = c;
    }
    return null;
  };
  for (const d of DIG){
    const m = EV.scap.medial(d.tm), x = m.x / KS + d.ix, y = m.y / KS + d.iy;
    borda(x, y);
    d.pin = EV.V(x * KS, y * KS, (zCostal(x, y) - 0.03) * KS);        // inserção (local, cm), na face costal
    /* origem: raio da vista de referência × gradil (ou a reserva th/y) */
    d.th0 = d.th * Math.PI / 180;
    { const h = naVista(d.ref[0], d.ref[1]); if (h && Math.abs(h[0] - d.th0) < 0.2 && Math.abs(h[1] - d.y) < 2){ d.th0 = h[0]; d.y = h[1]; } }
    /* ponto da costela (em repouso) no mesmo azimute da origem: é ele que leva a origem na respiração */
    d.t = 0.6; let best = 1e9;
    for (let t = 0.3; t <= 0.95; t += 0.005){ const r = EV.ribs.point(d.rib, t, 1), e = Math.abs(Math.atan2(r.x, r.z - zc(r.y)) - d.th0); if (e < best){ best = e; d.t = t; d.rth = Math.atan2(r.x, r.z - zc(r.y)); d.ry = r.y; } }
    d.E = {tho: 0, yo: 0, thi: 0, yi: 0, gap: 0, len: 1, s0: 0.5};             // extremos do trajeto no estado corrente
    d.E2 = {tho: 0, yo: 0, thi: 0, yi: 0, gap: 0, len: 1, s0: 0.5};            // idem, para consultas (strain, marcador)
  }
  const _a = V3(), _b = V3(), _n = V3(), _mk = V3();
  /* extremos do trajeto do dedo d no estado st (precisa de pegaEscapula(st) antes) */
  const extremos = (d, st, E) => {
    EV.ribs.point(d.rib, d.t, 1, st, _a);                               // a origem acompanha o ponto da costela mais próximo
    E.tho = d.th0 + Math.atan2(_a.x, _a.z - zc(_a.y)) - d.rth; E.yo = d.y + _a.y - d.ry;
    const p = d.pin, wx = SO.x + SX.x * p.x + SY.x * p.y + SZ.x * p.z, wy = SO.y + SX.y * p.x + SY.y * p.y + SZ.y * p.z, wz = SO.z + SX.z * p.x + SY.z * p.y + SZ.z * p.z;
    const dz = wz - zc(wy), rI = Math.hypot(wx, dz);
    E.thi = Math.atan2(wx, dz); E.yi = wy;
    E.gap = rI - railR(E.thi, wy, st);
    E.len = Math.hypot((E.tho - E.thi) * 0.5 * (rI + railR(E.tho, E.yo, st)), E.yo - E.yi) + 1e-3;
    /* reta tangente a um cilindro: a folga cresce com R·Δθ²/2 → fração do trajeto em que o dedo já saiu do gradil */
    E.s0 = clamp(1 - Math.sqrt(2 * Math.max(0, E.gap - 0.5) / rI) / (Math.abs(E.tho - E.thi) + 1e-3), 0.15, 0.85);
    return E;
  };
  /* ponto do trajeto sobre o gradil (sem a altura do dedo) → out; devolve o raio */
  const noGradil = (d, E, s, st, out) => {
    const th = lerp(E.tho, E.thi, s), y = lerp(E.yo, E.yi, s) + d.bow * 4 * s * (1 - s), r = railR(th, y, st);
    out.set(r * Math.sin(th), y, zc(y) + r * Math.cos(th));
    return th;
  };

  /* ------------------------------------------------------------------- malha */
  const q = clamp(quality, 0.3, 1);
  const NT = 2 * Math.round(7 * q), NB = Math.max(4, 2 * Math.round(3 * q)), NR = NT + NB, COLS = NR + 1;   // em volta: dorso + fundo
  const NC = Math.max(3, Math.round(6 * q)), NM = Math.max(10, Math.round(30 * q)), NE = 2, ROWS = NC + NM + NE + 1;
  const VPD = ROWS * COLS, NV = VPD * ND;
  const EXP_T = 2 / 2.0, EXP_B = 2 / 2.0;                              // expoentes da superelipse do dorso e do fundo (2 = elipse: rolo redondo)
  const CU = new Float32Array(COLS), CV = new Float32Array(COLS);
  for (let j = 0; j < COLS; j++){
    const h = NB / 2;
    const phi = j <= h ? -Math.PI / 2 + j / h * Math.PI / 2 : j <= h + NT ? (j - h) / NT * Math.PI : Math.PI + (j - h - NT) / h * Math.PI / 2;
    const c = Math.cos(phi), s = Math.sin(phi), e = s >= 0 ? EXP_T : EXP_B;
    CU[j] = (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), e); CV[j] = (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), e);
    if (Math.abs(CU[j]) < 1e-6) CU[j] = 0; if (Math.abs(CV[j]) < 1e-6) CV[j] = 0;
  }
  const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), col = new Float32Array(NV * 3), uv = new Float32Array(NV * 2);
  /* uv: u ao longo (fibras), v em volta proporcional ao arco de uma seção típica; cor: sombra nos flancos e no fundo */
  (() => {
    const arc = new Float32Array(COLS); let tot = 0;
    for (let j = 1; j < COLS; j++){ const hh = k => (CV[k] >= 0 ? 1.1 : HB) * CV[k]; tot += Math.hypot(1.5 * (CU[j] - CU[j - 1]), hh(j) - hh(j - 1)); arc[j] = tot; }
    for (let i = 0; i < ND; i++){
      const tom = lerp(1.0, 0.86, i / (ND - 1));
      for (let k = 0; k < ROWS; k++) for (let j = 0; j < COLS; j++){
        const v = i * VPD + k * COLS + j;
        uv[v * 2 + 1] = arc[j] / tot;                                   // (u é gravado na primeira montagem, pelo comprimento em repouso)
        const occ = CV[j] < 0 ? 0.68 - 0.2 * sst(0.2, 0.9, -CV[j]) : CU[j] < 0 ? 0.68 * sst(0.3, 1, -CU[j]) : 0.4 * sst(0.6, 1, CU[j]);   // sulco: flanco de baixo mais fundo; a face de dentro (vista por entre as costelas) um pouco mais clara
        col[v * 3] = tom * (1 - occ * 0.70); col[v * 3 + 1] = tom * (1 - occ * 0.84); col[v * 3 + 2] = tom * (1 - occ * 0.88);
      }
    }
  })();
  const idx = new Uint16Array(ND * (ROWS - 1) * NR * 6);
  (() => { let n = 0; for (let i = 0; i < ND; i++) for (let k = 0; k < ROWS - 1; k++) for (let j = 0; j < NR; j++){
    const a = i * VPD + k * COLS + j, b = a + COLS, c = b + 1, e = a + 1;
    idx[n++] = a; idx[n++] = b; idx[n++] = c; idx[n++] = a; idx[n++] = c; idx[n++] = e; } })();
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geom.setIndex(new THREE.BufferAttribute(idx, 1));
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(11, 30, 0), 32);

  /* anéis: centro, referencial e medidas (rascunho reaproveitado por todos os dedos) */
  const RC = new Float32Array(ROWS * 3), RN = new Float32Array(ROWS * 3), RA = new Float32Array(ROWS), RH = new Float32Array(ROWS), RB = new Float32Array(ROWS), RT = new Float32Array(ROWS), RU = new Float32Array(ROWS), RX = new Float32Array(ROWS);
  const WF = new Float32Array(ROWS), HF = new Float32Array(ROWS), QS = new Float32Array(ROWS);   // fatores das pontas e fração dentro de cada trecho
  for (let k = 0; k < ROWS; k++){
    if (k <= NC){ const al = k / NC * Math.PI / 2, c = k === NC ? 0 : Math.cos(al); QS[k] = 1 - c; WF[k] = c; HF[k] = Math.sin(al); }   // WF guarda o cosseno: a largura da ponta depende do expoente de cada dedo
    else if (k <= NC + NM){ QS[k] = (k - NC) / NM; WF[k] = HF[k] = 1; }
    else { const be = (k - NC - NM) / NE * Math.PI / 2; QS[k] = Math.sin(be); WF[k] = HF[k] = Math.max(0, Math.cos(be)); }
  }
  let gravaUV = true;
  const montaDedo = (i, st) => {
    const d = DIG[i], E = extremos(d, st, d.E);
    const curto = clamp(E.len / (2.4 * d.a0), 0.3, 1);                    // dedo muito encurtado (rotação máxima): estreita para não virar um bloco
    const cf = Math.min(0.3, d.ck * d.a0 * curto / E.len), ef = Math.min(0.08, 0.5 / E.len), icn = 1 / d.cn;
    const subida = Math.max(0, E.gap - MARG - HB - H1);                // quanto o fim precisa subir do gradil até o osso
    const s0 = E.s0;                                                   // …e de onde: o dedo larga o gradil em tangente
    /* 1) centros e normais do gradil */
    for (let k = 0; k < ROWS; k++){
      const s = k <= NC ? cf * QS[k] : k <= NC + NM ? cf + (1 - cf - ef) * QS[k] : 1 - ef + ef * QS[k];
      const th = noGradil(d, E, s, st, _a), y = _a.y;
      railN(th, y, st, _n);
      const w = s <= d.sa ? 1 : (1 - s) / (1 - d.sa);
      const a = curto * lerp(d.a1, d.a0, d.pw === 1 ? w : Math.pow(w, d.pw)) * (k < NC ? Math.pow(1 - Math.pow(WF[k], d.cn), icn) : k <= NC + NM ? 1 : WF[k]), hT = Math.min(lerp(d.h, H1, sst(0.5, 1, s)), 0.2 + 0.75 * a) * HF[k], hB = HB * HF[k];
      const tau = d.tau * sst(0, 0.25, s) * (1 - sst(d.t1 - 0.3, d.t1, s)), sinT = Math.sin(tau);
      const au = 1 + (d.au - 1) * sst(0.12, 0.42, s);                    // a metade de cima só alarga depois da ponta
      const ws = s > s0 ? (s - s0) / (1 - s0) : 0, up = MARG + hB + subida * ws * ws + a * au * sinT;
      RT[k] = tau; RU[k] = up - MARG; RX[k] = au;
      RA[k] = a; RH[k] = hT; RB[k] = hB;
      if (gravaUV){ const u = s * E.len / 18; for (let j = 0, v = (i * VPD + k * COLS) * 2; j < COLS; j++, v += 2) uv[v] = u; }   // fibras com a mesma densidade em todos os dedos
      RC[k * 3] = _a.x + _n.x * up; RC[k * 3 + 1] = _a.y + _n.y * up; RC[k * 3 + 2] = _a.z + _n.z * up;
      RN[k * 3] = _n.x; RN[k * 3 + 1] = _n.y; RN[k * 3 + 2] = _n.z;
    }
    /* 2) referencial de cada anel e vértices */
    const base = i * VPD * 3;
    for (let k = 0; k < ROWS; k++){
      const ka = (k > 0 ? k - 1 : 0) * 3, kb = (k < ROWS - 1 ? k + 1 : ROWS - 1) * 3, kc = k * 3;
      let tx = RC[kb] - RC[ka], ty = RC[kb + 1] - RC[ka + 1], tz = RC[kb + 2] - RC[ka + 2];
      let il = 1 / (Math.hypot(tx, ty, tz) || 1); tx *= il; ty *= il; tz *= il;
      const gx = RN[kc], gy = RN[kc + 1], gz = RN[kc + 2];
      let bx = ty * gz - tz * gy, by = tz * gx - tx * gz, bz = tx * gy - ty * gx;                 // B = T × n (através do dedo)
      il = 1 / (Math.hypot(bx, by, bz) || 1); bx *= il; by *= il; bz *= il;
      let nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx;                 // N = B × T (para fora)
      const sinT = Math.sin(RT[k]), cosT = Math.cos(RT[k]);
      { const ux = bx, uy = by, uz = bz;                                                          // telha: gira a seção em torno do eixo
        bx = ux * cosT - nx * sinT; by = uy * cosT - ny * sinT; bz = uz * cosT - nz * sinT;
        nx = nx * cosT + ux * sinT; ny = ny * cosT + uy * sinT; nz = nz * cosT + uz * sinT; }
      const cx = RC[kc], cy = RC[kc + 1], cz = RC[kc + 2], a = RA[k], aU = a * RX[k], hT = RH[k], hB = RB[k];
      /* prensa do osso: só para anéis perto da lâmina */
      const lx = cx - SO.x, ly = cy - SO.y, lz = cz - SO.z;
      const clx = (lx * SX.x + ly * SX.y + lz * SX.z) / KS, cly = (lx * SY.x + ly * SY.y + lz * SY.z) / KS, clz = lx * SZ.x + ly * SZ.y + lz * SZ.z;
      const blx = (bx * SX.x + by * SX.y + bz * SX.z) / KS, bly = (bx * SY.x + by * SY.y + bz * SY.z) / KS, blz = bx * SZ.x + by * SZ.y + bz * SZ.z;
      const nlz = nx * SZ.x + ny * SZ.y + nz * SZ.z;
      const prensa = hT > 0.05 && nlz > 0.3 && borda(clx, cly) < a / KS + 1.3, chao = RU[k];
      let o = base + k * COLS * 3;
      for (let j = 0; j < COLS; j++, o += 3){
        const u = (CU[j] > 0 ? aU : a) * CU[j];
        let v = CV[j] >= 0 ? hT * CV[j] : hB * CV[j];
        if (prensa){
          const fx = clx + blx * u, fy = cly + bly * u, dd = borda(fx, fy);
          if (dd < 1.3){
            const zl = (zCostal(fx, fy) - 0.06 + (dd > 0 ? dd * (1.2 + 0.8 * dd) : 0)) * KS;
            const vm = (zl - (clz + blz * u)) / nlz;
            if (vm < v + 0.3){                                                                  // mínimo suave (sem vinco) e nunca abaixo do gradil
              const hq = 0.3 - Math.abs(v - vm), piso = u * sinT - chao + (CV[j] > 0 ? 0.04 * CV[j] : 0);
              v = (vm < v ? vm : v) - (hq > 0 ? hq * hq / 1.2 : 0); if (v < piso) v = piso;
            }
          }
        }
        pos[o] = cx + bx * u + nx * v; pos[o + 1] = cy + by * u + ny * v; pos[o + 2] = cz + bz * u + nz * v;
      }
      if (k === 0 || k === ROWS - 1){ RN[kc] = k ? tx : -tx; RN[kc + 1] = k ? ty : -ty; RN[kc + 2] = k ? tz : -tz; }   // normal dos polos
    }
    /* 3) normais pela grade (dk × dj) */
    for (let k = 0; k < ROWS; k++){
      const o0 = base + k * COLS * 3;
      if (k === 0 || k === ROWS - 1){ for (let j = 0, o = o0; j < COLS; j++, o += 3){ nor[o] = RN[k * 3]; nor[o + 1] = RN[k * 3 + 1]; nor[o + 2] = RN[k * 3 + 2]; } continue; }
      const oa = o0 - COLS * 3, ob = o0 + COLS * 3;
      for (let j = 0; j < NR; j++){
        const o = o0 + j * 3, pa = oa + j * 3, pb = ob + j * 3, ja = o0 + (j > 0 ? j - 1 : NR - 1) * 3, jb = o0 + (j + 1) * 3;
        const ax = pos[pb] - pos[pa], ay = pos[pb + 1] - pos[pa + 1], az = pos[pb + 2] - pos[pa + 2];
        const ex = pos[jb] - pos[ja], ey = pos[jb + 1] - pos[ja + 1], ez = pos[jb + 2] - pos[ja + 2];
        let x = ay * ez - az * ey, y = az * ex - ax * ez, z = ax * ey - ay * ex;
        const il = 1 / (Math.hypot(x, y, z) || 1);
        nor[o] = x * il; nor[o + 1] = y * il; nor[o + 2] = z * il;
      }
      const e = o0 + NR * 3; nor[e] = nor[o0]; nor[e + 1] = nor[o0 + 1]; nor[e + 2] = nor[o0 + 2];
    }
  };
  const visto = {e: NaN, r: NaN, o: NaN, b: NaN};
  const monta = st => {
    const e = st.elev || 0, r = st.retr || 0, o = st.rot || 0, b = st.breath || 0;
    if (e === visto.e && r === visto.r && o === visto.o && b === visto.b) return;        // nada mudou desde a última montagem
    visto.e = e; visto.r = r; visto.o = o; visto.b = b;
    pegaEscapula(st);
    for (let i = 0; i < ND; i++) montaDedo(i, st);
    geom.attributes.position.needsUpdate = true; geom.attributes.normal.needsUpdate = true;
  };
  monta(EV.REST);
  gravaUV = false;

  const mat = EV.mats.muscle({repeat: [2, 2], roughness: 0.48});
  for (const side of [1, -1]){
    const m = new THREE.Mesh(geom, mat);
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    if (side < 0){ m.scale.x = -1; m.updateMatrix(); }
    group.add(m);
  }

  /* ---------------------------------------------- comprimento, tensão, marcador */
  const comp = (d, st) => {                                            // comprimento do trajeto (6 cordas)
    const E = extremos(d, st, d.E2);
    let len = 0;
    for (let k = 0; k <= 6; k++){
      noGradil(d, E, k / 6, st, _a); const ws = k / 6 > E.s0 ? (k / 6 - E.s0) / (1 - E.s0) : 0, up = Math.max(0, E.gap - 0.5) * ws * ws;
      { const z0 = zc(_a.y), dz = _a.z - z0, f = 1 + up / (Math.hypot(_a.x, dz) || 1); _a.x *= f; _a.z = z0 + dz * f; }
      if (k) len += _a.distanceTo(_b); _b.copy(_a);
    }
    return len;
  };
  pegaEscapula(EV.REST);
  for (const d of DIG) d.rest = comp(d, EV.REST);
  return {group, tint: [mat],
    update(state){ monta(state); },
    strain(state){ pegaEscapula(state); let s = 0; for (const d of DIG) s += comp(d, state) / d.rest - 1; return s / ND; },
    markers: [{n: 4, label: 'Serrátil anterior', pos: state => {
      pegaEscapula(state);
      const d = DIG[5], E = extremos(d, state, d.E2);
      const th = noGradil(d, E, 0.42, state, _mk); railN(th, _mk.y, state, _n);
      return _mk.addScaledVector(_n, d.h + 0.6);                         // (o app copia o vetor)
    }}]};
});
})();
