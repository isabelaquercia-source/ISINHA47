/* Peça `shoulder` — escápulas e clavículas.

   ESCÁPULA: modelada UMA vez, em coordenadas locais da escápula direita (EV.scap.L), como uma função de distância
   (SDF) feita sob medida e transformada em malha por EV.mesh.fromSDF. Os dois lados usam a mesma geometria, posta
   no lugar por EV.scap.place(malha, side, state) — a escápula é rígida, então o `update` só troca matrizes.
   As medidas abaixo são NOMINAIS (cm, as mesmas de EV.scap.L antes da escala K); a SDF final é escalada por K.
   Peças da SDF:
     · lâmina  — placa curva com contorno 2D livre (campo de distância numa grade), espessura que muda ao longo
                 da borda (borda medial arredondada, borda lateral em barra grossa, ângulo inferior espesso) e
                 fossas rasas; dobra para a frente acima da espinha (fossa supraespinal);
     · espinha — "loft" ao longo de x: em cada corte x = const a seção é um quadrilátero arredondado
                 (base de cima, crista, lábio de baixo, base de baixo) cujos vértices mudam suavemente; nasce baixa
                 e larga na raiz e sobe para fora; a borda lateral livre (incisura espinoglenoidal) é cavada por
                 um cilindro;
     · acrômio — placa plana inclinada (prateleira) com contorno 2D próprio, do ângulo do acrômio à ponta;
     · colo, glenoide (com a cavidade cavada), tubérculo infraglenoidal e processo coracoide em gancho.
   A malha passa pelos marcos de EV.scap.L e a borda medial segue EV.scap.medial(t) (onde os músculos se prendem).
   Depois do fromSDF há um acabamento local (alisamento + projeção de volta na superfície, normais, sombreado de
   atlas gravado na cor de vértice). A face costal não é mais funda que a da peça provisória (folga do gradil).

   CLAVÍCULA: tubo em S de seção variável (extremidade esternal grossa, corpo roliço, extremidade acromial chata),
   construído uma vez num referencial próprio (X = esternoclavicular → acromioclavicular) e tratado como rígido:
   o `update` só reorienta a malha entre EV.sternum.sc(side, state) e EV.scap.toWorld(EV.scap.L.ac, side, state). */
(() => {
EV.register('shoulder', ({THREE, EV, quality}) => {
  const S = EV.sdf, L = EV.scap.L, group = new THREE.Group(), osso = EV.mats.bone();
  const K = -L.infAngle.y / 13.4, IK = 1 / K;                        // escala das medidas nominais
  const q = EV.clamp(quality || 1, 0.3, 1.5);
  const PI = Math.PI;
  const smin = (a, b, k) => { const h = k - Math.abs(a - b); return (a < b ? a : b) - (h > 0 ? h * h * 0.25 / k : 0); };
  const smax = (a, b, k) => { const h = k - Math.abs(a - b); return (a > b ? a : b) + (h > 0 ? h * h * 0.25 / k : 0); };

  /* ------------------------------------------------------------------ utilidades de curva e de campo 2D */
  /* Contorno fechado suave por pontos de controle [x, y, ...atributos] (Hermite com nós centrípetos):
     devolve pontos a cada ~passo cm, com os atributos interpolados junto. */
  function contorno(ctrl, passo){
    const n = ctrl.length, m = ctrl[0].length, t = [0];
    for (let i = 0; i < n; i++){ const a = ctrl[i], b = ctrl[(i + 1) % n]; t.push(t[i] + Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]))); }
    const tg = [];
    for (let i = 0; i < n; i++){
      const a = ctrl[(i + n - 1) % n], b = ctrl[(i + 1) % n], dt = (t[i + 1] - t[i]) + (i ? t[i] - t[i - 1] : t[n] - t[n - 1]);
      tg.push(a.map((v, c) => (b[c] - v) / dt));
    }
    const out = [];
    for (let i = 0; i < n; i++){
      const p = ctrl[i], pn = ctrl[(i + 1) % n], h = t[i + 1] - t[i], g0 = tg[i], g1 = tg[(i + 1) % n];
      const sub = Math.max(1, Math.round(Math.hypot(pn[0] - p[0], pn[1] - p[1]) / passo));
      for (let s = 0; s < sub; s++){
        const u = s / sub, u2 = u * u, u3 = u2 * u, r = new Array(m);
        for (let c = 0; c < m; c++) r[c] = (2 * u3 - 3 * u2 + 1) * p[c] + (u3 - 2 * u2 + u) * h * g0[c] + (-2 * u3 + 3 * u2) * pn[c] + (u3 - u2) * h * g1[c];
        out.push(r);
      }
    }
    return out;
  }
  /* Campo de distância 2D com sinal (negativo dentro) de um contorno fechado, amostrado numa grade e lido com
     interpolação bilinear. Os atributos dos vértices do contorno (colunas 2…) vão para a grade como média ponderada
     pela proximidade da borda. ler(F, x, y) escreve [distância, atributos…] em F.o (vetor reaproveitado). */
  function campo2D(pts, x0, y0, x1, y1, passo){
    const nx = Math.ceil((x1 - x0) / passo) + 1, ny = Math.ceil((y1 - y0) / passo) + 1, n = pts.length, na = pts[0].length - 2;
    const G = []; for (let a = 0; a <= na; a++) G.push(new Float32Array(nx * ny));
    const ax = new Float64Array(n), ay = new Float64Array(n), ex = new Float64Array(n), ey = new Float64Array(n), il = new Float64Array(n), acc = new Float64Array(na);
    for (let s = 0; s < n; s++){ const a = pts[s], b = pts[(s + 1) % n]; ax[s] = a[0]; ay[s] = a[1]; ex[s] = b[0] - a[0]; ey[s] = b[1] - a[1]; il[s] = 1 / Math.max(1e-12, ex[s] * ex[s] + ey[s] * ey[s]); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
      const px = x0 + i * passo, py = y0 + j * passo;
      let best = 1e18, dentro = false, W = 0;
      acc.fill(0);
      for (let s = 0; s < n; s++){
        const wx = px - ax[s], wy = py - ay[s];
        let u = (wx * ex[s] + wy * ey[s]) * il[s]; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const dx = wx - ex[s] * u, dy = wy - ey[s] * u, d2 = dx * dx + dy * dy;
        if (d2 < best) best = d2;
        /* atributos: média com peso 1/d⁴ — perto da borda vale o da própria borda; no meio da lâmina, onde duas
           bordas ficam à mesma distância, os valores se misturam sem degrau */
        const w = 1 / ((d2 + 0.003) * (d2 + 0.003)), pa = pts[s], pb = pts[(s + 1) % n];
        W += w; for (let a = 0; a < na; a++) acc[a] += w * (pa[2 + a] + (pb[2 + a] - pa[2 + a]) * u);
        const by = ay[s] + ey[s];
        if ((ay[s] > py) !== (by > py) && px < ax[s] + (py - ay[s]) / ey[s] * ex[s]) dentro = !dentro;
      }
      const k = i + j * nx;
      G[0][k] = (dentro ? -1 : 1) * Math.sqrt(best);
      for (let a = 0; a < na; a++) G[a + 1][k] = acc[a] / W;
    }
    return {G, nx, ny, x0, y0, ip: 1 / passo, mx: nx - 1.001, my: ny - 1.001, o: new Float64Array(na + 1)};
  }
  function ler(F, x, y){
    let u = (x - F.x0) * F.ip, v = (y - F.y0) * F.ip, fora = 0;
    if (u < 0){ fora += u * u; u = 0; } else if (u > F.mx){ const e = u - F.mx; fora += e * e; u = F.mx; }
    if (v < 0){ fora += v * v; v = 0; } else if (v > F.my){ const e = v - F.my; fora += e * e; v = F.my; }
    const i = u | 0, j = v | 0, fu = u - i, fv = v - j, k = i + j * F.nx, nx = F.nx, G = F.G, o = F.o;
    const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
    for (let a = 0; a < G.length; a++){ const g = G[a]; o[a] = g[k] * w00 + g[k + 1] * w10 + g[k + nx] * w01 + g[k + nx + 1] * w11; }
    if (fora > 0){ const e = Math.sqrt(fora) / F.ip; o[0] = Math.sqrt(o[0] * o[0] + e * e); }
    return o;
  }
  /* Tabela de parâmetros em função de x: linhas [x, p1, p2…] interpoladas por Hermite monótono e amostradas a cada `passo`. */
  function tabela(rows, passo){
    const n = rows.length, m = rows[0].length - 1, xs = rows.map(r => r[0]), x0 = xs[0], N = Math.round((xs[n - 1] - x0) / passo), cols = [];
    for (let c = 1; c <= m; c++){
      const ys = rows.map(r => r[c]), tg = new Array(n), col = new Float32Array(N + 2);
      for (let i = 0; i < n; i++){
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); tg[i] = (ys[b] - ys[a]) / (xs[b] - xs[a]);
        /* sem ultrapassagem (monótona): onde o valor salta depressa de um nó para o outro, a curva não passa do nó */
        if (i > 0 && i < n - 1){
          const s0 = (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]), s1 = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
          if (s0 * s1 <= 0) tg[i] = 0; else { const lim = 3 * Math.min(Math.abs(s0), Math.abs(s1)); if (Math.abs(tg[i]) > lim) tg[i] = Math.sign(tg[i]) * lim; }
        }
      }
      for (let k = 0; k <= N + 1; k++){
        const x = Math.min(xs[n - 1], x0 + k * passo); let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
        const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
        col[k] = (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * tg[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * tg[i + 1];
      }
      cols.push(col);
    }
    return {cols, x0, N, ip: 1 / passo, passo};
  }

  /* =================================================================================== ESCÁPULA (nominal) */
  const nom = v => [v.x * IK, v.y * IK, v.z * IK];
  const INF = nom(L.infAngle), ANG = nom(L.acromionAngle), PONTA = nom(L.acromionTip), GLEN = nom(L.glenoid);
  const COLO = [8.4, -1.7, -1.0];                                    // colo da escápula (junto da glenoide)

  /* ---- superfície média da lâmina: plano raiz–ângulo inferior–colo, dobrado para a frente acima da espinha */
  const det = INF[0] * COLO[1] - INF[1] * COLO[0];
  const PA = (INF[2] * COLO[1] - INF[1] * COLO[2]) / det, PB = (INF[0] * COLO[2] - INF[2] * COLO[0]) / det;
  /* acima da espinha a lâmina dobra para a frente (fossa supraespinal); a dobra é suave junto da borda medial
     (os marcos do ângulo superior) e forte perto do colo, onde a charneira também desce.
     z0g devolve z e guarda em `incl` o fator de inclinação √(1 + |∇z|²) (para a espessura ser medida na
     perpendicular da lâmina e não ao longo de z). */
  let incl = 1, tEsp = 0;                                             // tEsp: altura acima da linha da espinha (charneira)
  const z0g = (x, y) => {
    const xr = Math.sqrt((x - 6) * (x - 6) + 0.25), xl = 0.5 * (x - 6 + xr), dxl = 0.5 * (1 + (x - 6) / xr);
    const t = y - (0.15 + 0.06 * x - 0.25 * xl), tr = Math.sqrt(t * t + 0.09), tp = 0.5 * (t + tr), dtp = 0.5 * (1 + t / tr);
    const u = x < 1.5 ? 0 : x > 8 ? 1 : (x - 1.5) / 6.5, c1 = 0.13 + 0.6 * u * u * (3 - 2 * u), dc1 = 0.6 * 6 * u * (1 - u) / 6.5;
    const k = (c1 + 0.066 * tp) * dtp, gy = PB - k, gx = PA - dc1 * tp - k * (-0.06 + 0.25 * dxl);
    incl = Math.sqrt(1 + gx * gx + gy * gy); tEsp = t;
    return PA * x + PB * y - c1 * tp - 0.033 * tp * tp;
  };
  const z0 = z0g;

  /* ---- contorno da lâmina visto de trás: [x, y, hB (meia-espessura / raio da borda), wB (largura da faixa de
     borda), viés (deslocamento dorsal do centro da borda)], no sentido ângulo superior → borda superior → colo →
     borda lateral → ângulo inferior → borda medial */
  const borda = [
    [1.22, 3.72, 0.33, 0.6, 0], [1.75, 3.56, 0.32, 0.55, 0], [2.40, 3.25, 0.32, 0.5, 0], [3.30, 2.82, 0.32, 0.5, 0], [4.50, 2.25, 0.32, 0.5, 0],
    [5.60, 1.75, 0.32, 0.5, 0], [6.45, 1.42, 0.32, 0.5, 0],                                   // incisura da escápula
    [7.00, 1.55, 0.34, 0.6, -0.05], [7.75, 1.95, 0.42, 0.8, -0.15], [8.70, 1.62, 0.55, 1.0, -0.28], [9.22, 0.30, 0.66, 1.2, -0.30],
    [9.45, -0.90, 0.75, 1.3, 0], [9.45, -2.40, 0.75, 1.3, 0], [9.30, -3.50, 0.68, 1.3, 0.05],   // atrás da glenoide
    [8.67, -4.30, 0.60, 1.6, 0.12], [7.85, -4.66, 0.58, 1.8, 0.15], [7.20, -5.20, 0.55, 1.8, 0.15], [6.60, -6.20, 0.50, 1.6, 0.12],
    [5.94, -7.20, 0.46, 1.4, 0.09], [5.39, -7.97, 0.45, 1.4, 0.08], [4.85, -8.70, 0.45, 1.4, 0.08], [4.30, -9.47, 0.45, 1.4, 0.08],
    [3.92, -10.20, 0.46, 1.4, 0.08], [3.59, -10.98, 0.47, 1.4, 0.08], [3.30, -11.75, 0.49, 1.4, 0.09], [2.93, -12.50, 0.51, 1.4, 0.10],
    [2.39, -13.10, 0.52, 1.3, 0.10], [1.84, -13.60, 0.54, 1.3, 0.10], [1.30, -13.82, 0.54, 1.3, 0.10], [0.80, -13.72, 0.52, 1.2, 0.09],
    [0.42, -13.30, 0.48, 1.1, 0.08]
  ];
  {
    /* borda medial: segue EV.scap.medial (de baixo para cima) */
    const a = new THREE.Vector3(), b = new THREE.Vector3(), NM = 14;
    for (let i = 0; i <= NM; i++){
      const t = 0.955 - i * 0.955 / NM;
      EV.scap.medial(t, a); EV.scap.medial(Math.max(0, t - 0.02), b);
      let tx = b.x - a.x, ty = b.y - a.y; if (t < 0.02){ EV.scap.medial(0.02, b); tx = a.x - b.x; ty = a.y - b.y; }
      const il = 1 / Math.hypot(tx, ty);
      /* borda fina e rente à face dorsal: a linha de inserção (EV.scap.medial) fica NA quina dorsal da borda, para o
         músculo que chega por ela cobrir o osso; e pouco saliente para dentro, pela folga do gradil na rotação.
         Perto dos ângulos a borda engrossa. */
      const ai = EV.smoothstep(0.78, 0.96, t), as = EV.smoothstep(0.14, 0.02, t);
      const fora = 0.03 + 0.07 * ai + 0.05 * as;
      borda.push([a.x * IK - ty * il * fora, a.y * IK + tx * il * fora, 0.20 + 0.26 * ai + 0.08 * as, 0.75 + 0.3 * ai, -0.11 + 0.19 * ai + 0.07 * as]);
    }
  }
  const FL = campo2D(contorno(borda, 0.3), -1.9, -14.9, 10.9, 4.8, 0.17);
  /* meia-espessura da lâmina nas fossas (dorsal / costal). A lâmina não pode ser mais fina que ~1,4 célula da malha
     (no celular a célula é maior): abaixo disso a "surface nets" abre furinhos, sobretudo onde a lâmina é inclinada */
  const HFD = 0.15, HFV = 0.25;
  /* face dorsal da fossa infraespinal levemente convexa: engrossa depressa junto da borda medial e quase nada dali
     para fora (sem degraus nem vales: vista de raspão, como a escápula esquerda na prancha, fica um degradê limpo) */
  const relevo = x => 0.42 * (1 - Math.exp(-Math.max(0, x + 0.6) / 2.2)) * (1 - EV.smoothstep(-3.4, -0.6, tEsp))    // some junto da espinha: ali a fossa é côncava
    + 0.10 * EV.smoothstep(-0.2, 0.8, tEsp);                           // fossa supraespinal (lâmina inclinada): um pouco mais espessa
  const lamina = (x, y, z) => {
    const o = ler(FL, x, y), d = o[0], hB = o[1], wB = o[2], vies = o[3], zm = z0g(x, y), sf = incl;
    if (d > -hB){ const u = d + hB, w = (z - zm) / sf - vies; return Math.sqrt(u * u + w * w) - hB; }      // borda arredondada
    const s = -d - hB, g = s < wB ? 0.5 + 0.5 * Math.cos(PI * s / wB) : 0;
    const hd = HFD + (hB + vies - HFD) * g + (1 - g) * relevo(x), hv = HFV + (hB - vies - HFV) * g;
    const w = (z - zm) / sf, a = w - hd, b = -hv - w;
    return a > b ? a : b;
  };

  /* ---- espinha: loft ao longo de x. Seção = quadrilátero arredondado [x, base de cima (y, z), crista (y, z), lábio de
     baixo (y, z), base de baixo (y, z), raio]. A placa é inclinada para cima: a crista pende sobre a fossa
     supraespinal, e a face de baixo desce em rampa até a fossa infraespinal (rampa cada vez mais larga para fora). */
  const ESP = [
    [-0.1,  0.30, 0, 0.10, -0.05, -0.10, -0.08, -0.20, 0, 0.20],
    [0.6,   0.20, 0, 0.10,  0.05, -0.08,  0.02, -0.10, 0, 0.24],
    [1.2,   0.10, 0, 0.12,  0.14, -0.06,  0.10,  0.00, 0, 0.26],         // perto da raiz a crista é um lábio que pende
    [2.4,   0.00, 0, 0.20,  0.45, -0.12,  0.36,  0.00, 0, 0.28],         // sobre um sulco (base de baixo recuada)
    [3.5,  -0.08, 0, 0.28,  0.72, -0.14,  0.56, -0.04, 0, 0.30],
    [4.6,  -0.12, 0, 0.42,  0.94, -0.16,  0.66, -0.26, 0, 0.33],
    [5.2,  -0.15, 0, 0.50,  1.04, -0.12,  0.62, -0.46, 0, 0.36],
    [5.8,  -0.18, 0, 0.62,  1.10, -0.06,  0.56, -0.66, 0, 0.38],         // daqui para fora a face de baixo vira rampa larga
    [6.5,  -0.22, 0, 0.74,  1.15, -0.02,  0.50, -0.94, 0, 0.40],
    [7.3,  -0.26, 0, 0.80,  1.19, -0.10,  0.44, -1.20, 0, 0.40],
    [7.9,  -0.30, 0, 0.82,  1.21, -0.12,  0.44, -1.28, 0, 0.40],
    [8.6,  -0.30, 0, 0.82,  1.21, -0.10,  0.46, -1.26, 0, 0.40],
    [9.2,  -0.20, 0, 0.83,  1.22,  0.30,  0.86, -0.85, 0, 0.34]
  ].map(r => { r[2] = z0(r[0], r[1]) + r[9] - 0.15; r[8] = z0(r[0], r[7]) + r[9] - 0.15; return r; }).concat([    // bases dentro da espessura da lâmina
    /* raiz do acrômio: só a faixa da crista, que termina dentro da placa do acrômio */
    [9.5,  0.90, 1.10, 0.84, 1.22, 0.62, 1.08, 0.85, 1.00, 0.30],
    [9.9,  0.90, 1.14, 0.86, 1.19, 0.84, 1.17, 0.88, 1.12, 0.20]
  ]);
  const TS = tabela(ESP, 0.05), TC = TS.cols;
  /* incisura espinoglenoidal: borda lateral livre da espinha, côncava — um cilindro ao longo de y cava a cunha */
  const NCX = 10.2, NCZ = -2.0, NCR = 2.6;
  const py = new Float64Array(4), pz = new Float64Array(4);
  const espinha = (x, y, z) => {
    let u = (x - TS.x0) * TS.ip, fora = 0;
    if (u < 0){ fora = -u * TS.passo; u = 0; } else if (u > TS.N){ fora = (u - TS.N) * TS.passo; u = TS.N; }
    const i = Math.min(TS.N - 1, u | 0), f = u - i;
    for (let k = 0; k < 4; k++){ const a = TC[2 * k], b = TC[2 * k + 1]; py[k] = a[i] + (a[i + 1] - a[i]) * f; pz[k] = b[i] + (b[i + 1] - b[i]) * f; }
    const r = TC[8][i] + (TC[8][i + 1] - TC[8][i]) * f;
    let best = 1e18, dentro = false;
    for (let s = 0, e = 3; s < 4; e = s++){
      const ey = py[s] - py[e], ez = pz[s] - pz[e], wy = y - py[e], wz = z - pz[e];
      let h = (wy * ey + wz * ez) / (ey * ey + ez * ez + 1e-12); h = h < 0 ? 0 : h > 1 ? 1 : h;
      const dy = wy - ey * h, dz = wz - ez * h, d2 = dy * dy + dz * dz;
      if (d2 < best) best = d2;
      if ((pz[e] > z) !== (pz[s] > z) && y < py[e] + (z - pz[e]) / ez * ey) dentro = !dentro;
    }
    let d = (dentro ? -1 : 1) * Math.sqrt(best) - r;
    if (fora > 0) d = d > 0 ? Math.sqrt(d * d + fora * fora) : (d > fora ? d : fora);
    return smax(d, NCR - Math.hypot(x - NCX, z - NCZ), 0.25) * 0.92;
  };

  /* ---- acrômio: prateleira plana. Plano por O (na borda posterior, logo abaixo do ângulo), eixo e1 = +x (ao longo
     da crista), contendo a ponta; (p, s) = coordenadas no plano, c = altura sobre ele */
  const AO = [ANG[0], ANG[1] - 0.28, ANG[2]];
  const dyA = PONTA[1] - AO[1], dzA = PONTA[2] - AO[2], lA = Math.hypot(dyA, dzA);
  /* an = normal do plano (para cima e para trás) = e1 × (ponta − O); a2 = an × e1 = "para a frente" dentro do plano */
  const an = [0, -dzA / lA, dyA / lA], a2 = [0, an[2], -an[1]];
  const acrP = [                                                     // [p, s, hB]; a ponta medial afila para dentro da crista da espinha
    [-4.20, 0.42, 0.38], [-3.00, 0.08, 0.38], [-2.00, 0.01, 0.38], [-0.90, 0.00, 0.38], [0.00, 0.00, 0.38], [0.62, 0.62, 0.38], [1.18, 1.36, 0.37], [1.78, 1.90, 0.36],
    [2.18, 2.70, 0.35], [2.27, 3.50, 0.34], [2.02, 4.18, 0.33], [1.57, 4.46, 0.33], [1.12, 4.26, 0.34],
    [0.75, 3.60, 0.35], [0.35, 3.10, 0.36], [-0.25, 2.70, 0.37], [-0.95, 2.38, 0.38], [-1.70, 2.30, 0.38], [-2.30, 2.10, 0.38], [-2.58, 1.50, 0.38], [-2.80, 0.98, 0.38], [-3.25, 0.70, 0.38]
  ];
  const FA = campo2D(contorno(acrP, 0.16), -5.2, -1.4, 4.0, 5.9, 0.1);
  const HA = 0.34;
  const acromio = (x, y, z) => {
    const ry = y - AO[1], rz = z - AO[2], p = x - AO[0], s = ry * a2[1] + rz * a2[2], c = ry * an[1] + rz * an[2];
    const o = ler(FA, p, s), d = o[0], hB = o[1];
    if (d > -hB){ const u = d + hB; return Math.sqrt(u * u + c * c) - hB; }
    const e = -d - hB, g = e < 0.6 ? 0.5 + 0.5 * Math.cos(PI * e / 0.6) : 0;
    return Math.abs(c) - (HA + (hB - HA) * g);
  };

  /* ---- glenoide (cavidade voltada para fora), colo e tubérculo infraglenoidal */
  const GC = [GLEN[0] - 0.30, GLEN[1], GLEN[2]];                      // fundo da cavidade (0,3 para dentro do marco: na referência a glenoide é mais medial)
  const gn = new THREE.Vector3(0.992, 0.10, 0.07).normalize(), gu = new THREE.Vector3(0, 1, 0), gd = new THREE.Vector3();
  gu.addScaledVector(gn, -gu.dot(gn)).normalize(); gd.crossVectors(gn, gu);
  const MG = (c, off) => new THREE.Matrix4().makeBasis(gn, gu, gd).setPosition(c[0] + gn.x * off, c[1] + gn.y * off, c[2] + gn.z * off);
  const GB = [GC[0] - gn.x * 0.32, GC[1] - gn.y * 0.32, GC[2] - gn.z * 0.32];      // centro do disco (a face fica 0,2 à frente do fundo)
  const disco = (x, y, z) => {
    const rx = x - GB[0], ry = y - GB[1], rz = z - GB[2];
    const n = rx * gn.x + ry * gn.y + rz * gn.z, v = rx * gu.x + ry * gu.y + rz * gu.z + 0.05, w = rx * gd.x + ry * gd.y + rz * gd.z;
    const W = 1.30 - 0.34 * EV.smoothstep(-0.6, 1.7, v);              // contorno em pera: mais estreito em cima
    const a = (Math.sqrt(v * v / 3.42 + w * w / (W * W)) - 1) * W + 0.3, b = Math.abs(n) - 0.52 + 0.3;
    return (a > b ? (a < 0 ? a : 0) : (b < 0 ? b : 0)) + Math.hypot(a > 0 ? a : 0, b > 0 ? b : 0) - 0.3;
  };
  const glenoide = S.sub(
    S.smooth(0.45, disco,
      S.ellipsoid([8.80, -1.75, -1.02], [1.25, 1.65, 0.80]),
      S.sphere([9.58, -3.40, -1.15], 0.40)),
    S.xform(S.ellipsoid([0, 0, 0], [0.90, 1.62, 1.02]), MG(GC, 0.90)), 0.12);

  /* ---- processo coracoide: sobe do alto do colo, dobra e segue para a frente e para fora (gancho) */
  const cor = [[8.85, -0.05, -2.05, 0.88], [8.72, 0.72, -2.85, 0.76], [8.95, 1.10, -3.55, 0.66], [9.50, 0.95, -4.22, 0.58], [10.25, 0.32, -4.55, 0.52], [11.00, -0.22, -4.42, 0.46]];
  const corF = cor.slice(1).map((b, i) => S.capsule(cor[i], b, cor[i][3], b[3]));
  const coracoide = (x, y, z) => { let d = corF[0](x, y, z); for (let i = 1; i < corF.length; i++) d = smin(d, corF[i](x, y, z), 0.3); return d; };

  /* ---- união: cada grupo só é avaliado perto da sua caixa (longe dela vale a distância até a caixa, que é um
     limite inferior da distância verdadeira) */
  const caixa = (b, x, y, z) => Math.max(b[0] - x, x - b[3], b[1] - y, y - b[4], b[2] - z, z - b[5]);
  const BE = [-0.9, -2.0, -1.6, 11.2, 2.5, 1.9], BA = [6.4, 0.0, -3.0, 14.0, 3.6, 2.2], BG = [7.5, -4.1, -2.8, 11.0, 0.3, 0.4], BC = [7.5, -1.0, -5.1, 11.6, 2.8, -0.4];
  const MARG = 1.85;
  const fNom = (x, y, z) => {
    let d = lamina(x, y, z), b;
    b = caixa(BE, x, y, z); if (b < MARG) d = smin(d, espinha(x, y, z), 0.22); else if (b < d) d = b;
    b = caixa(BA, x, y, z); if (b < MARG) d = smin(d, acromio(x, y, z), 0.05); else if (b < d) d = b;
    b = caixa(BG, x, y, z); if (b < MARG) d = smin(d, glenoide(x, y, z), 0.40); else if (b < d) d = b;
    b = caixa(BC, x, y, z); if (b < MARG) d = smin(d, coracoide(x, y, z), 0.45); else if (b < d) d = b;
    return d;
  };
  const fEsc = (x, y, z) => K * fNom(x * IK, y * IK, z * IK);
  const geom = EV.mesh.fromSDF(fEsc, {
    min: [-1.5 * K, -14.6 * K, -5.4 * K], max: [14.3 * K, 4.6 * K, 2.4 * K], cell: 0.215 / Math.pow(q, 0.35),   // a célula cresce pouco no celular (lâmina fina)
    ao: true, aoColor: [0.55, 0.53, 0.68], aoRadius: 1.6, aoStrength: 1.15
  });
  {
    /* acabamento da malha: os vértices da "surface nets" são médias dos cruzamentos e nas bordas finas (borda
       superior, borda medial) saem serrilhados. Duas passadas de alisamento tangencial (média dos vizinhos), cada uma
       seguida de projeção de volta para f = 0 ao longo da normal; na última as normais são refeitas pelo gradiente. */
    const P = geom.attributes.position.array, Nn = geom.attributes.normal.array, I = geom.index.array, nV = P.length / 3;
    const acc = new Float32Array(P.length), cnt = new Float32Array(nV), h = 0.16;   // passo largo: a normal não acompanha o grão das grades 2D
    const grad = (x, y, z, o) => {
      let gx = fEsc(x + h, y, z) - fEsc(x - h, y, z), gy = fEsc(x, y + h, z) - fEsc(x, y - h, z), gz = fEsc(x, y, z + h) - fEsc(x, y, z - h);
      const il = 1 / (Math.sqrt(gx * gx + gy * gy + gz * gz) || 1);
      Nn[o] = gx * il; Nn[o + 1] = gy * il; Nn[o + 2] = gz * il;
    };
    for (let it = 0; it < 2; it++){
      acc.fill(0); cnt.fill(0);
      for (let t = 0; t < I.length; t += 3){
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        for (let k = 0; k < 3; k++){ const pa = P[a + k], pb = P[b + k], pc = P[c + k]; acc[a + k] += pb + pc; acc[b + k] += pa + pc; acc[c + k] += pa + pb; }
        cnt[I[t]] += 2; cnt[I[t + 1]] += 2; cnt[I[t + 2]] += 2;
      }
      for (let v = 0; v < nV; v++){
        const o = v * 3, ic = 1 / (cnt[v] || 1);
        let x = P[o] + 0.55 * (acc[o] * ic - P[o]), y = P[o + 1] + 0.55 * (acc[o + 1] * ic - P[o + 1]), z = P[o + 2] + 0.55 * (acc[o + 2] * ic - P[o + 2]);
        let d = EV.clamp(fEsc(x, y, z), -0.12, 0.12);
        x -= d * Nn[o]; y -= d * Nn[o + 1]; z -= d * Nn[o + 2];
        if (it === 1){                                                  // última passada: normal refeita no ponto e mais um passo
          grad(x, y, z, o);
          d = EV.clamp(fEsc(x, y, z), -0.12, 0.12);
          x -= d * Nn[o]; y -= d * Nn[o + 1]; z -= d * Nn[o + 2];
        }
        P[o] = x; P[o + 1] = y; P[o + 2] = z;
      }
    }
    /* normais: nas superfícies largas e quase planas (lâmina, acrômio) o gradiente tem um ruído pequeno (os campos 2D
       são lidos com interpolação bilinear) que, visto de raspão, vira risquinhos no contorno do material. Média com
       os vizinhos de normal quase igual (≤ ~10°, peso crescente): tira só o ruído do plano, sem tocar nas curvas. */
    for (let it = 0; it < 4; it++){
      acc.fill(0);
      for (let t = 0; t < I.length; t += 3){
        for (let k = 0; k < 3; k++){
          const a = I[t + k] * 3, b = I[t + (k + 1) % 3] * 3;
          const w = (Nn[a] * Nn[b] + Nn[a + 1] * Nn[b + 1] + Nn[a + 2] * Nn[b + 2] - 0.985) / 0.015;
          if (w > 0){ acc[a] += Nn[b] * w; acc[a + 1] += Nn[b + 1] * w; acc[a + 2] += Nn[b + 2] * w; acc[b] += Nn[a] * w; acc[b + 1] += Nn[a + 1] * w; acc[b + 2] += Nn[a + 2] * w; }
        }
      }
      for (let o = 0; o < P.length; o += 3){
        const x = Nn[o] + 0.5 * acc[o], y = Nn[o + 1] + 0.5 * acc[o + 1], z = Nn[o + 2] + 0.5 * acc[o + 2], il = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
        Nn[o] = x * il; Nn[o + 1] = y * il; Nn[o + 2] = z * il;
      }
    }
    /* triângulos minúsculos que ficaram dobrados nas bordas finas (normal geométrica contra a do vértice): desvira,
       para o recorte de faces de trás não abrir furinhos */
    for (let t = 0; t < I.length; t += 3){
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * (Nn[a] + Nn[b] + Nn[c]) + ny * (Nn[a + 1] + Nn[b + 1] + Nn[c + 1]) + nz * (Nn[a + 2] + Nn[b + 2] + Nn[c + 2]) < 0){ const k = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = k; }
    }
    /* sombreado de atlas gravado na cor de vértice: o que olha para baixo (debaixo da espinha, do acrômio, das bordas)
       puxa para um cinza-lavanda, por cima da oclusão de ambiente que o fromSDF já gravou. Depois a cor é alisada
       pela malha (média com os vizinhos), para as transições não acompanharem o desenho dos triângulos nas bordas. */
    const C = geom.attributes.color.array;
    for (let i = 0; i < C.length; i += 3){
      const k = 0.62 * EV.smoothstep(0.05, 0.95, -Nn[i + 1]);
      C[i] *= 1 - 0.30 * k; C[i + 1] *= 1 - 0.32 * k; C[i + 2] *= 1 - 0.16 * k;
    }
    for (let it = 0; it < 3; it++){
      acc.fill(0); cnt.fill(0);
      for (let t = 0; t < I.length; t += 3){
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        for (let k = 0; k < 3; k++){ const ca = C[a + k], cb = C[b + k], cc = C[c + k]; acc[a + k] += cb + cc; acc[b + k] += ca + cc; acc[c + k] += ca + cb; }
        cnt[I[t]] += 2; cnt[I[t + 1]] += 2; cnt[I[t + 2]] += 2;
      }
      for (let v = 0; v < nV; v++){ const o = v * 3, ic = 0.6 / (cnt[v] || 1); for (let k = 0; k < 3; k++) C[o + k] = 0.4 * C[o + k] + acc[o + k] * ic; }
    }
    geom.computeBoundingSphere();
  }

  /* =================================================================================== CLAVÍCULA (rígida) */
  /* referencial próprio: X = esternoclavicular → acromioclavicular, Y = para cima, Z = X × Y (para trás, à direita).
     Dois terços mediais convexos para a frente (−Z), terço lateral convexo para trás (+Z). */
  const scv = new THREE.Vector3(), acv = new THREE.Vector3();
  EV.sternum.sc(1, EV.REST, scv); EV.scap.toWorld(L.ac, 1, EV.REST, acv);
  const CL = scv.distanceTo(acv);                                     // comprimento em repouso
  const cpts = [[0, 0, 0], [0.10, 0.05, -0.45], [0.24, 0.12, -1.20], [0.38, 0.18, -1.45], [0.51, 0.20, -0.95], [0.63, 0.18, -0.05],
                [0.76, 0.12, 0.85], [0.87, 0.10, 0.95], [0.95, 0.10, 0.50], [0.985, 0.10, 0.12]].map(p => new THREE.Vector3(p[0] * CL, p[1], p[2]));
  const rk = [[0, 1.02, 1.08], [0.07, 0.96, 1.02], [0.20, 0.64, 0.70], [0.40, 0.55, 0.59], [0.60, 0.48, 0.66], [0.78, 0.38, 0.88], [0.92, 0.32, 1.02], [1, 0.31, 0.96]];
  const rr = [0, 0];
  const raioClav = t => {
    let i = 0; while (i < rk.length - 2 && t > rk[i + 1][0]) i++;
    const a = rk[i], b = rk[i + 1], u = EV.smoothstep(a[0], b[0], t);
    rr[0] = (a[1] + (b[1] - a[1]) * u) * K; rr[1] = (a[2] + (b[2] - a[2]) * u) * K; return rr;
  };
  const geomClav = EV.mesh.tube(cpts, {segments: Math.round(44 * q), radial: Math.max(8, Math.round(14 * q)), caps: true, radius: raioClav, up: new THREE.Vector3(0, 1, 0)});

  {
    /* a clavícula da referência é mais escura e amarelada por baixo e por trás: sombreado gravado na cor de vértice */
    const Nc = geomClav.attributes.normal.array, Cc = geomClav.attributes.color.array;
    for (let i = 0; i < Nc.length; i += 3){
      const k = EV.smoothstep(-0.7, 0.9, -0.75 * Nc[i + 1] + 0.5 * Nc[i + 2]) * 0.95;
      Cc[i] = 1 - 0.30 * k; Cc[i + 1] = 1 - 0.36 * k; Cc[i + 2] = 1 - 0.52 * k;
    }
  }

  const lados = [1, -1].map(side => {
    const esc = new THREE.Mesh(geom, osso); esc.castShadow = esc.receiveShadow = true; group.add(esc);
    const clav = new THREE.Mesh(geomClav, osso); clav.castShadow = clav.receiveShadow = true; group.add(clav);
    return {side, esc, clav};
  });
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), e3 = new THREE.Vector3(), M = new THREE.Matrix4(), ESP_X = new THREE.Matrix4().makeScale(-1, 1, 1);
  return {group,
    update(state){
      /* clavícula direita: referencial entre a articulação esternoclavicular e a acromioclavicular; a esquerda é o espelho */
      EV.sternum.sc(1, state, scv); EV.scap.toWorld(L.ac, 1, state, acv);
      e1.subVectors(acv, scv); const len = e1.length(); e1.multiplyScalar(1 / len);
      e2.set(0, 1, 0).addScaledVector(e1, -e1.y).normalize(); e3.crossVectors(e1, e2);
      for (const l of lados){
        EV.scap.place(l.esc, l.side, state);
        M.makeBasis(e1, e2, e3).setPosition(scv); M.elements[0] *= len / CL; M.elements[1] *= len / CL; M.elements[2] *= len / CL;
        if (l.side < 0) M.premultiply(ESP_X);
        M.decompose(l.clav.position, l.clav.quaternion, l.clav.scale); l.clav.updateMatrix(); l.clav.matrixWorldNeedsUpdate = true;
      }
    }};
});
})();
