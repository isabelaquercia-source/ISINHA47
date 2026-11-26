/* Peça `skull` — crânio (neurocrânio + face), mandíbula e dentes; três malhas, peça estática (sem update).
   Tudo é escrito em cm no referencial local do crânio (+X direita, +Y para cima, +Z posterior, origem no centro da
   calota) e as malhas recebem EV.skull.center / quat / scale. Só o lado DIREITO é descrito: as SDFs são avaliadas
   em |x| e as malhas são geradas para x ≥ 0 e espelhadas (metade do custo).
   As medidas vieram da prancha de referência (vista por trás e pela direita, de leve por baixo): arco zigomático,
   margem lateral da órbita, ramo e borda inferior da mandíbula, mastoide e linha nucal caem onde ela os mostra. */
(() => {
EV.register('skull', ({THREE, EV, quality}) => {
  const S = EV.sdf, sk = EV.skull, T = THREE, i3 = [0, 1, 2];
  const AO_R = 2.4, LAVANDA = [0.50, 0.47, 0.64];
  const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---- primitivas com caixa envolvente (para os grupos saberem onde estão) ---- */
  const B = (f, mn, mx) => { f.mn = mn; f.mx = mx; return f; };
  const ell = (c, r) => B(S.ellipsoid(c, r), i3.map(i => c[i] - r[i]), i3.map(i => c[i] + r[i]));
  const cap = (a, b, ra, rb) => { const m = Math.max(ra, rb === undefined ? ra : rb);
    return B(S.capsule(a, b, ra, rb), i3.map(i => Math.min(a[i], b[i]) - m), i3.map(i => Math.max(a[i], b[i]) + m)); };
  const pla = (a, b, c, t) => B(S.plate(a, b, c, t), i3.map(i => Math.min(a[i], b[i], c[i]) - t / 2), i3.map(i => Math.max(a[i], b[i], c[i]) + t / 2));
  /* placa poligonal: polígono plano (pontos 3D coplanares, em ordem) com espessura t e bordas arredondadas (t/2).
     Equivale a um leque de S.plate coplanares, mas custa uma função só. */
  const poli = (pts, t) => {
    const N = pts.length, O = pts[0], r = t / 2, n = [0, 0, 0];
    for (let i = 0; i < N; i++){ const a = pts[i], b = pts[(i + 1) % N];                  // normal de Newell
      n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    const nl = Math.hypot(n[0], n[1], n[2]), nx = n[0] / nl, ny = n[1] / nl, nz = n[2] / nl;
    let ux = pts[1][0] - O[0], uy = pts[1][1] - O[1], uz = pts[1][2] - O[2]; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
    const X = new Float64Array(N), Y = new Float64Array(N), IE = new Float64Array(N);
    for (let i = 0; i < N; i++){ const dx = pts[i][0] - O[0], dy = pts[i][1] - O[1], dz = pts[i][2] - O[2]; X[i] = dx * ux + dy * uy + dz * uz; Y[i] = dx * vx + dy * vy + dz * vz; }
    for (let i = 0, j = N - 1; i < N; j = i, i++){ const ex = X[j] - X[i], ey = Y[j] - Y[i]; IE[i] = 1 / Math.max(1e-12, ex * ex + ey * ey); }
    const O0 = O[0], O1 = O[1], O2 = O[2];
    return B((x, y, z) => {
      const px = x - O0, py = y - O1, pz = z - O2, a = px * ux + py * uy + pz * uz, b = px * vx + py * vy + pz * vz, c = px * nx + py * ny + pz * nz;
      let d = 1e18, dentro = false;
      for (let i = 0, j = N - 1; i < N; j = i, i++){
        const ex = X[j] - X[i], ey = Y[j] - Y[i], wx = a - X[i], wy = b - Y[i];
        let h = (wx * ex + wy * ey) * IE[i]; h = h < 0 ? 0 : h > 1 ? 1 : h;
        const bx = wx - ex * h, by = wy - ey * h, q = bx * bx + by * by; if (q < d) d = q;
        const c1 = b >= Y[i], c2 = b < Y[j], c3 = ex * wy > ey * wx;
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) dentro = !dentro;
      }
      return (dentro ? (c < 0 ? -c : c) : Math.sqrt(d + c * c)) - r;
    }, i3.map(i => Math.min(...pts.map(q => q[i])) - r), i3.map(i => Math.max(...pts.map(q => q[i])) + r));
  };
  /* barra varrida: seção elíptica (semi-eixo hv ao longo de `up`, hw atravessado) levada ao longo de uma polilinha de
     estações [centro, up, hv, hw]; up, hv e hw são interpolados de estação em estação pelo ponto mais próximo da
     polilinha — a barra sai contínua (sem emendas, vincos nem "nós"), com as pontas arredondadas. */
  const varrer = est => {
    const n = est.length - 1, A = new Float64Array(3 * (n + 1)), U = new Float64Array(3 * (n + 1)), D = new Float64Array(3 * n), IL = new Float64Array(n);
    const HV = est.map(e => e[2]), HW = est.map(e => e[3]), m = Math.max(...HV, ...HW);
    est.forEach((e, i) => { const l = Math.hypot(e[1][0], e[1][1], e[1][2]); for (const j of i3){ A[i * 3 + j] = e[0][j]; U[i * 3 + j] = e[1][j] / l; } });
    for (let i = 0; i < n; i++){ let q = 0; for (const j of i3){ const d = A[i * 3 + 3 + j] - A[i * 3 + j]; D[i * 3 + j] = d; q += d * d; } IL[i] = 1 / Math.max(1e-12, q); }
    return B((x, y, z) => {
      let best = 1e18, bi = 0, bh = 0, bx = 0, by = 0, bz = 0;
      for (let i = 0, k = 0; i < n; i++, k += 3){
        const px = x - A[k], py = y - A[k + 1], pz = z - A[k + 2], dx = D[k], dy = D[k + 1], dz = D[k + 2];
        let h = (px * dx + py * dy + pz * dz) * IL[i]; h = h < 0 ? 0 : h > 1 ? 1 : h;
        const rx = px - dx * h, ry = py - dy * h, rz = pz - dz * h, q = rx * rx + ry * ry + rz * rz;
        if (q < best){ best = q; bi = i; bh = h; bx = rx; by = ry; bz = rz; }
      }
      const k = bi * 3;
      let ux = U[k] + (U[k + 3] - U[k]) * bh, uy = U[k + 1] + (U[k + 4] - U[k + 1]) * bh, uz = U[k + 2] + (U[k + 5] - U[k + 2]) * bh;
      const il = 1 / Math.sqrt(ux * ux + uy * uy + uz * uz); ux *= il; uy *= il; uz *= il;
      let v = bx * ux + by * uy + bz * uz, w = Math.sqrt(Math.max(0, best - v * v));
      const hv = HV[bi] + (HV[bi + 1] - HV[bi]) * bh, hw = HW[bi] + (HW[bi + 1] - HW[bi]) * bh, iv2 = 1 / (hv * hv), iw2 = 1 / (hw * hw);
      let qv = v * v * iv2, qw = w * w * iw2;
      const k0 = Math.sqrt(qv + qw), k1 = Math.sqrt(qv * iv2 + qw * iw2);
      if (k0 < 1){
        const bv = hv * Math.sqrt(Math.max(0, 1 - qw)) - (v < 0 ? -v : v), bw = hw * Math.sqrt(Math.max(0, 1 - qv)) - w, mm = -(bv < bw ? bv : bw);
        if (k1 < 1e-9) return mm;
        const d = k0 * (k0 - 1) / k1;
        return d > mm ? d : mm;
      }
      const d = k0 * (k0 - 1) / k1, s = d / k1;
      v -= v * iv2 * s; w -= w * iw2 * s; qv = v * v * iv2; qw = w * w * iw2;
      const q0 = Math.sqrt(qv + qw), q1 = Math.sqrt(qv * iv2 + qw * iw2);
      return q1 < 1e-9 ? d : d + q0 * (q0 - 1) / q1;
    }, i3.map(j => Math.min(...est.map(e => e[0][j])) - m), i3.map(j => Math.max(...est.map(e => e[0][j])) + m));
  };
  /* grupo: união (k = 0) ou união suave (k cm) dentro de uma caixa envolvente. Longe da caixa devolve a distância
     até ela (um limite inferior da distância verdadeira): as primitivas do grupo só são avaliadas por perto. A folga
     cobre a maior união suave (k ≤ 1,2) e as três primeiras amostras da oclusão de ambiente (a quarta, a 2,4 cm, pode
     ver até 4% de sombra a mais — imperceptível). */
  const FOLGA = 1.8;
  const grp = (k, fs) => {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const f of fs) for (const i of i3){ mn[i] = Math.min(mn[i], f.mn[i] - k / 4); mx[i] = Math.max(mx[i], f.mx[i] + k / 4); }
    const u = fs.length === 1 ? fs[0] : k ? S.smooth(k, ...fs) : S.union(...fs);
    const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, cz = (mn[2] + mx[2]) / 2, hx = (mx[0] - mn[0]) / 2, hy = (mx[1] - mn[1]) / 2, hz = (mx[2] - mn[2]) / 2;
    return B((x, y, z) => {
      const qx = (x > cx ? x - cx : cx - x) - hx, qy = (y > cy ? y - cy : cy - y) - hy, qz = (z > cz ? z - cz : cz - z) - hz;
      if (qx > FOLGA || qy > FOLGA || qz > FOLGA){ const a = qx > 0 ? qx : 0, b = qy > 0 ? qy : 0, c = qz > 0 ? qz : 0; return Math.sqrt(a * a + b * b + c * c); }
      return u(x, y, z);
    }, mn, mx);
  };
  /* cadeia de cápsulas por uma lista de pontos (união simples: sem "nós" nas emendas); r = número ou lista por ponto */
  const chain = (pts, r) => { const rr = i => Array.isArray(r) ? r[i] : r, o = [];
    for (let i = 0; i + 1 < pts.length; i++) o.push(cap(pts[i], pts[i + 1], rr(i), rr(i + 1))); return grp(0, o); };
  const quad = (a, b, c, d, t) => [pla(a, b, c, t), pla(a, c, d, t)];
  const AP = [0, 0, 1];

  /* =============================================================== CRÂNIO */
  /* neurocrânio: calota (não mexer: a silhueta bate com a referência), cantos da testa, massa do temporal (parede
     lateral baixa, de onde sai o mastoide) e assoalho occipital */
  const calota = ell([0, 0.3, 0.5], [7.3, 6.6, 9.2]);
  const testa = grp(0, [ell([2.4, 0.4, -4.7], [3.0, 4.0, 3.6])]);
  const temporal = grp(0, [ell([4.3, -3.9, 2.0], [1.95, 2.6, 3.8])]);
  const baseOcc = grp(0, [ell([0, -4.6, 2.3], [4.5, 2.35, 4.0])]);
  /* fossa temporal: funda atrás da órbita, acima do arco zigomático */
  const fossa = grp(0, [ell([6.6, -3.4, -4.3], [2.2, 2.3, 3.2])]);
  /* occipital: a escama fica mais cheia e vertical até a linha nucal e dobra para baixo dali (a dobra suave da nuca;
     na linha média ela faz a protuberância occipital externa, discreta) */
  const nucal = grp(0, [ell([0, -1.8, 3.4], [6.2, 3.6, 5.9])]);
  /* processo mastoide: cone chato (largo de frente para trás), rombudo, apontando para baixo e um pouco para a frente */
  const mastoide = grp(0, [varrer([[[5.3, -4.6, 2.4], AP, 1.6, 1.0], [[5.15, -6.75, 1.85], AP, 0.72, 0.56]])]);
  /* base: côndilos occipitais, parte basilar e lâminas pterigoides */
  const base = grp(0.4, [
    ell([1.95, -6.7, 0.75], [0.72, 0.5, 1.15]),
    cap([0, -6.2, -0.6], [0, -5.3, -3.2], 1.15),
    pla([1.6, -5.2, -3.6], [2.6, -7.9, -2.7], [1.6, -8.0, -3.9], 0.42)
  ]);
  /* raiz do processo zigomático do temporal + arco zigomático (barra chata, mais alta que grossa) */
  const arcoP = [[5.3, -4.55, -4.9], [5.85, -4.35, -3.9], [6.2, -4.15, -2.6], [6.2, -4.1, -1.0], [5.95, -4.05, 0.5], [5.6, -3.8, 2.2]];
  const arco = grp(0.3, [varrer(arcoP.map(p => [p, [0, 1, 0], 0.56, 0.34])), ell([5.3, -4.1, 0.3], [1.0, 0.45, 1.2])]);
  /* face */
  const arcSup = [[0, -7.75, -8.25], [1.45, -7.75, -7.65], [2.05, -7.75, -6.65], [2.4, -7.75, -5.3], [2.55, -7.75, -3.4]];   // arcada superior
  const Z1 = [4.6, -1.9, -6.25], ZJ = [5.3, -3.9, -5.1], Z5 = [5.4, -5.0, -4.6], Z4 = [4.15, -5.95, -5.9], Z3 = [3.85, -4.8, -6.9], ZO = [4.7, -4.0, -6.1];
  const face = grp(0.5, [
    grp(0.5, [                                                                            // linha média
      ell([0, -3.2, -6.0], [1.45, 2.0, 2.3]),                                             // entre as órbitas (etmoide)
      chain([[0, -1.2, -8.1], [1.5, -1.15, -8.05], [3.3, -1.0, -7.45], [4.55, -1.55, -6.35]], 0.55),   // glabela e arco superciliar
      cap([1.1, -2.0, -7.85], [1.45, -4.9, -8.0], 0.5),                                   // processo frontal da maxila
      cap([0, -1.9, -7.95], [0, -3.8, -8.6], 0.55)                                        // ossos nasais
    ]),
    grp(0.5, [                                                                            // órbita e zigomático
      grp(0.2, quad([4.6, -1.6, -6.25], [4.7, -4.3, -6.05], [3.5, -4.4, -3.9], [3.5, -1.7, -4.1], 0.45)),   // parede lateral da órbita
      grp(0.2, quad([1.6, -4.75, -7.6], [4.6, -4.7, -6.2], [3.5, -4.5, -4.0], [1.6, -4.4, -4.3], 0.5)),       // assoalho da órbita
      cap([4.57, -1.6, -6.3], ZO, 0.42),                                                  // margem lateral da órbita
      chain([ZO, Z3, [1.9, -4.8, -7.7]], 0.45),                                           // margem infraorbital
      grp(0.2, [pla(Z1, ZJ, ZO, 0.6), pla(ZJ, Z5, ZO, 0.6), pla(ZO, Z5, Z4, 0.6), pla(ZO, Z4, Z3, 0.6)]),     // zigomático (placa)
      ell([3.4, -5.2, -6.1], [1.45, 1.0, 1.25]),                                          // processo zigomático da maxila
      cap([4.15, -5.8, -5.8], [3.0, -6.7, -5.2], 0.45)                                    // pilar zigomático-maxilar
    ]),
    grp(0.5, [ell([0, -5.7, -5.9], [3.0, 2.2, 2.6]), chain(arcSup, 0.58)])                // corpo da maxila + processo alveolar
  ]);
  /* cavidades (subtraídas no fim) e septo nasal (somado depois delas) */
  const orbita = grp(0, [cap([3.6, -3.0, -8.4], [1.75, -3.3, -4.2], 1.85, 0.8)]);
  const piriforme = grp(0, [ell([0, -5.8, -8.3], [1.15, 1.4, 2.0]), ell([0, -4.8, -8.3], [0.75, 1.2, 1.6])]);
  const palato = grp(0, [ell([0, -8.5, -5.5], [1.6, 1.2, 3.0])]);
  const forame = grp(0, [ell([0, -6.6, 1.7], [1.5, 2.2, 1.8])]);
  const meato = grp(0, [cap([6.8, -4.9, 1.15], [4.6, -4.8, 0.9], 0.42)]);
  const septo = grp(0, [pla([0, -4.4, -7.9], [0, -7.0, -8.0], [0, -5.6, -5.9], 0.44)]);
  /* A raiz é escrita "achatada" (sem empilhar S.smooth / S.sub): metade das chamadas por avaliação.
     une(a, b, k) e tira(a, b, k) são a união suave e a subtração suave do core, para dois valores. */
  const une = (a, b, k) => { const h = k - (a > b ? a - b : b - a); return (a < b ? a : b) - (h > 0 ? h * h * 0.25 / k : 0); };
  const tira = (a, b, k) => { const q = -b, h = k - (a > q ? a - q : q - a); return (a > q ? a : q) + (h > 0 ? h * h * 0.25 / k : 0); };
  const solido = (x, y, z) => {                                       // crânio sem as cavidades (x ≥ 0)
    let d = calota(x, y, z);
    d = une(d, testa(x, y, z), 1.0); d = une(d, temporal(x, y, z), 1.2); d = une(d, baseOcc(x, y, z), 1.0);
    d = tira(d, fossa(x, y, z), 0.7); d = une(d, nucal(x, y, z), 0.7);
    d = une(d, mastoide(x, y, z), 0.6); d = une(d, base(x, y, z), 0.6); d = une(d, face(x, y, z), 0.6);
    return une(d, arco(x, y, z), 0.4);
  };
  const fCranio = (x, y, z) => {
    if (x < 0) x = -x;
    let d = solido(x, y, z);
    d = tira(d, orbita(x, y, z), 0.3); d = tira(d, piriforme(x, y, z), 0.25); d = tira(d, palato(x, y, z), 0.3);
    d = tira(d, forame(x, y, z), 0.3); d = tira(d, meato(x, y, z), 0.2);
    return une(d, septo(x, y, z), 0.15);
  };

  /* ============================================================= MANDÍBULA
     Ramo largo e chato (placa poligonal); corpo em parábola até o mento (barra varrida de seção elíptica). */
  /* estações do corpo: [borda inferior, crista alveolar] do ângulo até o mento */
  const est = [
    [[4.9, -11.7, -1.7], [4.85, -10.0, -2.2]],
    [[4.25, -11.75, -2.9], [3.4, -9.75, -3.4]],
    [[3.25, -11.75, -4.3], [2.5, -10.15, -4.3]],
    [[2.6, -11.75, -5.7], [2.3, -10.15, -5.5]],
    [[1.45, -11.7, -7.15], [1.6, -10.15, -7.1]],
    [[0, -11.65, -7.55], [0, -10.15, -7.85]]
  ];
  /* o caminho é suavizado (Catmull-Rom) e vira uma barra varrida de seção elíptica (alta e fina) */
  const NB = 10, cL = EV.curve(est.map(e => EV.V(...e[0]))), cU = EV.curve(est.map(e => EV.V(...e[1]))), secs = [];
  for (let i = 0; i <= NB; i++){ const a = cL.at(i / NB), b = cU.at(i / NB); secs.push([[i === NB ? 0 : a.x, a.y, a.z], [i === NB ? 0 : b.x, b.y, b.z]]); }
  const meio = e => i3.map(i => (e[0][i] + e[1][i]) / 2), sobe = e => i3.map(i => e[1][i] - e[0][i]), alt = e => Math.hypot(...sobe(e)) / 2 + 0.45;
  const corpo = varrer(secs.map((e, i) => [meio(e), sobe(e), alt(e), 0.5 + 0.06 * i / NB]));
  /* ramo: placa poligonal num plano oblíquo (os ramos convergem para a frente); contorno em (z, y): côndilo, borda
     posterior, ângulo aberto e arredondado, borda inferior, borda anterior, processo coronoide e incisura */
  const ramoZY = [[-0.8, -5.3], [-0.5, -6.8], [-0.35, -8.2], [-0.35, -9.6], [-0.6, -10.5], [-1.15, -11.2], [-1.85, -11.65], [-2.6, -11.8],
    [-2.9, -10.6], [-2.85, -9.0], [-2.9, -7.2], [-3.3, -4.9], [-2.85, -5.6], [-2.5, -6.15], [-2.1, -6.35], [-1.75, -6.1], [-1.5, -5.4]];
  const ramo = poli(ramoZY.map(q => [5.15 + 0.22 * (q[0] + 0.35), q[1], q[0]]), 0.6);
  const mRamo = grp(0, [ramo]), mCondilo = grp(0, [ell([5.0, -4.95, -1.2], [1.0, 0.48, 0.5])]), mCorpo = grp(0, [corpo]);
  const mBorda = chain(secs.map(e => e[0]), 0.5);                                 // borda inferior (grossa)
  const mMento = grp(0, [ell([0, -11.6, -7.72], [1.2, 0.75, 0.42])]);             // protuberância mentual
  const fMand = (x, y, z) => {
    if (x < 0) x = -x;
    let d = une(mRamo(x, y, z), mCondilo(x, y, z), 0.3);
    d = une(d, mCorpo(x, y, z), 0.45); d = une(d, mBorda(x, y, z), 0.45);
    return une(d, mMento(x, y, z), 0.3);
  };

  /* ================================================================ DENTES
     Coroas como superelipsoides ("caixas" arredondadas) ao longo das arcadas; uma malha só. */
  const arcInf = [[0, -10.15, -7.9], [1.35, -10.15, -7.4], [1.95, -10.15, -6.5], [2.3, -10.15, -5.3], [2.5, -10.15, -3.6]];
  const dentes = () => {
    const NU = Math.max(6, Math.round(8 * quality)), NV = Math.max(4, Math.round(6 * quality)), E = 0.55;
    const pos = [], nor = [], col = [], idx = [];
    const pw = (v, e) => (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), e);
    /* c = centro da coroa, t = tangente da arcada, n = normal para fora (vestibular), dir = −1 superior / +1 inferior */
    const dente = (c, t, n, w, d, h, dir, tipo) => {
      const base = pos.length / 3;
      for (let v = 0; v <= NV; v++){
        const ph = -Math.PI / 2 + Math.PI * v / NV, cy = Math.sin(ph), cr = Math.cos(ph);
        for (let u = 0; u <= NU; u++){
          const th = 2 * Math.PI * u / NU, cx = cr * Math.cos(th), cz = cr * Math.sin(th);
          const s = EV.clamp((cy * dir + 1) / 2, 0, 1), s2 = s * s;                   // 0 na raiz, 1 na ponta
          const ka = tipo === 1 ? EV.lerp(1, 0.55, s2) : 1, kb = tipo === 0 ? EV.lerp(1, 0.42, s2) : tipo === 1 ? EV.lerp(1, 0.6, s2) : EV.lerp(1, 0.88, s2);
          const a = pw(cx, E) * w / 2 * ka, b = pw(cz, E) * d / 2 * kb, y = pw(cy, E) * h / 2;
          pos.push(c[0] + t[0] * a + n[0] * b, c[1] + y, c[2] + t[2] * a + n[2] * b);
          const na = pw(cx, 2 - E) / (w * ka), nb = pw(cz, 2 - E) / (d * kb), ny = pw(cy, 2 - E) / h;
          const nx = t[0] * na + n[0] * nb, nz = t[2] * na + n[2] * nb, il = 1 / (Math.hypot(nx, ny, nz) || 1);
          nor.push(nx * il, ny * il, nz * il);
          const g = EV.lerp(0.74, 1, EV.smoothstep(0.05, 0.5, s));                    // mais escuro junto da gengiva
          col.push(g, g * 0.985, g * 0.95);
        }
      }
      for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++){
        const p0 = base + v * (NU + 1) + u, p1 = p0 + 1, p2 = p0 + NU + 1, p3 = p2 + 1;
        idx.push(p0, p2, p1, p1, p2, p3);
      }
    };
    /* larguras do incisivo central ao 3º molar; tipo: 0 incisivo (cunha), 1 canino (ponta), 2 pré-molar/molar */
    const L = [0.86, 0.68, 0.78, 0.70, 0.68, 1.0, 0.96, 0.84], TP = [0, 0, 1, 2, 2, 2, 2, 2];
    const arcada = (pts, dir, yBase, o) => {
      const P = pts.slice().reverse().map(p => EV.V(p[0], 0, p[2])).concat(pts.slice(1).map(p => EV.V(-p[0], 0, p[2])));   // direita (atrás) → frente → esquerda
      const cv = EV.curve(P), half = cv.length / 2, soma = L.reduce((a, b) => a + b, 0) * o.w, k = Math.min(1, half * 0.985 / soma);
      for (const lado of [1, -1]){
        let s = 0;
        for (let i = 0; i < L.length; i++){
          const w = L[i] * o.w * k, sm = s + w / 2; s += w;
          const tt = 0.5 - lado * sm / cv.length, p = cv.at(tt), tg = cv.tangent(tt);
          const n = [tg.z, 0, -tg.x]; if (n[0] * p.x + n[2] * (p.z + 5) < 0){ n[0] = -n[0]; n[2] = -n[2]; }     // para fora da arcada
          dente([p.x, yBase + dir * o.h[i] / 2, p.z], [tg.x, 0, tg.z], n, w * 0.93, o.d[i], o.h[i], dir, TP[i]);
        }
      }
    };
    arcada(arcSup, -1, -8.22, {w: 1, h: [1.02, 0.92, 1.0, 0.82, 0.8, 0.78, 0.76, 0.72], d: [0.66, 0.6, 0.78, 0.9, 0.9, 1.08, 1.08, 1.0]});
    arcada(arcInf, 1, -9.86, {w: 0.94, h: [0.96, 0.96, 0.98, 0.82, 0.8, 0.8, 0.78, 0.74], d: [0.56, 0.56, 0.72, 0.8, 0.82, 1.0, 1.0, 0.95]});
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(nor), 3));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(col), 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  };

  /* ================================================================ MALHAS */
  /* Cor de vértice por cima da oclusão do fromSDF:
     · sombra lavanda nas faces viradas para baixo (base do crânio, nuca, embaixo do arco e da mandíbula), larga e
       macia como na referência;
     · `fundo(x, y, z)` → 0..1: escurece o interior das cavidades (órbitas, nariz, forame magno, boca). */
  const pintar = (geom, forca, fundo, tom, y0, y1) => {
    const pos = geom.attributes.position.array, nor = geom.attributes.normal.array, cor = geom.attributes.color.array;
    for (let i = 0; i < nor.length; i += 3){
      /* (a calota é um elipsoide: a nuca já "olha" um pouco para baixo bem acima da linha nucal; y0..y1 seguram a
         sombra até a altura em que ela começa na referência) */
      const w = EV.smoothstep(0.02, -0.7, nor[i + 1]) * forca * (y0 === undefined ? 1 : EV.smoothstep(y0, y1, pos[i + 1]));
      /* o material do osso (core) também escurece e esfria o que olha para baixo, MENOS onde a cor de vértice já vem
         azulada: um viés de 9% no azul em tudo o que olha para baixo deixa essa sombra por conta desta pintura (sem
         ele a calota ganhava uma faixa escura acima da linha nucal e uma faixa clara na transição) */
      let r = EV.lerp(1, 0.87, w), g = EV.lerp(1, 0.83, w), b = EV.lerp(1, 1.5, w) * (1 + 0.09 * EV.smoothstep(0.1, -0.08, nor[i + 1]));
      if (fundo){ const d = fundo(pos[i], pos[i + 1], pos[i + 2], nor[i], nor[i + 1], nor[i + 2]); r *= EV.lerp(1, tom[0], d); g *= EV.lerp(1, tom[1], d); b *= EV.lerp(1, tom[2], d); }
      cor[i] *= r; cor[i + 1] *= g; cor[i + 2] *= b;
    }
  };
  /* As SDFs são simétricas: cada malha é gerada só para x ≥ 0 (a grade começa três células antes do plano mediano, com
     um plano de nós exatamente em x = 0) e depois espelhada — metade do custo. Os triângulos que cruzam o plano ficam
     uma vez só; os que caem inteiros no lado esquerdo saem (voltam como espelho dos do lado direito). As três
     camadas de folga garantem que as duas passadas de alisamento das normais dão o mesmo resultado dos dois lados
     da emenda. */
  const meia = (f, mn, mx, cell, aoR) => {
    const g = EV.mesh.fromSDF(f, {min: [-3 * cell, mn[1], mn[2]], max: mx, cell, ao: true, aoRadius: aoR, aoColor: LAVANDA});
    /* As normais vêm do gradiente da SDF e "tremem" nas placas finas e nos vincos (viram de um vértice para o outro):
       vistas de raspão, o traço de contorno do material do osso saía rabiscado. Duas passadas de média com os vizinhos
       acalmam as normais sem mexer na forma. */
    const N = g.attributes.normal.array, I = g.index.array, A = new Float32Array(N.length);
    for (let p = 0; p < 2; p++){
      A.fill(0);
      for (let t = 0; t < I.length; t += 3){
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        for (let j = 0; j < 3; j++){ const s = N[a + j] + N[b + j] + N[c + j]; A[a + j] += s; A[b + j] += s; A[c + j] += s; }
      }
      for (let v = 0; v < N.length; v += 3){ const x = A[v], y = A[v + 1], z = A[v + 2], l = Math.hypot(x, y, z); if (l > 1e-9){ N[v] = x / l; N[v + 1] = y / l; N[v + 2] = z / l; } }
    }
    return g;
  };
  const espelhar = g => {
    const P = g.attributes.position.array, Nm = g.attributes.normal.array, C = g.attributes.color.array, I = g.index.array, nv = P.length / 3, EPS = 1e-5;
    const par = new Int32Array(nv); let nt = nv;
    for (let v = 0; v < nv; v++) par[v] = P[v * 3] > EPS ? nt++ : v;                       // índice do espelho (vértices no plano: eles mesmos)
    const pos = new Float32Array(nt * 3), nor = new Float32Array(nt * 3), cor = new Float32Array(nt * 3);
    pos.set(P); nor.set(Nm); cor.set(C);
    for (let v = 0; v < nv; v++){ const m = par[v]; if (m === v) continue;
      pos[m * 3] = -P[v * 3]; pos[m * 3 + 1] = P[v * 3 + 1]; pos[m * 3 + 2] = P[v * 3 + 2];
      nor[m * 3] = -Nm[v * 3]; nor[m * 3 + 1] = Nm[v * 3 + 1]; nor[m * 3 + 2] = Nm[v * 3 + 2];
      cor[m * 3] = C[v * 3]; cor[m * 3 + 1] = C[v * 3 + 1]; cor[m * 3 + 2] = C[v * 3 + 2]; }
    const idx = new (nt > 65535 ? Uint32Array : Uint16Array)(I.length * 2); let ni = 0;
    for (let t = 0; t < I.length; t += 3){
      const a = I[t], b = I[t + 1], c = I[t + 2], esq = (P[a * 3] < -EPS ? 1 : 0) + (P[b * 3] < -EPS ? 1 : 0) + (P[c * 3] < -EPS ? 1 : 0);
      if (esq === 3) continue;
      idx[ni++] = a; idx[ni++] = b; idx[ni++] = c;
      if (esq === 0){ idx[ni++] = par[a]; idx[ni++] = par[c]; idx[ni++] = par[b]; }
    }
    const o = new T.BufferGeometry();
    o.setAttribute('position', new T.BufferAttribute(pos, 3)); o.setAttribute('normal', new T.BufferAttribute(nor, 3)); o.setAttribute('color', new T.BufferAttribute(cor, 3));
    o.setIndex(new T.BufferAttribute(idx.slice(0, ni), 1));
    o.computeBoundingSphere();
    return o;
  };
  /* as peças finas (arco zigomático, placas da órbita, ramo) quebram com células grandes: a malha engrossa com a raiz
     da qualidade (0,6 → células 1,29× maiores, em vez de 1,67×) */
  const QM = Math.sqrt(quality);
  const group = new T.Group(), ms = {};
  const add = (geom, mat) => { const m = new T.Mesh(geom, mat || EV.mats.bone());
    m.position.copy(sk.center); m.quaternion.copy(sk.quat); m.scale.setScalar(sk.scale); m.castShadow = m.receiveShadow = true; group.add(m); return m; };

  let t0 = agora();
  const gCranio = meia(fCranio, [0, -9.4, -10.2], [8.2, 7.6, 10.4], 0.31 / QM, AO_R);
  /* fundo do crânio: (1) profundidade abaixo da superfície "sem cavidades" = quão dentro de uma órbita, do nariz, do
     forame magno ou do meato o vértice está; (2) a região atrás da maxila (coanas, lâminas pterigoides), que na
     referência é a mancha escura entre a base do crânio e o ramo da mandíbula; (3) a fossa temporal, de leve */
  const faringe = (x, y, z) => EV.smoothstep(4.0, 2.6, Math.abs(x)) * EV.smoothstep(-4.6, -5.6, y) * EV.smoothstep(-0.6, -1.8, z) * EV.smoothstep(-6.0, -4.6, z);
  pintar(gCranio, 1.0, (x, y, z) => { const ax = x < 0 ? -x : x;
    return Math.max(EV.smoothstep(0.1, 1.2, -solido(ax, y, z)), 0.8 * faringe(x, y, z), 0.3 * EV.smoothstep(0.35, 0.0, fossa(ax, y, z))); }, [0.30, 0.28, 0.36], -3.9, -5.4);
  add(espelhar(gCranio)).name = 'cranio';
  ms.cranio = Math.round(agora() - t0); t0 = agora();
  const gMand = meia(fMand, [0, -13.2, -9.2], [6.6, -3.8, 1.4], 0.26 / QM, 1.8);
  /* face lingual (de dentro da boca) mais escura e oliva, como na referência */
  pintar(gMand, 0.85, (x, y, z, nx) => 0.92 * EV.smoothstep(0.1, -0.7, nx * (x < 0 ? -1 : 1)) * EV.smoothstep(-4.2, -6.0, y), [0.36, 0.33, 0.25]);
  add(espelhar(gMand)).name = 'mandibula';
  ms.mandibula = Math.round(agora() - t0); t0 = agora();
  add(dentes(), EV.mats.bone({color: EV.srgb(0xfbf6e6), roughness: 0.26})).name = 'dentes';
  ms.dentes = Math.round(agora() - t0);
  group.userData.ms = ms;                                             // tempo de cada malha (diagnóstico)

  return {group};                                                     // estático
});
})();
