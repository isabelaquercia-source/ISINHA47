/* Peça `spine` — coluna vertebral: 24 vértebras (corpo, pedículos, lâminas, processos espinhoso, transversos e
   articulares), discos intervertebrais, sacro e cóccix; mais os ligamentos que a referência deixa ver (amarelos e
   interespinhosos lombares, membrana atlantoaxial) e o saco dural escuro dentro do canal.

   Como é feita: poucos MOLDES esculpidos com SDF em coordenadas locais da vértebra (+X direita, +Y cranial,
   +Z posterior; origem no centro do corpo) — atlas, áxis, cervical típica, C7, torácica alta / média / baixa,
   lombar e sacro + cóccix. Cada molde vira malha UMA vez; cada nível recebe uma cópia dos vértices deformada
   (escala + deslocamento suave dos processos) para o corpo ter o tamanho do nível e as pontas dos processos
   caírem em EV.spine.v(n).spinousTip / tpTip(side), onde nascem os romboides e o elevador da escápula.
   A coluna é estática (sem `update`). */
(() => {
EV.register('spine', ({THREE, EV, quality}) => {
  const T = THREE, S = EV.sdf, Q = EV.clamp(quality || 1, 0.3, 1);
  const DEG = Math.PI / 180;
  const cap = S.capsule, sph = S.sphere, ell = S.ellipsoid, uni = S.smooth, sub = S.sub, placa = S.plate;
  const group = new T.Group();
  const AO = [0.46, 0.41, 0.30];                                   // sombra das reentrâncias (oliva)

  /* ------------------------------------------------------------------ SDFs locais */
  /* simetria bilateral: só o lado direito é descrito */
  const sim = f => (x, y, z) => f(x < 0 ? -x : x, y, z);
  /* caixa arredondada orientada: guinada (em torno de Y; o eixo x local vira (cos, 0, −sen)) e inclinação (em torno
     de X; + leva o topo para trás), em graus */
  const obox = (c, h, r, guin, incl) => {
    const cy = Math.cos((guin || 0) * DEG), sy = Math.sin((guin || 0) * DEG), cp = Math.cos((incl || 0) * DEG), sp = Math.sin((incl || 0) * DEG);
    const cx = c[0], cyy = c[1], cz = c[2], hx = h[0] - r, hy = h[1] - r, hz = h[2] - r;
    return (x, y, z) => {
      const dx = x - cx, dy = y - cyy, dz = z - cz;
      const qx = Math.abs(dx * cy - dz * sy) - hx, qy = Math.abs(dx * sy * sp + dy * cp + dz * cy * sp) - hy, qz = Math.abs(dx * sy * cp - dy * sp + dz * cy * cp) - hz;
      const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0, m = qx > qy ? (qx > qz ? qx : qz) : (qy > qz ? qy : qz);
      return Math.sqrt(ox * ox + oy * oy + oz * oz) + (m < 0 ? m : 0) - r;
    };
  };
  /* corpo vertebral: cilindro de seção oval (semi-eixos rx, rz) ao longo de Y, meia-altura hy, com cintura
     (fração `cint` mais estreito a meia altura) e borda das faces arredondada (rr) */
  const corpo = (rx, rz, hy, cint, rr) => {
    const rmin = Math.min(rx, rz);
    return (x, y, z) => {
      const t = y / hy, k = 1 - cint * (1 - Math.min(1.3, t * t)), ax = rx * k, az = rz * k, px = x / ax, pz = z / az;
      const k0 = Math.sqrt(px * px + pz * pz), k1 = Math.sqrt(px * px / (ax * ax) + pz * pz / (az * az));
      let d = k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -rmin;
      if (d < -rmin) d = -rmin;
      const qx = d + rr, qy = Math.abs(y) - hy + rr;
      return Math.min(Math.max(qx, qy), 0) + Math.sqrt((qx > 0 ? qx * qx : 0) + (qy > 0 ? qy * qy : 0)) - rr;
    };
  };
  /* f só é avaliada perto da sua caixa [mn, mx]; longe dela devolve a distância à caixa (um limite inferior da
     distância verdadeira) — poupa a maior parte das primitivas em cada ponto */
  const lim = (f, mn, mx, m) => {
    const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, cz = (mn[2] + mx[2]) / 2, hx = (mx[0] - mn[0]) / 2, hy = (mx[1] - mn[1]) / 2, hz = (mx[2] - mn[2]) / 2, mg = m || 0.7;
    return (x, y, z) => {
      const dx = Math.abs(x - cx) - hx, dy = Math.abs(y - cy) - hy, dz = Math.abs(z - cz) - hz, d = dx > dy ? (dx > dz ? dx : dz) : (dy > dz ? dy : dz);
      return d > mg ? d : f(x, y, z);
    };
  };
  /* interpolação cúbica 1D por nós (xs crescente), constante fora da faixa; devolve uma tabela com interpolação linear */
  const perfil = (xs, ys) => {
    const n = xs.length, m = [];
    for (let i = 0; i < n; i++){ const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); m.push((ys[b] - ys[a]) / (xs[b] - xs[a])); }
    const f = x => {
      if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
    };
    const y0 = xs[0], N = 256, st = (xs[n - 1] - y0) / N, t = new Float32Array(N + 2);
    for (let i = 0; i <= N + 1; i++) t[i] = f(y0 + i * st);
    return y => { const u = (y - y0) / st; if (u <= 0) return t[0]; if (u >= N) return t[N]; const i = u | 0; return t[i] + (t[i + 1] - t[i]) * (u - i); };
  };
  const un = (a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; };
  const mais = (a, d, k) => [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];

  /* -------------------------------------------------------------------- moldes
     Cada molde: {f, min, max, cell, R (meia-largura do corpo), h (altura do nível: corpo + disco), hb (meia-altura
     do corpo), sp: [y, z] ponta do espinhoso, tp: [x, y, z] ponta do transverso direito, spZ: [z0, z1] trecho em
     que o espinhoso é deslocado, tpX: [x0, x1] idem para o transverso, tpZ: [za, zb] janela em z do transverso,
     zc/rc: centro e raio do canal, disco: {rx, rz, flat, e} contorno das faces do corpo} */

  /* LOMBAR (canônico: L3) */
  function moldeLombar(){
    const R = 2.5, h = 3.45, hb = 1.40, Rz = 1.85;
    const sp = [-1.0, 5.55], tp = [4.4, 0.24, 2.9];
    const corpoL = sub(corpo(R * 0.98, Rz, hb, 0.12, 0.26), cap([0, -3, Rz + 1.3], [0, 3, Rz + 1.3], 1.6), 0.3);
    const arco = sub(uni(0.4,
      obox([1.6, 0.55, 2.3], [0.48, 0.68, 0.95], 0.44),                                  // pedículo
      obox([0.82, -0.45, 3.44], [1.02, 1.1, 0.36], 0.3, 22, -5),                         // lâmina
      cap([1.12, -1.2, 3.55], [1.3, -2.45, 3.45], 0.52, 0.42)),                          // processo articular inferior
      sph([2.3, -0.8, 3.75], 0.85), 0.2);                                                // istmo (cintura entre os articulares)
    /* processo articular superior: corno que sobe do pedículo, com o processo mamilar na borda de trás */
    const sap = uni(0.35, cap([1.8, 0.4, 2.95], [2.0, 1.6, 3.3], 0.66, 0.38), sph([2.32, 1.1, 3.52], 0.27));
    /* espinhoso em machadinha: lâmina sagital, borda posterior grossa que desce num pequeno gancho e borda
       inferior côncava */
    const espinhoso = sub(uni(0.45, obox([0, -0.78, 4.4], [0.39, 1.23, 0.78], 0.3, 0, 3), cap([0, 0.1, 5.12], [0, -1.75, 5.13], 0.4, 0.46), cap([0, -1.75, 5.13], [0, -2.3, 5.24], 0.44, 0.26)),
      cap([-1, -2.85, 4.25], [1, -2.85, 4.25], 1.12), 0.15);
    /* transverso: espátula achatada (duas cápsulas paralelas), levemente para trás */
    const transverso = uni(0.5, cap([1.8, 0.62, 2.6], [4.12, 0.6, 2.9], 0.32, 0.28), cap([1.8, -0.08, 2.6], [3.95, -0.02, 2.88], 0.32, 0.24));
    const tudo = uni(0.26, corpoL,
      uni(0.55, lim(arco, [-0.3, -2.95, 1.3], [2.3, 1.3, 3.9]), lim(espinhoso, [-0.5, -2.6, 3.6], [0.5, 0.85, 5.6])),
      lim(sap, [1.1, -0.3, 2.25], [2.75, 2.25, 3.95]), lim(transverso, [1.45, -0.42, 2.25], [4.42, 0.95, 3.2]));
    const f = sub(sub(tudo,
      lim(cap([1.1, 2.4, 3.65], [1.25, 1.0, 3.5], 0.5), [0.6, 0.5, 3.0], [1.75, 2.9, 4.15], 0.4), 0.12),   // faceta: encaixe do articular inferior de cima
      cap([0, -4, 2.62], [0, 4, 2.62], 0.92), 0.2);                                      // canal vertebral
    return {f: sim(f), min: [-5.2, -3.5, -2.5], max: [5.2, 2.7, 6.3], cell: 0.225, R, h, hb, sp, tp, aoR: 1.7, aoS: 1.9,
      spZ: [3.9, 5.55], tpX: [2.4, 4.4], tpZ: null, zc: 2.62, rc: 0.92, disco: {rx: R * 0.98, rz: Rz, flat: 0.2, e: 1}};
  }

  /* TORÁCICA (parametrizada: alta, média, baixa) */
  function moldeToracico(p){
    const R = p.R, h = p.h, Rz = R * 0.88, hb = 0.5 * h * 0.84, zc = Rz + 0.72, rc = 0.74, zl = zc + rc + 0.32;
    const sp = p.sp, tp = p.tp, esp = p.esp || 0.5, ea = Math.max(0.2, 0.85 * (p.cell || 0.21) / Q);
    const corpoT = sub(corpo(R, Rz, hb, 0.10, 0.2), cap([0, -3, Rz + 0.8], [0, 3, Rz + 0.8], 0.95), 0.2);
    /* espinhoso: raiz larga em telhado + lâmina afilada (borda de cima fina, borda de baixo mais grossa) de ponta romba */
    const b = [0, -0.45, zl + 0.4], tip = [0, sp[0], sp[1]], d = un(b, tip), n = [0, d[2], -d[1]];
    const espinhoso = uni(0.4,
      cap([0, 0.25, zl + 0.1], [0, -0.85, zl + 0.6], 0.5, 0.48),
      cap(mais(b, n, 0.42), mais(mais(tip, d, -0.28), n, esp * 0.5), 0.28, 0.24),
      cap(mais(b, n, -0.35), mais(mais(tip, d, -0.33), n, -esp * 0.5), 0.36, 0.3));
    /* transverso em clava */
    const bt = [1.0, 0.3, zl - 0.7], dt = un(bt, tp), ct = mais(tp, dt, -0.62);
    const arco = uni(0.32,
      obox([0.98, 0.42 * hb + 0.08, Rz + 0.5], [0.36, 0.6, 0.75], 0.3),                  // pedículo
      obox([0.66, -0.2, zl - 0.08], [0.9, 0.42 * h, 0.3], 0.26, 16, -8),                 // lâmina
      cap(bt, ct, 0.66, 0.54), cap(mais(ct, [0, 1, 0], 0.12), mais(ct, [0, 1, 0], -0.14), 0.58),                                             // transverso
      obox([1.0, hb + 0.4, zl - 0.75], [0.46, 0.62, ea], 0.17, -8, 10),                 // articular superior
      obox([0.95, -hb - 0.25, zl - 0.2], [0.46, 0.5, ea], 0.17, 10, 0));                // articular inferior
    const f = sub(uni(0.26, corpoT, arco, lim(espinhoso, [-0.7, sp[0] - 0.75, zl - 0.5], [0.7, 0.95, sp[1] + 0.1])), cap([0, -4, zc], [0, 4, zc], rc), 0.15);
    return {f: sim(f), min: [-tp[0] - 0.7, Math.min(sp[0] - 1.1, -hb - 1.4), -Rz - 0.7], max: [tp[0] + 0.7, hb + 1.7, sp[1] + 0.7], cell: p.cell || 0.21,
      R, h, hb, sp, tp, aoR: 1.4, aoS: 1.8, sombra: [zl - 0.6, zl - 0.1, 0.1, 0.8, 0.3], spZ: [zl + 0.6, sp[1]], tpX: [1.7, tp[0]], tpZ: [Rz + 0.1, Rz + 0.7], zc, rc: rc * 0.95, disco: {rx: R, rz: Rz, flat: 0.12, e: 1}};
  }

  /* CERVICAL (parametrizada: típica C3–C6 com espinhoso bífido; C7 com espinhoso longo) */
  function moldeCervical(p){
    const R = p.R, h = p.h, hb = 0.5 * h * 0.78, sp = p.sp, tp = p.tp, xp = p.xp || 2.1;
    const cel = (p.cell || 0.2) / Q, el = Math.max(0.44, 1.75 * cel), rp = Math.max(0.19, 0.62 * cel);   // espessuras mínimas (com quality baixa as partes finas furavam)
    const corpoC = uni(0.2, obox([0, 0, 0], [R + 0.12, hb, 0.82 * R], 0.28),
      cap([R + 0.02, hb - 0.05, -0.4], [R + 0.02, hb + 0.12, 0.45], 0.2));                // processo uncinado
    const pilar = cap([xp, 0.55, 0.95], [xp, -0.55, 1.6], 0.72);                          // pilar articular (maciço lateral)
    const pediculo = cap([R * 0.95, 0.1, 0.6], [xp - 0.4, 0.1, 0.95], 0.34);
    /* lâmina em telha: uma placa recuada (quadrilátero plano) e, na borda de baixo, uma crista saliente que continua
       no espinhoso — a "prateleira" clara que a referência mostra em cada vértebra; o vão entre lâminas só abre perto
       da linha média */
    const kh = h / 1.74, lu0 = [xp - 0.45, 0.52 * kh, 1.4], lu1 = [0, 0.36 * kh, 2.0], ll0 = [xp - 0.3, -0.75, 1.95], ll1 = [0, -0.7, 2.5];
    const lamina = uni(0.2, placa(lu0, lu1, ll1, el), placa(lu0, ll1, ll0, el), cap([xp - 0.25, -0.82, 2.22], [0, -0.74, 2.95], 0.3, 0.33));
    let espinhoso;
    if (p.bifido) espinhoso = uni(0.22, cap([0, -0.62, 2.8], [0, sp[0] + 0.05, sp[1] - 0.6], 0.34, 0.24), cap([0.08, sp[0] + 0.05, sp[1] - 0.62], [0.32, sp[0] - 0.12, sp[1] - 0.2], rp + 0.03, rp));
    else espinhoso = uni(0.25, cap([0, -0.3, 2.6], [0, sp[0], sp[1] - 0.44], 0.44, 0.38), sph([0, sp[0] - 0.02, sp[1] - 0.44], 0.44));
    /* transverso: raiz anterior (do corpo ao tubérculo anterior), raiz posterior (do pilar à ponta) e a barra entre elas */
    const ta = [tp[0] - 0.7, tp[1] - 0.25, tp[2] - 0.8], tq = [tp[0] - 0.26, tp[1], tp[2]];
    const transverso = uni(0.18, cap([R + 0.05, 0, -0.25], ta, 0.26, 0.24), cap([xp + 0.1, 0.0, 0.6], tq, 0.3, 0.26), cap(ta, [tq[0], tq[1] - 0.1, tq[2] - 0.05], 0.2));
    const f = sub(uni(0.3, corpoC, pediculo, pilar, lamina, espinhoso, transverso),
      cap([R + 0.62, -1.5, 0.1], [R + 0.62, 1.5, 0.1], 0.27), 0.08);                      // forame transversário
    return {f: sim(f), min: [-tp[0] - 0.6, Math.min(-hb - 1.25, sp[0] - 0.9), -0.82 * R - 0.7], max: [tp[0] + 0.6, hb + 1.3, sp[1] + 0.6], cell: p.cell || 0.2,
      R, h, hb, sp, tp, aoR: 1.1, aoS: 1.7, sombra: [1.2, 1.7, -0.62, 0.0, 0.4], spZ: [3.0, sp[1]], tpX: [xp + 0.75, tp[0]], tpZ: null, zc: 1.38, rc: 0.6, disco: {rx: R + 0.1, rz: 0.8 * R, flat: 0, e: 0.75}};
  }

  /* ATLAS (C1): anel sem corpo — massas laterais, arcos anterior e posterior, transversos largos */
  function moldeAtlas(){
    const sp = [0, 2.6], tp = [4.85, 0, 0.3];
    const massa = ell([2.2, 0, -0.1], [1.0, 0.8, 1.25]);
    const anterior = uni(0.2, cap([1.8, 0, -1.05], [0.9, 0, -1.6], 0.38, 0.34), cap([0.9, 0, -1.6], [0, 0, -1.8], 0.34), sph([0, -0.05, -1.86], 0.42));
    /* arco posterior: faixa mais alta que espessa (duas cápsulas empilhadas por trecho) */
    const arco = y => uni(0.15, cap([2.3, y, 0.9], [1.8, y, 1.9], 0.32, 0.3), cap([1.8, y, 1.9], [0.85, y, 2.3], 0.3), cap([0.85, y, 2.3], [0, y, 2.28], 0.3));
    const posterior = uni(0.3, arco(0.22), arco(-0.34), sph([0, -0.05, 2.24], 0.38));
    const transverso = uni(0.22, cap([2.8, -0.05, -0.38], [4.5, -0.05, 0.2], 0.28, 0.25), cap([2.8, -0.05, 0.65], [4.5, -0.05, 0.4], 0.28, 0.25), sph([4.47, -0.05, 0.3], 0.38));
    let f = uni(0.25, massa, anterior, posterior, transverso);
    f = sub(f, ell([2.1, 1.05, -0.1], [0.72, 0.5, 1.0]), 0.12);                           // faceta superior (côndilo occipital)
    return {f: sim(f), min: [-5.5, -1.4, -2.9], max: [5.5, 1.4, 3.2], cell: 0.2, R: 1.0, h: 1.53, hb: 0.6, sp, tp, aoR: 1.0, aoS: 1.3,
      spZ: [1.6, 2.6], tpX: [3.2, 4.85], tpZ: null, zc: 0.55, rc: 0.95, disco: null};
  }

  /* ÁXIS (C2): corpo com o dente, espinhoso grande e bífido */
  function moldeAxis(){
    const R = 0.9, h = 2.24, hb = 0.75, sp = [-1.1, 4.8], tp = [3.0, -0.2, 0.4], xp = 2.05;
    const corpoA = uni(0.3, obox([0, -0.3, 0], [R + 0.15, hb, 0.8], 0.3), cap([0, 0.3, -0.5], [0, 1.95, -0.78], 0.52, 0.42));   // corpo + dente
    const faceta = ell([1.6, 0.72, -0.05], [0.9, 0.38, 0.85]);                            // faceta articular superior (para o atlas)
    const pilar = cap([1.55, 0.3, 0.25], [xp, -0.95, 1.4], 0.58, 0.66);                   // pars → processo articular inferior
    const lamina = uni(0.45, cap([1.75, 0.25, 1.6], [0, 0.1, 2.45], 0.4), cap([1.75, -0.4, 1.8], [0, -0.5, 2.75], 0.42), cap([1.75, -1.0, 2.0], [0, -1.1, 3.0], 0.4));
    const espinhoso = uni(0.25, cap([0, -0.6, 2.6], [0, -1.0, 4.0], 0.56, 0.5), cap([0.15, -1.0, 3.95], [0.55, -1.2, 4.5], 0.36, 0.3));
    const transverso = cap([1.3, -0.1, 0.05], [2.75, -0.3, 0.4], 0.3, 0.26);
    const f = sub(uni(0.25, corpoA, faceta, pilar, lamina, espinhoso, transverso), cap([0, -3, 1.45], [0, 3, 1.45], 0.7), 0.1);
    return {f: sim(f), min: [-3.6, -2.4, -1.8], max: [3.6, 2.95, 5.4], cell: 0.2, R, h, hb: hb + 0.3, sp, tp, aoR: 1.0, aoS: 1.4,
      spZ: [3.1, 4.8], tpX: [2.75, 3.0], tpZ: null, zc: 1.45, rc: 0.66, disco: {rx: R + 0.12, rz: 0.78, flat: 0, e: 0.75}};
  }

  /* SACRO + CÓCCIX (referencial de S1: −Y desce ao longo do sacro, +Z dorsal; origem no centro do corpo de S1).
     `enc` = ponta do processo articular inferior de L5 neste referencial (para a faceta de S1 abraçá-lo). */
  function moldeSacro(enc){
    /* perfis ao longo do sacro: meia-largura (na face pélvica; o dorso é mais estreito), superfície ventral e dorsal */
    const ys = [-10.6, -9, -7.5, -6.5, -5.5, -4, -2, 0, 1.5, 2.2];
    const W = perfil(ys, [1.7, 2.8, 3.8, 4.8, 5.8, 6.4, 6.9, 7.1, 7.0, 6.7]);
    const ZV = perfil(ys, [-2.0, -0.9, -0.3, -0.1, 0.0, -0.3, -1.0, -1.8, -1.9, -1.9]);
    const ZD = perfil(ys, [-0.5, 0.6, 1.3, 1.6, 1.9, 2.2, 2.5, 2.6, 2.5, 2.4]);
    const zd = (x, y) => ZD(y) - 0.012 * x * x;
    const base = (x, y, z) => {
      const zv = ZV(y) - 0.022 * x * x, zdd = ZD(y) - 0.012 * x * x, zm = (zv + zdd) / 2, ht = (zdd - zv) / 2, r = ht < 1.15 ? ht * 0.85 : 0.98;
      const dz = z + 1.0, w0 = W(y), w = w0 - 0.52 * (dz < 0 ? 0 : dz > 3.6 ? 3.6 : dz) * (w0 < 5.5 ? w0 / 5.5 : 1);   // seção em trapézio: mais larga na frente
      const qx = (x - w) * 0.89 + r, qz = Math.abs(z - zm) - ht + r;
      const d2 = Math.min(Math.max(qx, qz), 0) + Math.sqrt((qx > 0 ? qx * qx : 0) + (qz > 0 ? qz * qz : 0)) - r;
      /* tampas: topo (o platô de S1 em y = 1,5; a asa desce para a frente) e ápice */
      const asa = (y - 0.55 * z - 0.95) * 0.876, topo = Math.max(y - 1.5, x > 2.5 ? asa : asa - (2.5 - x) * 1.2);
      const qy = Math.max(topo, -10.3 - y), k = 0.45, hh = Math.max(k - Math.abs(d2 - qy), 0);
      return Math.max(d2, qy) + hh * hh * 0.25 / k;
    };
    const corpoS1 = lim(corpo(2.75, 1.9, 1.5, 0.04, 0.3), [-2.8, -1.6, -2], [2.8, 1.6, 2]);    // corpo de S1 (promontório), aflora no topo
    /* crista mediana (espinhosos fundidos), crista intermédia (articulares) e crista lateral (transversos): cordões baixos */
    const cr = (x0, y0, x1, y1, r, dz) => cap([x0, y0, zd(x0, y0) + dz], [x1, y1, zd(x1, y1) + dz], r);
    const cristaM = lim(uni(0.7, cap([0, -0.7, 3.0], [0, -1.6, 3.05], 0.5, 0.55), cap([0, -2.7, 2.85], [0, -4.0, 2.6], 0.5, 0.45), cap([0, -5.3, 2.2], [0, -6.4, 1.85], 0.42, 0.36)),
      [-0.6, -6.8, 1.4], [0.6, -0.2, 3.65], 0.8);
    const cristaI = lim(uni(0.7, cr(1.7, -0.9, 1.65, -1.4, 0.45, -0.26), cr(1.55, -3.3, 1.5, -3.8, 0.42, -0.26)),
      [0.8, -4.3, 1.2], [2.2, -0.4, 2.85], 0.8);
    const cristaL = lim(uni(0.7, cr(4.3, -0.6, 4.25, -1.9, 0.62, -0.22), cr(4.2, -3.0, 3.95, -4.2, 0.58, -0.22), cr(3.6, -5.4, 3.3, -6.4, 0.5, -0.2), cr(2.9, -7.4, 2.7, -8.0, 0.42, -0.18)),
      [2.25, -8.45, 0.2], [4.95, 0.05, 2.8], 0.8);
    /* processo articular superior de S1 (abraça por fora o articular inferior de L5) e o "chifre" póstero-superior da massa lateral */
    const sapB = [enc[0] + 0.55, 1.0, enc[2] - 0.75], sapT = [enc[0] + 0.85, enc[1] + 0.75, enc[2] - 0.25];
    const topoS = lim(uni(0.4, cap(sapB, sapT, 0.75, 0.5), sph([sapT[0] + 0.3, sapT[1] - 0.5, sapT[2] + 0.3], 0.34), sph([5.0, 1.0, 1.7], 1.0)),
      [1.0, -0.2, 0.4], [6.1, sapT[1] + 0.6, sapT[2] + 0.7], 0.8);
    /* cóccix: Co1 com cornos e 3 segmentos pequenos, curvando para a frente; cornos sacrais */
    const finos = Q >= 0.8 ? [cap([0.75, -10.4, -1.1], [1.25, -10.7, -1.4], 0.3, 0.24), cap([0.55, -9.9, -0.6], [0.6, -10.7, -1.05], 0.26, 0.22),
      cap([0.8, -8.3, zd(0.8, -8.3) - 0.1], [0.75, -9.6, zd(0.75, -9.6) - 0.05], 0.3, 0.24)] : [];        // cornos: finos demais para a malha grossa
    const coccix = lim(uni(0.15, cap([0, -10.3, -1.3], [0, -11.4, -2.1], 0.82, 0.68),
      sph([0, -12.2, -2.8], 0.58), sph([0, -12.9, -3.4], 0.46), sph([0, -13.45, -3.95], 0.34), ...finos),
      [-0.9, -13.9, -4.4], [1.6, -7.9, 1.2], 0.7);
    const cristas = lim(uni(0.45, cristaM, cristaI, cristaL), [-0.6, -8.5, 0.2], [5.0, 0.1, 3.7], 0.85);
    let f = uni(0.2, uni(0.45, uni(0.3, base, corpoS1), cristas, topoS), coccix);
    /* escavações, agrupadas por região (cada grupo só é avaliado perto da sua caixa):
       forames sacrais (4 pares; atravessam do dorso à face pélvica) */
    const caixaE = (c, r) => [[c[0] - r[0], c[1] - r[1], c[2] - r[2]], [c[0] + r[0], c[1] + r[1], c[2] + r[2]]];
    const oco = (c, r) => { const q = caixaE(c, r); return lim(ell(c, r), q[0], q[1], 0.5); };
    const furos = [];
    for (const [fx, fy, fr] of [[3.1, -2.3, 0.4], [2.85, -4.75, 0.38], [2.35, -6.85, 0.33], [1.7, -8.5, 0.27]])
      furos.push(lim(uni(0.2, cap([fx, fy + 0.2, -6], [fx, fy + 0.2, 5], fr), cap([fx - 0.1, fy - 0.24, -6], [fx - 0.1, fy - 0.24, 5], fr * 0.9), sph([fx, fy, zd(fx, fy) + 0.35], fr + 0.32)),
        [fx - fr - 0.4, fy - fr - 0.4, -6], [fx + fr + 0.4, fy + fr + 0.4, 5], 0.45));
    f = sub(f, lim(S.union(...furos), [1.0, -9.3, -6], [3.95, -1.45, 5], 0.5), 0.22);
    /* dorso: duas fossas laterais (atrás da face auricular) */
    f = sub(f, lim(S.union(oco([5.6, -1.7, zd(5.6, -1.7) + 0.75], [1.5, 1.5, 0.95]), oco([5.0, -4.4, zd(5.0, -4.4) + 0.6], [1.2, 1.25, 0.85])),
      [3.7, -5.7, 0.2], [7.1, -0.2, 3.6], 0.5), 0.3);
    /* topo: sela entre o articular e o chifre, abertura dorsal do canal (janela entre L5 e S1) e faceta para L5 */
    f = sub(f, lim(S.union(oco([3.5, 2.15, 1.5], [1.15, 1.05, 2.3]), oco([0, 1.5, 2.9], [2.2, 1.9, 1.5]),
      lim(cap(mais(enc, [0, 1, 0.05], 1.4), mais(enc, [0, 1, 0.05], -0.35), 0.52), [enc[0] - 0.6, enc[1] - 1.0, enc[2] - 0.6], [enc[0] + 0.6, enc[1] + 2.0, enc[2] + 0.7], 0.4)),
      [-2.2, -0.4, -0.8], [4.65, 3.6, 4.4], 0.5), 0.25);
    /* canal sacral e hiato (com malha grossa o hiato deixaria paredes finas demais: fica de fora) */
    const canalS = cap([0, 2.6, 2.2], [0, -4.6, 1.35], 0.62, 0.4);
    f = sub(f, lim(Q >= 0.8 ? uni(0.2, canalS, ell([0, -9.0, zd(0, -9.0) + 0.2], [0.5, 0.95, 0.55])) : canalS, [-0.7, -10.1, -0.6], [0.7, 3.3, 2.9], 0.4), 0.15);
    return {f: sim(f), min: [-8.0, -14.5, -5.2], max: [8.0, 4.0, 4.4], cell: 0.28, R: 2.8, h: 3.0, hb: 1.5, sp: [-0.6, 3.4], tp: [7.0, 1.0, -1.0],
      zc: 2.2, rc: 0.55, disco: {rx: 2.7, rz: 1.85, flat: 0.2, e: 1}, aoR: 2.2, aoS: 1.9, aoC: [0.42, 0.38, 0.33]};
  }

  /* --------------------------------------------------------- malha de um molde */
  const agora = () => (window.performance && performance.now ? performance.now() : Date.now());
  const tempos = group.userData.ms = {};                           // ms por molde (diagnóstico)
  const fazMolde = (m, nome) => {
    const t0 = agora();
    m.geom = EV.mesh.fromSDF(m.f, {min: m.min, max: m.max, cell: m.cell / Q, ao: true, aoRadius: m.aoR || 1.1, aoStrength: m.aoS || 1.25, aoColor: m.aoC || AO});
    /* faces viradas para baixo um pouco mais escuras e frias (a sombra suave, acinzentada, do render de atlas) */
    { const nor = m.geom.attributes.normal.array, cor = m.geom.attributes.color.array;
      for (let i = 0; i < nor.length; i += 3){ const w = EV.smoothstep(0.15, -0.85, nor[i + 1]) * 0.9; cor[i] *= 1 - 0.20 * w; cor[i + 1] *= 1 - 0.21 * w; cor[i + 2] *= 1 - 0.13 * w; }
      /* `sombra` = [z0, z1, y0, y1, força]: o alto do arco posterior fica na sombra da vértebra de cima (que o cobre
         como uma telha) — a oclusão do molde não enxerga as vizinhas */
      if (m.sombra){ const pos = m.geom.attributes.position.array, q = m.sombra;
        for (let i = 0; i < pos.length; i += 3){ const w = EV.smoothstep(q[0], q[1], pos[i + 2]) * EV.smoothstep(q[2], q[3], pos[i + 1]) * q[4]; cor[i] *= 1 - 0.85 * w; cor[i + 1] *= 1 - 0.9 * w; cor[i + 2] *= 1 - 1.15 * w; } } }
    tempos[nome] = Math.round(agora() - t0);
    return m;
  };
  const M = {
    lombar: fazMolde(moldeLombar(), 'lombar'),
    torA: fazMolde(moldeToracico({R: 1.44, h: 2.19, sp: [-1.65, 5.6], tp: [3.62, 0.3, 2.4], esp: 0.42, cell: 0.24}), 'torA'),
    torM: fazMolde(moldeToracico({R: 1.70, h: 2.52, sp: [-3.0, 5.3], tp: [3.4, 0.3, 2.6], esp: 0.42}), 'torM'),
    torB: fazMolde(moldeToracico({R: 1.94, h: 2.82, sp: [-1.2, 5.7], tp: [2.6, 0.1, 2.3], esp: 0.5}), 'torB'),
    cerv: fazMolde(moldeCervical({R: 0.92, h: 1.74, sp: [-0.6, 4.1], tp: [3.05, 0, 0.2], bifido: true}), 'cerv'),
    c7: fazMolde(moldeCervical({R: 1.05, h: 1.99, sp: [-0.65, 5.5], tp: [3.5, 0, 0.7], bifido: false, xp: 2.1}), 'c7'),
    atlas: fazMolde(moldeAtlas(), 'atlas'),
    axis: fazMolde(moldeAxis(), 'axis'),
    sacro: null                                                    // depende de L5 (abaixo)
  };
  const moldeDe = n => n === 'C1' ? M.atlas : n === 'C2' ? M.axis : n === 'C7' ? M.c7 : n[0] === 'C' ? M.cerv :
    n[0] === 'L' ? M.lombar : n === 'S1' ? M.sacro : (+n.slice(1) <= 4 ? M.torA : +n.slice(1) <= 9 ? M.torM : M.torB);

  /* Pontas dos processos LOMBARES em coordenadas locais (espinhoso [y, z]; transverso [x, y, z]). Na referência os
     espinhosos são machadinhas com a borda posterior a ~5,5 cm do centro do corpo, e os "dedos" que aparecem à
     esquerda da coluna são os transversos esquerdos, voltados um pouco para trás. (Os valores lombares do core
     tratavam esses dedos como espinhosos; nenhuma outra peça nasce nessas pontas.) */
  const ESP_L = {L1: [-0.9, 5.4], L2: [-1.0, 5.5], L3: [-1.0, 5.55], L4: [-1.0, 5.5], L5: [-0.8, 5.1]};
  const TRV_L = {L1: [3.5, 0.2, 2.9], L2: [3.95, 0.24, 3.2], L3: [4.3, 0.24, 3.3], L4: [4.15, 0.24, 3.3], L5: [4.3, 0.15, 3.0]};

  /* ------------------------------------------------- cópia deformada por nível */
  const matOsso = EV.mats.bone();
  const niveis = {};
  const ramp = t => t <= 0 ? 0 : t >= 1 ? t : t * t * (2 - t);              // começa suave, depois linear
  const dramp = t => t <= 0 ? 0 : t >= 1 ? 1 : 4 * t - 3 * t * t;
  function instanciar(nome){
    const v = EV.spine.v(nome), m = moldeDe(nome), g0 = m.geom;
    const inv = v.quat.clone().invert(), loc = p => p.clone().sub(v.pos).applyQuaternion(inv);
    const sx = v.bodyR / m.R, sy = v.height / m.h, sz = sx;
    const rec = niveis[nome] = {v, m, sx, sy, sz};
    let geom = g0;
    if (nome !== 'S1'){
      const spT = loc(v.spinousTip), tpC = loc(v.tpTip(1)), tl = TRV_L[nome], tpT = tl ? {x: tl[0], y: tl[1], z: tl[2]} : tpC;
      const alvoS = ESP_L[nome] || [spT.y, spT.z];
      const dsy = alvoS[0] - sy * m.sp[0], dsz = alvoS[1] - sz * m.sp[1];
      const dtx = tpT.x - sx * m.tp[0], dty = tpT.y - sy * m.tp[1], dtz = tpT.z - sz * m.tp[2];
      const P0 = g0.attributes.position.array, N0 = g0.attributes.normal.array, n = P0.length, P = new Float32Array(n), N = new Float32Array(n);
      const z0 = m.spZ[0], iz = 1 / (m.spZ[1] - m.spZ[0]), x0 = m.tpX[0], ix = 1 / (m.tpX[1] - m.tpX[0]), jz = m.tpZ;
      for (let i = 0; i < n; i += 3){
        const x = P0[i], y = P0[i + 1], z = P0[i + 2], sg = x < 0 ? -1 : 1;
        const ts = (z - z0) * iz, ws = ramp(ts), wsz = dramp(ts) * iz;                  // espinhoso: peso e derivada em z
        const tt = (sg * x - x0) * ix;
        let wt = ramp(tt), gx = dramp(tt) * ix * sg, gz = 0;                             // transverso: peso e gradiente
        if (jz && wt > 0){ const u = EV.clamp((z - jz[0]) / (jz[1] - jz[0]), 0, 1), j = u * u * (3 - 2 * u), dj = 6 * u * (1 - u) / (jz[1] - jz[0]); gz = wt * dj; gx *= j; wt *= j; }
        const ex = sg * dtx;
        P[i] = sx * x + ex * wt; P[i + 1] = sy * y + dsy * ws + dty * wt; P[i + 2] = sz * z + dsz * ws + dtz * wt;
        /* normal: transposta inversa do jacobiano J = S + δs ⊗ ∇ws + δt ⊗ ∇wt */
        const a0 = sx + ex * gx, a2 = ex * gz, b0 = dty * gx, b2 = dsy * wsz + dty * gz, c0 = dtz * gx, c2 = sz + dsz * wsz + dtz * gz;
        const nx = N0[i], ny = N0[i + 1], nz = N0[i + 2];
        /* linhas a = (a0, 0, a2), b = (b0, sy, b2), c = (c0, 0, c2): n' = (b×c·n, c×a·n, a×b·n) */
        const X = (sy * c2) * nx + (b2 * c0 - b0 * c2) * ny + (-sy * c0) * nz;
        const Y = (c2 * a0 - c0 * a2) * ny;
        const Z = (-a2 * sy) * nx + (a2 * b0 - a0 * b2) * ny + (a0 * sy) * nz;
        const il = 1 / (Math.sqrt(X * X + Y * Y + Z * Z) || 1);
        N[i] = X * il; N[i + 1] = Y * il; N[i + 2] = Z * il;
      }
      geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.BufferAttribute(P, 3));
      geom.setAttribute('normal', new T.BufferAttribute(N, 3));
      geom.setAttribute('color', g0.attributes.color);                                  // cor (oclusão) e índices: os do molde
      geom.setIndex(g0.index);
      geom.computeBoundingSphere();
    }
    const malha = new T.Mesh(geom, matOsso);
    malha.position.copy(v.pos); malha.quaternion.copy(v.quat);
    malha.castShadow = malha.receiveShadow = true; malha.name = nome;
    group.add(malha);
    return rec;
  }
  const L = EV.spine.levels;
  let tm = agora();
  const marca = k => { const t = agora(); tempos[k] = Math.round(t - tm); tm = t; };
  L.forEach(n => { if (n !== 'S1') instanciar(n); });
  marca('niveis');
  { /* ponta do processo articular inferior de L5, levada para o referencial de S1 */
    const l5 = niveis.L5, s1 = EV.spine.v('S1');
    const p = l5.v.local(1.3 * l5.sx, -2.45 * l5.sy, 3.45 * l5.sz).sub(s1.pos).applyQuaternion(s1.quat.clone().invert());
    M.sacro = fazMolde(moldeSacro([p.x, p.y, p.z]), 'sacro');
    tm = agora(); instanciar('S1');
  }

  /* ---------------------------------------------------------------------- discos
     Anel entre a face inferior do corpo de cima e a face superior do de baixo, com o contorno das duas faces e um
     leve abaulamento no meio. */
  const matDisco = EV.mats.cartilage({color: EV.srgb(0xdccb8c)});
  const junta = (g, nome) => { const m = new T.Mesh(g, matDisco); m.castShadow = m.receiveShadow = true; m.name = nome; group.add(m); return m; };
  function disco(a, b){
    const N = Math.max(12, Math.round(24 * Q)), R5 = 5, pos = new Float32Array(N * R5 * 3), cor = new Float32Array(N * R5 * 3), idx = [];
    const borda = (r, th, k, y) => {
      const d = r.m.disco, c = Math.cos(th), s = Math.sin(th), e = d.e;
      const x = d.rx * Math.sign(c) * Math.pow(Math.abs(c), e), z = d.rz * Math.sign(s) * Math.pow(Math.abs(s), e) * (1 - d.flat * Math.pow(Math.max(0, s), 3));
      return r.v.local(x * k * r.sx, y, z * k * r.sz);
    };
    const ya = -a.m.hb * a.sy, yb = b.m.hb * b.sy, tons = [0.62, 0.86, 1, 0.86, 0.62];
    for (let j = 0; j < N; j++){
      const th = j / N * Math.PI * 2;
      const p0 = borda(a, th, 0.84, ya + 0.14), p1 = borda(a, th, 0.985, ya), p3 = borda(b, th, 0.985, yb), p4 = borda(b, th, 0.84, yb - 0.14);
      const c1 = borda(a, th, 0, ya), c3 = borda(b, th, 0, yb), cm = c1.clone().lerp(c3, 0.5);
      const p2 = p1.clone().lerp(p3, 0.5).sub(cm).multiplyScalar(1.04).add(cm);
      [p0, p1, p2, p3, p4].forEach((p, k) => { const o = (k * N + j) * 3; pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z; cor[o] = cor[o + 1] = cor[o + 2] = tons[k]; });
    }
    for (let k = 0; k < R5 - 1; k++) for (let j = 0; j < N; j++){
      const j2 = (j + 1) % N, A = k * N + j, B = k * N + j2, C = (k + 1) * N + j, D = (k + 1) * N + j2;
      idx.push(A, B, C, B, D, C);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(cor, 3));
    g.setIndex(idx); g.computeVertexNormals();
    junta(g, 'disco');
  }
  for (let i = 1; i < L.length - 1; i++) disco(niveis[L[i]], niveis[L[i + 1]]);       // C2/C3 … L5/S1 (entre atlas e áxis não há disco)
  marca('discos');

  /* membrana atlantoaxial posterior: fecha o vão entre o arco do atlas e as lâminas do áxis */
  {
    const a = niveis.C1, b = niveis.C2, nz = new T.Vector3(0, 0, 1).applyQuaternion(b.v.quat), nx = new T.Vector3(1, 0, 0).applyQuaternion(b.v.quat), tmp = new T.Vector3();
    const zA = x => 2.2 - 0.22 * x * x, zB = x => 2.4 - 0.5 * Math.abs(x);
    const g = EV.mesh.sheet({rows: 4, cols: 9,
      point: (u, w) => { const x = (2 * w - 1) * 1.6; return a.v.local(x, -0.25, zA(x)).lerp(b.v.local(x, 0.2, zB(x)), u); },
      normal: (u, w) => tmp.copy(nz).addScaledVector(nx, 0.5 * (2 * w - 1)), thickness: () => 0.26});
    { const c = g.attributes.color.array; for (let i = 0; i < c.length; i += 3){ c[i] = 0.66; c[i + 1] = 0.62; c[i + 2] = 0.52; } }   // fica na sombra do occipital e do arco do atlas
    junta(g, 'ligamento');
  }

  /* ---------------------------------------------------------- ligamentos lombares
     Ligamento amarelo (entre as lâminas) e interespinhoso (entre os espinhosos) de L1/L2 a L4/L5: são as faixas
     amareladas que a referência mostra entre as vértebras lombares. */
  {
    const tmp = new T.Vector3();
    for (let i = L.indexOf('L1'); i < L.indexOf('L5'); i++){
      const a = niveis[L[i]], b = niveis[L[i + 1]];
      const zLam = x => 3.72 - 0.404 * Math.abs(x);                 // plano médio da lâmina no molde lombar
      const na = new T.Vector3(0, 0, 1).applyQuaternion(a.v.quat), nxa = new T.Vector3(1, 0, 0).applyQuaternion(a.v.quat);
      junta(EV.mesh.sheet({rows: 4, cols: 9,
        point: (u, w) => { const x = (2 * w - 1) * 1.45, pa = a.v.local(x * a.sx, -1.15 * a.sy, zLam(x) * a.sz), pb = b.v.local(x * b.sx, 0.3 * b.sy, zLam(x) * b.sz); return pa.lerp(pb, u); },
        normal: (u, w) => tmp.copy(na).addScaledVector(nxa, 0.4 * (w < 0.5 ? -1 : 1) * Math.min(1, Math.abs(2 * w - 1) * 4)).normalize().clone(),
        thickness: () => 0.3}), 'ligamento');
      junta(EV.mesh.sheet({rows: 4, cols: 5,
        point: (u, w) => { const z = 4.0 + 1.0 * w, pa = a.v.local(0, (-1.25 - 0.45 * w) * a.sy, z * a.sz), pb = b.v.local(0, (0.2 - 0.1 * w) * b.sy, z * b.sz); return pa.lerp(pb, u); },
        normal: () => nxa.clone(), thickness: () => 0.34}), 'ligamento');
    }
  }

  /* ------------------------------------------------------------- canal vertebral
     Um tubo escuro por dentro do canal (saco dural): é ele que dá os vãos escuros entre as lâminas e nos forames.
     Entre L5 e o sacro ele alarga e clareia — a janela interlaminar lombossacra, grande e acinzentada na referência. */
  {
    const pts = [], ra = [], rb = [];
    L.forEach(n => {
      const r = niveis[n], k = r.m.rc * r.sx * (n === 'C1' ? 0.7 : 0.9);
      if (n === 'S1'){ const l5 = niveis.L5; pts.push(l5.v.local(0, -0.62 * l5.v.height, 2.75 * l5.sz).lerp(r.v.local(0, 1.5, 2.45), 0.5)); ra.push(1.45); rb.push(0.72);
        pts.push(r.v.local(0, 0.6, 2.4)); ra.push(1.5); rb.push(0.6); pts.push(r.v.local(0, -1.2, 2.0)); ra.push(0.5); rb.push(0.45); return; }
      pts.push(r.v.local(0, n === 'C1' ? 0.1 : 0, r.m.zc * r.sz)); ra.push(k); rb.push(k);
    });
    pts.push(niveis.S1.v.local(0, -4.0, 1.4)); ra.push(0.3); rb.push(0.3);
    /* raio por comprimento de arco (EV.curve é parametrizada pelo comprimento) */
    const acum = [0]; for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const cv = EV.curve(pts), tot = acum[acum.length - 1], par = [0, 0];
    const raio = t => { const s = t * tot; let i = 0; while (i < acum.length - 2 && s > acum[i + 1]) i++; const u = EV.clamp((s - acum[i]) / (acum[i + 1] - acum[i]), 0, 1);
      par[0] = EV.lerp(ra[i], ra[i + 1], u); par[1] = EV.lerp(rb[i], rb[i + 1], u); return par; };
    const g = EV.mesh.tube(t => cv.at(t), {segments: Math.round(100 * Q), radial: 8, radius: raio, up: new T.Vector3(1, 0, 0)});
    /* cor por vértice: oliva-acinzentado no pescoço (os vãos cervicais da referência são sombra, não buraco), escuro
       no tórax e cinza-claro na janela lombossacra */
    { const uv = g.attributes.uv.array, cor = new Float32Array(g.attributes.position.count * 3), c0 = EV.srgb(0x4d4849), c1 = EV.srgb(0xa29c9c), cc = EV.srgb(0x777062),
        t5 = acum[L.indexOf('L5')] / tot, t7 = acum[L.indexOf('C7')] / tot;
      for (let i = 0, j = 0; i < cor.length; i += 3, j += 2){
        const k = EV.smoothstep(t5 - 0.01, t5 + 0.035, uv[j]), kc = 1 - EV.smoothstep(t7, t7 + 0.04, uv[j]);
        cor[i] = EV.lerp(EV.lerp(c0.r, cc.r, kc), c1.r, k); cor[i + 1] = EV.lerp(EV.lerp(c0.g, cc.g, kc), c1.g, k); cor[i + 2] = EV.lerp(EV.lerp(c0.b, cc.b, kc), c1.b, k); }
      g.setAttribute('color', new T.BufferAttribute(cor, 3)); }
    const malha = new T.Mesh(g, new T.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0}));
    malha.receiveShadow = true; malha.name = 'canal'; group.add(malha);
  }

  marca('ligamentos+canal');
  return {group};                                                     // estático
});
})();
