/* Peça `body` — corpo "fantasma": a silhueta pálida e translúcida de um tronco musculoso (cabeça, pescoço, ombros,
   braços, cintura e quadril) que fica ATRÁS de todos os ossos e músculos, como no render de atlas da referência.

   Geometria: uma SDF própria, simétrica em X (avaliada com |x|):
     · tronco e pescoço = "loft" de seções horizontais em superelipse (tabela SEC), com relevo muscular somado por dois
       mapas de altura (costas e frente);
     · cabeça, ombros, braços e antebraços = cones arredondados e elipsoides unidos com concordância suave.
   A silhueta foi ajustada sobre a máscara da referência na vista 'ref'.
   Pintura por vértice: oclusão (sulcos), "brancura" (tendões, fáscias, aponeuroses) e a direção das fibras.
   Material próprio (não usa EV.mats.ghost): ver MATERIAL, mais abaixo. Estático: sem update. */
(() => {
EV.register('body', ({THREE, EV, quality}) => {
  const sk = EV.skull, sstep = EV.smoothstep;

  /* ------------------------------------------------------------------ tronco (loft)
     Seções: [y, a (meia-largura), zb (z das costas), zf (z da frente), zc (z da linha mais larga), nB, nF].
     Em cada altura a seção é (|x|/a)^n + (|z − zc|/b)^n = 1, com b e n próprios atrás (zb − zc, nB) e na frente
     (zc − zf, nF): n = 2 elipse, n < 2 mais "em losango" (a cintura afina para trás), n > 2 mais quadrada. */
  const SEC = [
    [-30, 15.6, 6.0, -11.0, -2.5, 1.9, 2.2],
    [-22, 16.0, 7.0, -11.5, -2.3, 1.8, 2.2],
    [-14, 16.2, 7.5, -11.5, -2.0, 1.65, 3.0],
    [ -9, 16.2, 7.5, -11.5, -2.0, 1.58, 3.0],
    [ -4, 15.8, 7.0, -11.5, -2.3, 1.58, 3.0],
    [  0, 14.8, 6.8, -11.6, -2.6, 1.48, 2.8],
    [  3, 13.3, 6.5, -11.8, -2.8, 1.45, 2.6],
    [  6, 12.25, 6.2, -12.0, -3.0, 1.42, 2.2],
    [  9, 12.2, 6.0, -12.2, -3.2, 1.58, 2.2],
    [ 12, 12.7, 6.1, -12.5, -3.2, 1.70, 2.2],
    [ 14, 13.35, 6.2, -12.7, -3.2, 1.75, 2.4],
    [ 16, 13.95, 6.4, -12.9, -3.2, 1.81, 2.5],
    [ 17, 14.25, 6.55, -13.05, -3.2, 1.84, 2.6],
    [ 18, 14.45, 6.7, -13.2, -3.2, 1.94, 2.7],
    [ 20, 14.75, 6.95, -13.6, -3.2, 2.25, 2.8],
    [ 24, 15.2, 7.7, -14.3, -3.2, 2.65, 2.8],
    [ 30, 15.9, 8.85, -14.8, -3.0, 2.60, 2.6],
    [ 35, 16.4, 9.2, -14.6, -2.4, 2.40, 2.5],
    [ 39, 16.8, 8.8, -13.2, -1.6, 2.30, 2.4],
    [ 41.5, 17.2, 8.0, -11.4, -0.8, 2.15, 2.1],
    [ 43.2, 17.3, 7.2,  -9.6, -0.4, 2.00, 1.8],
    [ 44, 14.2, 7.0,  -8.5,  1.6, 2.0, 1.5],
    [ 45, 12.0, 7.0,  -7.9,  2.0, 2.0, 1.42],
    [ 46, 10.0, 6.9,  -7.6,  2.4, 2.0, 1.36],
    [ 47,  7.9, 6.6,  -7.4,  2.7, 2.0, 1.32],
    [ 48,  6.9, 6.1,  -7.3,  2.6, 2.0, 1.34],
    [ 49,  6.2, 5.7,  -7.3,  2.2, 2.0, 1.42],
    [ 50,  5.6, 5.5,  -7.4,  1.5, 2.0, 1.6],
    [ 51,  5.3, 5.3,  -7.6,  0.6, 2.0, 1.8],
    [ 52,  5.2, 5.2,  -7.8, -0.3, 2.0, 1.9],
    [ 53,  5.1, 5.3,  -8.2, -0.7, 2.0, 2.0],
    [ 55,  5.67, 5.4, -8.3, -0.8, 2.0, 2.0],
    [ 57,  6.1, 5.8,  -8.3, -0.8, 2.0, 2.0],
    [ 59,  6.8, 6.6,  -8.3, -0.8, 2.0, 2.0],
    [ 61,  7.2, 7.4,  -8.3, -0.8, 2.0, 2.0]
  ];
  const LY0 = SEC[0][0], LY1 = SEC[SEC.length - 1][0], LSTEP = 0.25, LN = Math.round((LY1 - LY0) / LSTEP) + 1;
  const TA = new Float64Array(LN + 1), TC = new Float64Array(LN + 1), TB = new Float64Array(LN + 1), TF = new Float64Array(LN + 1), TNB = new Float64Array(LN + 1), TNF = new Float64Array(LN + 1);
  { /* interpolação cúbica de Hermite (tangentes por diferenças finitas, limitadas para não ondular) */
    const n = SEC.length, col = c => {
      const m = new Array(n);
      for (let i = 0; i < n; i++){
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        m[i] = (SEC[i1][c] - SEC[i0][c]) / (SEC[i1][0] - SEC[i0][0]);
        if (i > 0 && i < n - 1){ const s0 = (SEC[i][c] - SEC[i - 1][c]) / (SEC[i][0] - SEC[i - 1][0]), s1 = (SEC[i + 1][c] - SEC[i][c]) / (SEC[i + 1][0] - SEC[i][0]);
          if (s0 * s1 <= 0) m[i] = 0; else { const lim = 3 * Math.min(Math.abs(s0), Math.abs(s1)); if (Math.abs(m[i]) > lim) m[i] = Math.sign(m[i]) * lim; } }
      }
      return y => { let i = 0; while (i < n - 2 && y > SEC[i + 1][0]) i++;
        const h = SEC[i + 1][0] - SEC[i][0], u = EV.clamp((y - SEC[i][0]) / h, 0, 1), u2 = u * u, u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * SEC[i][c] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * SEC[i + 1][c] + (u3 - u2) * h * m[i + 1]; };
    };
    const fa = col(1), fb = col(2), ff = col(3), fc = col(4), fnb = col(5), fnf = col(6);
    for (let i = 0; i <= LN; i++){ const y = Math.min(LY1, LY0 + i * LSTEP), zc = fc(y);
      TA[i] = fa(y); TC[i] = zc; TB[i] = fb(y) - zc; TF[i] = zc - ff(y); TNB[i] = fnb(y); TNF[i] = fnf(y); }
  }

  /* ------------------------------------------------------------- mapas (|x|, y)
     Grades de 0,5 cm sobre a metade direita do tronco vista por trás (…B) e pela frente (…F): H = relevo em cm somado
     ao loft; W = "brancura" (tendão / fáscia) da pintura. Carimbos: mancha (gaussiana), risco (ao longo de uma
     polilinha, com perfil gaussiano) e losango. */
  const MS = 0.5, MX = 54, MY0 = -30, MY = 186;
  const mapa = () => new Float32Array(MX * MY);
  const HB = mapa(), HF = mapa(), WB = mapa(), WF = mapa();
  const mancha = (M, x0, y0, sx, sy, amp, rot) => {
    const r = 3 * Math.max(sx, sy), c = Math.cos((rot || 0) * Math.PI / 180), s = Math.sin((rot || 0) * Math.PI / 180);
    const i0 = Math.max(0, Math.floor((x0 - r) / MS)), i1 = Math.min(MX - 1, Math.ceil((x0 + r) / MS)), j0 = Math.max(0, Math.floor((y0 - r - MY0) / MS)), j1 = Math.min(MY - 1, Math.ceil((y0 + r - MY0) / MS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){
      const dx = i * MS - x0, dy = MY0 + j * MS - y0, u = (dx * c + dy * s) / sx, v = (-dx * s + dy * c) / sy;
      M[i + j * MX] += amp * Math.exp(-u * u - v * v);
    }
  };
  /* pts = [[x, y, peso?], …]; o peso multiplica amp e é interpolado ao longo do risco */
  const risco = (M, pts, sig, amp) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts){ x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const r = 3 * sig, i0 = Math.max(0, Math.floor((x0 - r) / MS)), i1 = Math.min(MX - 1, Math.ceil((x1 + r) / MS)), j0 = Math.max(0, Math.floor((y0 - r - MY0) / MS)), j1 = Math.min(MY - 1, Math.ceil((y1 + r - MY0) / MS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){
      const x = i * MS, y = MY0 + j * MS; let best = 1e9, w = 1;
      for (let k = 0; k < pts.length - 1; k++){
        const a = pts[k], b = pts[k + 1], ex = b[0] - a[0], ey = b[1] - a[1];
        let h = ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey); h = h < 0 ? 0 : h > 1 ? 1 : h;
        const dx = x - a[0] - ex * h, dy = y - a[1] - ey * h, d = dx * dx + dy * dy;
        if (d < best){ best = d; w = (a[2] === undefined ? 1 : a[2]) + ((b[2] === undefined ? 1 : b[2]) - (a[2] === undefined ? 1 : a[2])) * h; }
      }
      M[i + j * MX] += amp * w * Math.exp(-best / (sig * sig));
    }
  };
  /* losango com centro (0, y0): meia-largura wx, meia-altura hb para baixo e ht para cima; borda macia */
  const losango = (M, y0, wx, hb, ht, amp) => {
    for (let j = 0; j < MY; j++){ const y = MY0 + j * MS; if (y < y0 - hb - 1 || y > y0 + ht + 1) continue;
      for (let i = 0; i < MX && i * MS < wx + 1; i++){ const q = i * MS / wx + (y < y0 ? (y0 - y) / hb : (y - y0) / ht); M[i + j * MX] += amp * sstep(1.0, 0.78, q); } }
  };
  const amostra = (M, ax, y) => {
    let fx = ax / MS, fy = (y - MY0) / MS; if (fx > MX - 1.001) fx = MX - 1.001; if (fy < 0) fy = 0; else if (fy > MY - 1.001) fy = MY - 1.001;
    const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, o = i + j * MX;
    return (M[o] * (1 - u) + M[o + 1] * u) * (1 - v) + (M[o + MX] * (1 - u) + M[o + MX + 1] * u) * v;
  };

  /* relevo das costas */
  risco(HB, [[0, -3, 0.6], [0, 3, 1.2], [0, 16, 1.1], [0, 30, 0.7], [0, 41, 0.45], [0, 45, 0.0]], 1.25, -0.55);      // sulco da coluna
  risco(HB, [[3.2, -3, 0.4], [3.4, 2, 1.0], [3.5, 10, 1.0], [3.3, 20, 0.7], [3.0, 32, 0.35]], 1.7, 0.62);            // eretores da espinha
  mancha(HB, 7.0, -10.5, 5.0, 6.6, 2.5);                                                                              // glúteo máximo
  risco(HB, [[0, -3, 0.2], [0, -8, 1.0], [0, -24, 1.3]], 1.0, -1.1);                                                  // sulco interglúteo
  mancha(HB, 11.0, -1.0, 3.8, 3.2, 0.5);                                                                              // glúteo médio
  mancha(HB, 3.9, 0.9, 0.95, 0.95, -0.32);                                                                            // covinha da espinha ilíaca póstero-superior
  risco(HB, [[4.2, 1.6], [9.0, 3.9], [13.6, 4.6]], 0.75, -0.26);                                                      // sulco da crista ilíaca
  mancha(HB, 11.3, 8.0, 2.4, 3.2, 0.32);                                                                              // oblíquo externo sobre a crista
  mancha(HB, 10.5, 21, 4.6, 8.5, 0.5);                                                                                // grande dorsal
  mancha(HB, 10.8, 34.5, 4.0, 5.6, 0.85);                                                                             // músculos sobre a escápula
  risco(HB, [[7.2, 29.5], [7.1, 41.5]], 0.8, -0.22);                                                                  // borda medial da escápula
  risco(HB, [[8.6, 40.2], [13, 41.2], [17, 42.3]], 0.8, 0.3);                                                         // espinha da escápula
  mancha(HB, 4.4, 41.5, 2.8, 3.2, 0.35);                                                                              // trapézio médio
  mancha(HB, 0, 46.4, 1.1, 1.1, 0.3);                                                                                 // vértebra proeminente (C7)
  risco(HB, [[2.0, 48], [2.4, 56]], 1.2, 0.45);                                                                       // nuca
  risco(HB, [[0, 48.5], [0, 57]], 0.8, -0.3);
  /* relevo da frente */
  mancha(HF, 6.4, 35.0, 4.6, 3.8, 0.85); mancha(HF, 10.2, 33.6, 4.2, 3.8, 0.85);                                                                               // peitoral maior
  risco(HF, [[2.5, 29.4], [8, 28.7], [13, 31.4]], 0.9, -0.4);                                                         // borda de baixo do peitoral
  risco(HF, [[0, 28], [0, 41]], 1.1, -0.45);                                                                          // sulco do esterno
  risco(HF, [[2.6, 42.3], [8, 42.6], [15.5, 43.1]], 0.75, 0.45);                                                      // clavícula
  mancha(HF, 0, 42.3, 1.2, 1.0, -0.5);                                                                                // incisura jugular
  risco(HF, [[3.4, -4], [3.6, 12], [3.8, 26]], 2.0, 0.6);                                                             // reto do abdome
  risco(HF, [[0, -6], [0, 27]], 0.8, -0.5);                                                                           // linha alba
  for (const y of [9.5, 15.5, 21.5]) risco(HF, [[0.8, y], [6.2, y + 0.3]], 0.6, -0.3);                                // interseções tendíneas
  risco(HF, [[7.2, -2], [7.5, 8, 1], [7.7, 13, 0]], 0.9, -0.3);                                                            // linha semilunar
  mancha(HF, 10.8, 8, 2.5, 6, 0.4);                                                                                   // oblíquo externo
  risco(HF, [[13, 1.5], [6, -7], [1.5, -11]], 0.9, -0.4);                                                             // ligamento inguinal
  mancha(HF, 12.8, 1.8, 1.0, 1.0, 0.3);                                                                               // espinha ilíaca ântero-superior
  /* brancura das costas */
  losango(WB, 2.5, 9.0, 8.0, 17, 0.3);                                                                                  // fáscia toracolombar
  losango(WB, 45.3, 3.0, 5.5, 6.5, 0.32);                                                                             // aponeurose do trapézio (C7)
  risco(WB, [[8.6, 40.2], [13, 41.2], [17.5, 42.6]], 0.8, 0.28);                                                       // espinha da escápula / acrômio
  /* brancura da frente */
  risco(WF, [[0, -12], [0, 28]], 0.7, 0.8);                                                                           // linha alba
  risco(WF, [[0, 28], [0, 41.5]], 1.6, 0.65);                                                                         // esterno
  mancha(WF, 0, -6, 6, 6, 0.45);                                                                                      // aponeurose do abdome
  risco(WF, [[13, 1.5], [6, -7], [1.5, -11]], 0.65, 0.8);                                                             // ligamento inguinal
  risco(WF, [[2.6, 42.3], [8, 42.6], [15.5, 43.1]], 0.7, 0.55);                                                       // clavícula
  for (const y of [9.5, 15.5, 21.5]) risco(WF, [[0.8, y], [6.2, y + 0.3]], 0.55, 0.5);
  mancha(WF, 12.8, 2.0, 1.1, 1.1, 0.7);

  /* ---------------------------------------------------------------- primitivas
     Lado direito (x ≥ 0). cone(a, b, ra, rb, k): cápsula de a até b com o raio indo de ra a rb. elip(c, r, k, rot?):
     elipsoide (rot = [rx, ry, rz] em graus). k = raio (cm) da concordância suave com o que veio antes; k negativo
     CAVA (subtrai) com concordância |k|. */
  const ST = 18, PR = [];
  const cone = (a, b, ra, rb, k) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    PR.push(0, Math.abs(k), k < 0 ? -1 : 1, a[0], a[1], a[2], dx, dy, dz, 1 / Math.max(1e-9, dx * dx + dy * dy + dz * dz), ra, rb - ra, 0, 0, 0, 0, 0, 0); };
  const _e = new THREE.Euler(), _m = new THREE.Matrix4();
  const elip = (c, r, k, rot) => {
    _m.identity(); if (rot) _m.makeRotationFromEuler(_e.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180, 'XYZ'));
    const e = _m.elements;
    PR.push(1, Math.abs(k), k < 0 ? -1 : 1, c[0], c[1], c[2],
      e[0] / r[0], e[1] / r[0], e[2] / r[0], e[4] / r[1], e[5] / r[1], e[6] / r[1], e[8] / r[2], e[9] / r[2], e[10] / r[2], 1 / r[0], 1 / r[1], 1 / r[2]); };

  /* cabeça (referencial do crânio: +x direita, +y para cima, +z posterior, origem no centro da calota) */
  const hs = sk.scale / 1.05, H = (x, y, z) => { const v = sk.local(x, y, z); return [v.x, v.y, v.z]; };
  elip(H(0, 0.3, 0.9), [8.0 * hs, 7.45 * hs, 9.9 * hs], 1.5);                                // calota (parietal / occipital)
  elip(H(0, 0.2, -3.4), [6.6 * hs, 6.9 * hs, 6.3 * hs], 1.5);                                // testa (mais estreita)
  elip(H(0, -4.8, -4.4), [5.6 * hs, 5.6 * hs, 5.5 * hs], 1.6);                               // face
  elip(H(4.6, -4.3, -1.8), [2.3 * hs, 2.0 * hs, 4.2 * hs], 1.0);                             // têmpora / arco zigomático
  elip(H(5.0, -5.0, 2.2), [1.75 * hs, 2.6 * hs, 2.2 * hs], 1.0);                             // atrás da orelha (mastoide)
  cone(H(4.75, -2.6, -6.1), H(5.3, -4.9, -4.8), 0.9 * hs, 0.9 * hs, 0.8);                    // maçã do rosto (zigomático)
  cone(H(0, -2.2, -9.3), H(0, -5.6, -11.0), 0.85 * hs, 1.0 * hs, 0.9);                       // nariz
  elip(H(0, -6.1, -10.0), [1.4 * hs, 1.0 * hs, 1.2 * hs], 0.8);
  elip(H(0, -8.6, -7.2), [3.1 * hs, 1.9 * hs, 2.4 * hs], 0.8);                               // arcadas dentárias
  elip(H(0, -8.2, -9.0), [2.0 * hs, 1.3 * hs, 1.1 * hs], 0.8);                               // lábios
  elip(H(5.0, -8.1, -2.2), [1.25 * hs, 4.0 * hs, 2.7 * hs], 0.9);                             // masseter sobre o ramo da mandíbula
  cone(H(4.65, -11.5, -1.9), H(2.75, -11.5, -5.0), 1.12 * hs, 1.0 * hs, 0.45);                 // corpo da mandíbula: borda de baixo …
  cone(H(2.75, -11.5, -5.0), H(1.45, -11.45, -7.15), 1.0 * hs, 1.0 * hs, 0.45);
  cone(H(1.45, -11.45, -7.15), H(0, -11.4, -7.65), 1.0 * hs, 1.0 * hs, 0.45);
  cone(H(4.55, -10.3, -2.1), H(2.6, -10.3, -4.8), 1.0 * hs, 1.0 * hs, 0.45);                  // … e arcada
  cone(H(2.6, -10.3, -4.8), H(1.6, -10.3, -7.1), 1.0 * hs, 1.0 * hs, 0.45);
  cone(H(1.6, -10.3, -7.1), H(0, -10.3, -7.9), 1.0 * hs, 1.0 * hs, 0.45);
  elip(H(0, -11.0, -8.1), [1.6 * hs, 1.55 * hs, 1.05 * hs], 0.8);                            // mento
  elip(H(0, -11.05, -4.6), [3.4 * hs, 1.4 * hs, 3.6 * hs], 0.5);                             // assoalho da boca
  /* pescoço */
  cone([5.5, 58.4, 1.0], [1.9, 43.6, -5.4], 0.95, 0.9, 1.0);                                 // esternocleidomastóideo
  elip([0, 50.6, -6.6], [1.5, 2.3, 1.4], 1.0);                                               // laringe
  /* ombro e braço */
  elip([13.6, 30.8, 4.4], [4.8, 2.4, 2.5], 2.5, [0, 0, 42]);                                 // prega axilar posterior (grande dorsal + redondo maior)
  cone([15.4, 43.1, -1.6], [17.95, 42.9, -1.65], 1.0, 0.95, 1.4);                            // pele rente à articulação acromioclavicular
  cone([17.95, 42.9, -1.65], [17.2, 41.3, 2.8], 0.95, 1.3, 1.4);                             // … e ao acrômio
  cone([17.7, 36, 2.4], [18.9, 16.5, 3.0], 3.2, 2.5, 1.6);                                   // tríceps: cabeça longa
  cone([20.2, 30, 1.8], [20.3, 17.5, 2.6], 2.6, 2.2, 0.8);                                   // tríceps: cabeça lateral
  cone([18.4, 35, -2.6], [19.3, 13, -1.6], 3.2, 2.8, 1.6);                                   // bíceps
  cone([19.3, 15, 0.8], [19.9, 7.5, 1.0], 3.2, 2.7, 1.2);                                    // cotovelo
  cone([18.7, 11.5, -0.4], [18.9, 8, -0.2], 2.0, 2.0, 1.2);                                  // epicôndilo medial
  elip([21.5, 7.3, 2.5], [1.3, 1.6, 1.3], 0.8);                                              // olécrano
  elip([18.0, 34.6, -0.5], [5.3, 8.0, 5.6], 0.7);                                            // deltoide (por cima do braço, com vinco na borda)
  cone([19.4, 33, 0], [19.7, 25.5, 0.6], 3.4, 2.1, 0.7);                                     // inserção do deltoide
  /* antebraço em pronação (largo de lado a lado, fino de frente para trás): massa radial (de fora) e ulnar (de dentro) */
  cone([21.2, 13, 0.3], [21.7, 5.5, -1.0], 1.6, 2.2, 1.5);
  cone([21.7, 5.5, -1.0], [22.5, -1, -4.2], 2.2, 2.2, 1.0);
  cone([22.5, -1, -4.2], [22.2, -9, -8.2], 2.2, 1.7, 1.0);
  cone([22.2, -9, -8.2], [21.4, -16, -12.4], 1.7, 1.5, 1.0);
  cone([19.6, 7.5, 0.4], [19.7, 2, -1.8], 2.2, 2.2, 1.2);
  cone([19.7, 2, -1.8], [19.4, -5, -6.0], 2.2, 2.0, 1.0);
  cone([19.4, -5, -6.0], [19.3, -16, -12.6], 2.0, 1.5, 1.0);

  /* ------------------------------------------------------------------- caixas
     Grade grossa (4 cm) com a lista de primitivas que alcançam cada célula: a SDF só avalia as vizinhas. */
  const NP = PR.length / ST, BS = 4, BX = 8, BY0 = -32, BYN = 30, BZ0 = -20, BZN = 10, bins = [];
  { const tmp = []; for (let i = 0; i < BX * BYN * BZN; i++) tmp.push([]);
    for (let p = 0; p < NP; p++){
      const o = p * ST, k = PR[o + 1] + 3.2; let x0, x1, y0, y1, z0, z1;
      if (PR[o] === 0){ const r = Math.max(PR[o + 10], PR[o + 10] + PR[o + 11]) + k;
        x0 = Math.min(PR[o + 3], PR[o + 3] + PR[o + 6]) - r; x1 = Math.max(PR[o + 3], PR[o + 3] + PR[o + 6]) + r;
        y0 = Math.min(PR[o + 4], PR[o + 4] + PR[o + 7]) - r; y1 = Math.max(PR[o + 4], PR[o + 4] + PR[o + 7]) + r;
        z0 = Math.min(PR[o + 5], PR[o + 5] + PR[o + 8]) - r; z1 = Math.max(PR[o + 5], PR[o + 5] + PR[o + 8]) + r;
      } else { const r = Math.max(1 / PR[o + 15], 1 / PR[o + 16], 1 / PR[o + 17]) + k;
        x0 = PR[o + 3] - r; x1 = PR[o + 3] + r; y0 = PR[o + 4] - r; y1 = PR[o + 4] + r; z0 = PR[o + 5] - r; z1 = PR[o + 5] + r; }
      const i0 = Math.max(0, Math.floor(x0 / BS)), i1 = Math.min(BX - 1, Math.floor(x1 / BS));
      const j0 = Math.max(0, Math.floor((y0 - BY0) / BS)), j1 = Math.min(BYN - 1, Math.floor((y1 - BY0) / BS));
      const k0 = Math.max(0, Math.floor((z0 - BZ0) / BS)), k1 = Math.min(BZN - 1, Math.floor((z1 - BZ0) / BS));
      for (let kk = k0; kk <= k1; kk++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) tmp[i + BX * (j + BYN * kk)].push(o);
    }
    for (const l of tmp) bins.push(Int32Array.from(l)); }
  const P = Float64Array.from(PR), IBS = 1 / BS;

  /* --------------------------------------------------------------------- SDF */
  /* tronco: distância aproximada (1ª ordem, com o gradiente em y da tabela) à superfície do loft, com o relevo */
  const loft = (ax, y, z) => {
    const cap = y - LY1; if (cap > 0) return cap + 0.5;              // acima da última seção (dentro da cabeça) o loft acaba
    let t = (y - LY0) / LSTEP; if (t < 0) t = 0; else if (t > LN - 1.001) t = LN - 1.001;
    const i = t | 0, fr = t - i;
    const a = TA[i] + (TA[i + 1] - TA[i]) * fr, zc = TC[i] + (TC[i + 1] - TC[i]) * fr;
    const dzc = z - zc, back = dzc >= 0, bb = back ? TB[i] + (TB[i + 1] - TB[i]) * fr : TF[i] + (TF[i + 1] - TF[i]) * fr, n = back ? TNB[i] + (TNB[i + 1] - TNB[i]) * fr : TNF[i] + (TNF[i + 1] - TNF[i]) * fr;
    const da = (TA[i + 1] - TA[i]) / LSTEP, dc = (TC[i + 1] - TC[i]) / LSTEP, db = (back ? TB[i + 1] - TB[i] : TF[i + 1] - TF[i]) / LSTEP;
    const u = ax / a, w = (back ? dzc : -dzc) / bb;
    /* longe da superfície só importam o sinal e a ordem de grandeza: sem potências nem mapas */
    if (u * u + w * w < 0.3) return cap > -4 ? cap : -4;
    if (ax - a > 4) return ax - a;
    if ((w - 1) * bb > 4) return (w - 1) * bb;
    const un = Math.pow(u, n), wn = Math.pow(w, n), s = un + wn;
    let d;
    if (s < 1e-9) d = -(a < bb ? a : bb);
    else {
      const k = Math.pow(s, 1 / n), gu = u > 1e-6 ? un * k / (u * s * a) : 0, gw = w > 1e-6 ? wn * k / (w * s * bb) : 0;
      const gy = -gu * u * da - gw * ((back ? dc : -dc) + w * db);
      let g = Math.sqrt(gu * gu + gw * gw + gy * gy); const gmin = 1 / (a > bb ? a : bb); if (g < gmin) g = gmin;
      d = (k - 1) / g;
    }
    /* relevo: mapa das costas atrás da linha mais larga, mapa da frente adiante dela, misturados no flanco */
    let q = 0.5 + 1.7 * dzc / bb; q = q < 0 ? 0 : q > 1 ? 1 : q; q = q * q * (3 - 2 * q);
    let fx = ax / MS, fy = (y - MY0) / MS; if (fx > MX - 1.001) fx = MX - 1.001; if (fy < 0) fy = 0; else if (fy > MY - 1.001) fy = MY - 1.001;
    const mi = fx | 0, mj = fy | 0, mu = fx - mi, mv = fy - mj, o = mi + mj * MX;
    const hb = (HB[o] * (1 - mu) + HB[o + 1] * mu) * (1 - mv) + (HB[o + MX] * (1 - mu) + HB[o + MX + 1] * mu) * mv;
    const hf = (HF[o] * (1 - mu) + HF[o + 1] * mu) * (1 - mv) + (HF[o + MX] * (1 - mu) + HF[o + MX + 1] * mu) * mv;
    d -= hb * q + hf * (1 - q);
    return cap > d ? cap : d;
  };
  const dist = (x, y, z) => {
    const ax = x < 0 ? -x : x;
    let d = loft(ax, y, z);
    let bi = (ax * IBS) | 0; if (bi > BX - 1) bi = BX - 1;
    let bj = ((y - BY0) * IBS) | 0; if (bj < 0) bj = 0; else if (bj > BYN - 1) bj = BYN - 1;
    let bk = ((z - BZ0) * IBS) | 0; if (bk < 0) bk = 0; else if (bk > BZN - 1) bk = BZN - 1;
    const L = bins[bi + BX * (bj + BYN * bk)];
    for (let q = 0; q < L.length; q++){
      const o = L[q]; let e;
      const px = ax - P[o + 3], py = y - P[o + 4], pz = z - P[o + 5];
      if (P[o] === 0){
        const bx = P[o + 6], by = P[o + 7], bz = P[o + 8];
        let h = (px * bx + py * by + pz * bz) * P[o + 9]; h = h < 0 ? 0 : h > 1 ? 1 : h;
        const qx = px - bx * h, qy = py - by * h, qz = pz - bz * h;
        e = Math.sqrt(qx * qx + qy * qy + qz * qz) - (P[o + 10] + P[o + 11] * h);
      } else {
        const qx = px * P[o + 6] + py * P[o + 7] + pz * P[o + 8], qy = px * P[o + 9] + py * P[o + 10] + pz * P[o + 11], qz = px * P[o + 12] + py * P[o + 13] + pz * P[o + 14];
        const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz), rx = qx * P[o + 15], ry = qy * P[o + 16], rz = qz * P[o + 17], k1 = Math.sqrt(rx * rx + ry * ry + rz * rz);
        e = k1 < 1e-9 ? -1 / P[o + 15] : k0 * (k0 - 1) / k1;
      }
      const k = P[o + 1];
      if (P[o + 2] > 0){ const h = k - (d > e ? d - e : e - d); d = (d < e ? d : e) - (h > 0 ? h * h * 0.25 / k : 0); }
      else { e = -e; const h = k - (d > e ? d - e : e - d); d = (d > e ? d : e) + (h > 0 ? h * h * 0.25 / k : 0); }
    }
    return d;
  };

  /* -------------------------------------------------------------------- malha */
  /* O corpo é simétrico e a grade também: numa linha da grade (y e z fixos, x crescendo) os valores de x < 0 ficam
     numa pilha e são devolvidos para x > 0 (dist é par em x: um acerto "por acaso" também está certo). */
  const pX = new Float64Array(128), pD = new Float64Array(128); let pn = 0, pY = NaN, pZ = NaN;
  const distGrade = (x, y, z) => {
    if (y !== pY || z !== pZ){ pY = y; pZ = z; pn = 0; }
    if (x < -1e-9){ const d = dist(x, y, z); if (pn < 128){ pX[pn] = x; pD[pn++] = d; } return d; }
    if (pn > 0 && Math.abs(pX[pn - 1] + x) < 1e-7) return pD[--pn];
    return dist(x, y, z);
  };
  const cell = 1.0 / quality, XM = Math.ceil(25.6 / cell) * cell;
  const geom = EV.mesh.fromSDF(distGrade, {min: [-XM, -28, -16.6], max: [XM, 76, 11.8], cell, exact: true});

  /* ------------------------------------------------------------------ pintura
     Por vértice: aTinta = (luz da oclusão 0..1, brancura 0..1, força das fibras 0..1) e aFibra = coordenada escalar s
     cujas curvas de nível são as fibras do músculo daquela região (o shader desenha estrias finas em s). */
  const nv = geom.attributes.position.count, pos = geom.attributes.position.array, nor = geom.attributes.normal.array;
  const tinta = new Float32Array(nv * 3), fibra = new Float32Array(nv), reg = new Uint8Array(nv), segue = new Float32Array(nv * 4);
  /* brancuras em 3D (elipsoides): [centro, raios, valor] */
  const BR = [
    [[21.2, -10, -9], [4.0, 7.5, 4.5], 0.45],                          // tendões do dorso do antebraço
    [[15.2, -3, -3], [3.5, 7.5, 5.0], 0.55],                           // aponeurose glútea / fáscia lata
    [H(0, 5.6, 0.5), [6.5, 3.6, 8.0], 0.3]                             // gálea aponeurótica
  ];
  const DQ = [19.8, 26, 0.6], DA = new THREE.Vector3(9.5 - DQ[0], 46 - DQ[1], 0 - DQ[2]).normalize();
  const DE1 = new THREE.Vector3(0, 0, 1).addScaledVector(DA, -DA.z).normalize(), DE2 = new THREE.Vector3().crossVectors(DA, DE1);
  for (let v = 0; v < nv; v++){
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ax = Math.abs(x), nx = nor[v * 3], ny = nor[v * 3 + 1], nz = nor[v * 3 + 2];
    /* oclusão de ambiente: quanto a SDF cresce menos que o esperado ao longo da normal (sulcos, axilas) */
    const f0 = dist(x, y, z), o1 = (0.9 - (dist(x + nx * 0.9, y + ny * 0.9, z + nz * 0.9) - f0)) / 0.9, o2 = (2.6 - (dist(x + nx * 2.6, y + ny * 2.6, z + nz * 2.6) - f0)) / 2.6;
    const luzOc = 1 - Math.min(1, 0.55 * EV.clamp(o1, 0, 1) + 0.45 * EV.clamp(o2, 0, 1));
    const noLoft = loft(ax, y, z) < 0.45;                              // a superfície ali é a do tronco (não a de um braço)
    let w = 0, s = 0, f = 1, r = 0;
    if (y > 57.5 && noLoft === false || y > 60.5){ r = 1; f = 0; }                                                        // cabeça
    else if (!noLoft && ax > 13 && y < 44.5){                                                                             // braço
      if (y > 27 + 0.9 * Math.max(0, 21 - ax)){ r = 2; const vx = ax - DQ[0], vy = y - DQ[1], vz = z - DQ[2]; s = 6.5 * Math.atan2(vx * DE1.x + vy * DE1.y + vz * DE1.z, vx * DE2.x + vy * DE2.y + vz * DE2.z); }                        //   deltoide (fibras descem para a inserção)
      else if (y > 9.5){ r = 3; s = 4.2 * Math.atan2(z - 1, ax - 19.2); }                                                 //   braço
      else { r = 4; s = 3.4 * Math.atan2((y - 7.5) * -0.495 + (z - 1) * 0.869, ax - 20.6); f = 0.85; }                    //   antebraço
    }
    else if (y > 47){ r = 5; s = nz > 0 ? 0.89 * ax + 0.45 * y : 0.92 * ax - 0.3 * z; f = 0.8; }                          // pescoço
    else if (nz > 0.3){                                                                                                   // costas
      w = amostra(WB, ax, y);
      if (y < 2.5 + 0.12 * ax){ r = 6; s = 0.64 * ax + 0.77 * y; }                                                        //   glúteo máximo (fibras descem para fora)
      else if (y > 41.5){ r = 7; s = 16 * Math.atan2(y - 39, ax - 32); }                                              //   trapézio superior
      else if (y > 18 + 2.2 * ax){ r = 8; s = 12 * Math.atan2(y - 40.3, ax - 8.7); }                                      //   trapézio inferior e médio
      else if (ax > 8.2 && y > 27.5){ r = 9; s = 9 * Math.atan2(y - 38.5, ax - 17.5); }                                   //   infraespinal / redondos
      else { r = 10; s = 18 * Math.atan2(y - 37, ax - 15.5); }                                                            //   grande dorsal (leque para a axila)
    }
    else if (nz < -0.3){                                                                                                  // frente
      w = amostra(WF, ax, y);
      if (y > 27.5){ r = 11; s = 10 * Math.atan2(y - 36.5, ax - 17.5); }                                                  //   peitoral maior
      else if (ax < 7.4 || y < -11){ r = 12; s = ax; f = 0.8; }                                                           //   reto do abdome / coxa
      else { r = 13; s = 0.8 * ax - 0.6 * y; }                                                                            //   oblíquo externo
    }
    else { r = 14; s = y > 2 ? 0.7 * y - 0.7 * z : z; f = 0.8; }                                                          // flanco: serrátil e oblíquos; quadril
    for (const b of BR){ const qx = (ax - b[0][0]) / b[1][0], qy = (y - b[0][1]) / b[1][1], qz = (z - b[0][2]) / b[1][2], k = qx * qx + qy * qy + qz * qz; if (k < 1){ const c = b[2] * sstep(1.0, 0.55, k); if (c > w) w = c; } }
    if (w > 1) w = 1;
    /* quanto o ponto acompanha o ombro (ver update): x = vetor inteiro, y = só a subida, z = glenoide (0) ↔ acrômio (1); w = respiração */
    if (r >= 2 && r <= 4){ segue[v * 4] = 1; segue[v * 4 + 2] = sstep(36, 42, y); }
    else if (r !== 1){
      const lat = sstep(11.5, 16.5, ax) * sstep(30, 39, y) * (1 - sstep(46, 50, y));
      const wx = EV.lerp(sstep(2.5, 16, ax), sstep(4, 9, ax), sstep(-0.4, 0.4, nz));
      segue[v * 4] = lat; segue[v * 4 + 1] = (1 - lat) * wx * sstep(24, 34, y) * (1 - sstep(47.5, 53, y)); segue[v * 4 + 2] = 1;
      segue[v * 4 + 3] = sstep(7, 17, y) * (1 - sstep(39, 45, y));
    }
    tinta[v * 3] = luzOc; tinta[v * 3 + 1] = w; tinta[v * 3 + 2] = f * (1 - 0.75 * w); fibra[v] = s; reg[v] = r;
  }
  /* na divisa entre duas regiões a coordenada das fibras salta: ali as estrias somem */
  { const idx = geom.index.array;
    for (let t = 0; t < idx.length; t += 3){ const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (reg[a] !== reg[b] || reg[b] !== reg[c]){ tinta[a * 3 + 2] = tinta[b * 3 + 2] = tinta[c * 3 + 2] = 0; } } }
  geom.deleteAttribute('color');
  geom.setAttribute('aTinta', new THREE.BufferAttribute(tinta, 3));
  geom.setAttribute('aFibra', new THREE.BufferAttribute(fibra, 1));
  geom.setAttribute('aSegue', new THREE.BufferAttribute(segue, 4));

  /* --------------------------------------------------------------- riscos nítidos
     Tendões e ligamentos finos demais para a pintura por vértice: polilinhas 3D (lado direito) coladas à pele, com
     um raio em cada ponto. O shader mede, no plano tangente à pele, a distância do pixel a cada trecho e clareia. */
  const RISCOS = [   // [pontos [x, y, z, raio], força]: força > 0 clareia (tendão), < 0 escurece (sulco entre músculos)
    [[[3.6, -2.6, 7.0, 0.45], [4.8, 0.6, 6.9, 0.5], [8.5, 2.6, 6.0, 0.6], [11.5, 4.0, 3.8, 0.62], [13.3, 4.0, 0.5, 0.62], [13.9, 3.0, -3, 0.55], [13.2, 1.6, -7.5, 0.4]], 1.0],   // crista ilíaca
    [[[13.2, 1.6, -7.5, 0.4], [7, -6.5, -11.5, 0.4], [1.5, -11, -11.5, 0.4]], 0.8],                                 // ligamento inguinal
    /* o braço pende um pouco rodado para dentro: o olécrano e o tendão do tríceps olham para trás e para fora */
    [[[20.8, 21.5, 4.2, 0.6], [21.05, 17, 4.0, 1.55], [21.3, 12.5, 3.6, 1.7], [21.55, 9.0, 3.1, 1.3], [21.75, 6.6, 2.7, 0.85]], 0.66],   // tendão do tríceps → olécrano
    [[[23.0, 12.5, 0.6, 0.7], [23.1, 8.4, 0.0, 0.9]], 0.5],                                                         // epicôndilo lateral
    [[[23.0, 8.0, -0.4, 0.3], [22.8, -3, -4.6, 0.32], [22.4, -14, -10.4, 0.3]], 0.7],                               // tendões e septos dos extensores
    [[[22.4, 7.4, 1.4, 0.3], [21.5, -3, -3.6, 0.32], [21.0, -14, -10.0, 0.3]], 0.7],
    [[[21.6, 6.2, 2.4, 0.3], [20.2, -4, -3.4, 0.32], [19.6, -14, -10.4, 0.3]], 0.7],
    [[[22.8, -13.2, -10.2, 0.5], [19.2, -13.4, -10.4, 0.5]], 0.7],                                                  // retináculo dos extensores
    [[[17.0, 41.0, 3.6, 0.7], [17.5, 36, 5.2, 0.8], [19.2, 30, 4.6, 0.8], [20.3, 26.2, 2.2, 0.7]], -0.8],           // borda posterior do deltoide
    [[[15.6, 42.4, -4.6, 0.7], [17.4, 36, -5.8, 0.8], [19.5, 29.5, -3.8, 0.8], [20.3, 26.2, -0.8, 0.7]], -0.8],     // borda anterior do deltoide
    [[[19.2, 29.5, 5.2, 0.6], [20.0, 21.5, 5.0, 0.6]], -0.6],                                                     // entre as cabeças do tríceps
    [[[4.6, -1.2, 7.2, 0.7], [10, -3.8, 7.6, 0.8], [15.4, -9, 2.2, 0.8]], -0.6],                                    // borda de cima do glúteo máximo
    [[[13.2, 14, -0.5, 1.2], [12.4, 9, 1.5, 1.4], [11.5, 5.2, 3.0, 1.2]], -0.55]                                    // dobra do flanco (borda do oblíquo externo)
  ];
  const segA = [], segB = [], segF = [];
  { const cola = p => {                                              // desce pelo gradiente da SDF até a pele
      for (let it = 0; it < 3; it++){ const d = dist(p[0], p[1], p[2]), h = 0.3;
        const gx = dist(p[0] + h, p[1], p[2]) - dist(p[0] - h, p[1], p[2]), gy = dist(p[0], p[1] + h, p[2]) - dist(p[0], p[1] - h, p[2]), gz = dist(p[0], p[1], p[2] + h) - dist(p[0], p[1], p[2] - h);
        const il = 1 / (Math.hypot(gx, gy, gz) || 1); p[0] -= d * gx * il; p[1] -= d * gy * il; p[2] -= d * gz * il; }
      return p; };
    for (const [pts, forca] of RISCOS){ const q = pts.map(p => cola(p.slice(0, 3)));
      for (let i = 0; i + 1 < pts.length; i++){
        segA.push(new THREE.Vector4(q[i][0], q[i][1], q[i][2], pts[i][3])); segB.push(new THREE.Vector4(q[i + 1][0], q[i + 1][1], q[i + 1][2], pts[i + 1][3])); segF.push(forca); } } }
  /* aparelhos com poucos uniformes no fragmento ficam sem os riscos (o resto da pintura não depende deles) */
  const caps = (typeof window !== 'undefined' && window.EVAPP && window.EVAPP.three && window.EVAPP.three.renderer) ? window.EVAPP.three.renderer.capabilities : null;
  const NR = (caps && caps.maxFragmentUniforms < 3 * segA.length + 24) ? 0 : segA.length;

  /* ----------------------------------------------------------------- material
     Próprio da peça (não usa EV.mats.ghost). O corpo é desenhado ANTES de tudo e numa fatia do fundo do buffer de
     profundidade (z' = w − 0,01·(w − z)): assim ele fica atrás de ossos e músculos, mas se oculta a si mesmo — um
     pré-passo só de profundidade e depois a cor com teste ≤, de modo que cada pixel recebe UMA camada (o braço na
     frente do tronco não soma duas tintas). Saída já em sRGB "de tela" e alfa pré-multiplicado. */
  const VERT = `
    attribute vec3 aTinta; attribute float aFibra; attribute vec4 aSegue;
    uniform vec3 uGl; uniform vec3 uAc; uniform float uResp;
    varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vT; varying vec3 vNo; varying vec2 vS;
    void main(){
      /* os ombros e os braços acompanham a escápula (glenoide / acrômio); o tórax enche um pouco na inspiração */
      vec3 d = aSegue.x * mix(uGl, uAc, aSegue.z) + vec3(0.0, aSegue.y * uAc.y, 0.0);
      d.x *= sign(position.x);
      vec3 p = position + d + normal * (uResp * aSegue.w);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vV = mv.xyz; vN = normalMatrix * normal; vNo = normal; vP = position; vT = aTinta; vS = vec2(aFibra, aSegue.x);
      gl_Position = projectionMatrix * mv;
      gl_Position.z = mix(gl_Position.z, gl_Position.w, 0.99);
    }`;
  const FRAG = `
    varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vT; varying vec3 vNo; varying vec2 vS;
    uniform vec3 uMus; uniform vec3 uTen; uniform vec4 uLuz; uniform vec3 uAlfa; uniform vec3 uFib;
    #if NR > 0
    uniform vec4 uRa[NR]; uniform vec4 uRb[NR]; uniform float uRf[NR];
    #endif
    float ruido(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main(){
      /* some aos poucos: coxas (alfa) e punhos (pontilhado nos dois passos, para não tapar o quadril que fica atrás) */
      float ax = abs(vP.x);
      float braco = step(0.5, vS.y) * step(vP.y, 4.0);                 // vS.y = 1 nos braços
      if (braco > 0.5 && ruido(gl_FragCoord.xy) > smoothstep(-15.5, -7.0, vP.y)) discard;
      float some = mix(smoothstep(-27.0, -14.0, vP.y), 1.0, braco);
      vec3 n = normalize(vN), v = normalize(-vV);
      float nv = clamp(dot(n, v), 0.0, 1.0), borda = 1.0 - nv;
      /* luz de estúdio no espaço da câmera: principal de cima e da esquerda, preenchimento da direita */
      float l1 = dot(n, normalize(vec3(-0.38, 0.64, 0.67))) * 0.5 + 0.5;
      float l2 = dot(n, normalize(vec3(0.75, 0.05, 0.55))) * 0.5 + 0.5;
      float luz = uLuz.x + uLuz.y * l1 * l1 + uLuz.z * l2;
      /* estrias das fibras: finas ao longo de s, quebradas devagar ao longo do corpo */
      float lon = vP.y * 0.21 + vP.z * 0.13 + ax * 0.07;
      float est = vn(vec2(vS.x * uFib.x, lon)) * 0.6 + vn(vec2(vS.x * uFib.x * 2.3 + 7.0, lon * 1.7 + 3.0)) * 0.4 - 0.5;
      float branco = vT.y, sulco = 0.0;
      #if NR > 0
      vec3 pm = vec3(ax, vP.y, vP.z), nm = normalize(vec3(vNo.x * sign(vP.x), vNo.y, vNo.z));
      for (int i = 0; i < NR; i++){
        vec3 ab = uRb[i].xyz - uRa[i].xyz, ap = pm - uRa[i].xyz;
        float h = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0), r = mix(uRa[i].w, uRb[i].w, h);
        vec3 q = ap - ab * h;
        float dn = dot(q, nm), d = sqrt(max(dot(q, q) - dn * dn, 0.0));       // distância no plano tangente (a corda passa por dentro do corpo)
        float perto = 1.0 - smoothstep(0.9, 1.6, abs(dn));
        if (uRf[i] > 0.0) branco = max(branco, uRf[i] * perto * (1.0 - smoothstep(r - 0.2, r, d)));
        else sulco = max(sulco, -uRf[i] * perto * (1.0 - smoothstep(0.0, r, d)));                 // sulco: sombra macia, sem contorno
      }
      #endif
      /* sulcos e reentrâncias: um pouco mais escuros e, sobretudo, mais tinta (sombra quente, não cinza) */
      float sombra = max(sulco, (1.0 - vT.x) * uFib.z);
      vec3 cor = mix(uMus, uTen, branco) * luz * (1.0 - 0.10 * sombra);
      cor *= 1.0 + uFib.y * est * vT.z;
      cor *= 1.0 - uLuz.w * borda * borda;
      float a = (uAlfa.x + (uAlfa.y - uAlfa.x) * pow(borda, uAlfa.z)) * (1.0 + 0.4 * sombra) * some;
      gl_FragColor = vec4(cor * a, a);
    }`;
  const cor = hex => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };   // sRGB de tela, sem conversão
  const uniforms = {
    uMus: {value: cor(0xb78d74)}, uTen: {value: cor(0xd9d6c4)},
    uLuz: {value: new THREE.Vector4(0.71, 0.54, 0.04, 0.0)},         // ambiente, principal, preenchimento, escurecimento na borda
    uAlfa: {value: new THREE.Vector3(0.30, 0.37, 2.5)},              // alfa no miolo, na borda, expoente
    uFib: {value: new THREE.Vector3(3.0, 0.16, 0.9)},                // estrias por cm, contraste das estrias, peso da oclusão
    uGl: {value: new THREE.Vector3()}, uAc: {value: new THREE.Vector3()}, uResp: {value: 0}   // ver update
  };
  if (NR > 0){ uniforms.uRa = {value: segA}; uniforms.uRb = {value: segB}; uniforms.uRf = {value: segF}; }
  const base = {vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: {NR}, toneMapped: false, fog: false, lights: false, transparent: false, side: THREE.FrontSide};
  const matZ = new THREE.ShaderMaterial(Object.assign({}, base, {colorWrite: false, depthWrite: true, depthTest: true}));
  const matC = new THREE.ShaderMaterial(Object.assign({}, base, {depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor}));
  matC.userData.ghost = true;                                          // o app: renderOrder −10, sem sombra
  const pre = new THREE.Mesh(geom, matZ); pre.renderOrder = -11; pre.castShadow = pre.receiveShadow = false;
  const malha = new THREE.Mesh(geom, matC); malha.renderOrder = -10; malha.castShadow = malha.receiveShadow = false;
  const group = new THREE.Group(); group.add(pre, malha);
  /* O corpo não se deforma de verdade: só os ombros e os braços são levados (no shader de vértice) pelo deslocamento
     da glenoide e da articulação acromioclavicular, e o tórax enche até 0,45 cm. Sem alocação: só uniformes. */
  const L = EV.scap.L, gl0 = EV.scap.toWorld(L.glenoid, 1, EV.REST), ac0 = EV.scap.toWorld(L.ac || L.acromionTip, 1, EV.REST), _t = new THREE.Vector3();
  const update = state => {
    uniforms.uGl.value.copy(EV.scap.toWorld(L.glenoid, 1, state, _t)).sub(gl0);
    uniforms.uAc.value.copy(EV.scap.toWorld(L.ac || L.acromionTip, 1, state, _t)).sub(ac0);
    uniforms.uResp.value = 0.45 * EV.clamp(state.breath || 0, 0, 1);
  };
  return {group, update, dist};                                       // dist(x, y, z): SDF do corpo em repouso (extra, para testes)
});
})();
