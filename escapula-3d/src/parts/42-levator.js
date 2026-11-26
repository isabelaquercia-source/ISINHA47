/* Peça `levator` — elevador da escápula (marcador 1), dos dois lados.

   QUATRO cordões roliços por lado, um de cada processo transverso (C1, C2, C3, C4), que descem colados ao lado do
   pescoço, viram para fora na base dele ("cotovelo") e se achatam num leque tendíneo claro que abraça o ângulo
   superior da escápula (alto da borda medial, logo acima do romboide menor, e começo da borda superior).

   Como é montado
   - LINHA CENTRAL do feixe (lado direito): em cima, uma Catmull-Rom fixa presa aos processos transversos (a coluna
     não se mexe); de C4 para baixo, uma Bézier cúbica que sai descendo rente ao pescoço e chega à escápula quase na
     horizontal, vindo de dentro. As medidas vêm da referência: o feixe direito e o esquerdo dela são a mesma curva
     vista de dois ângulos, e as duas vistas foram trianguladas.
   - Cada cordão k (0 = C1 … 3 = C4) fica em `linha central + (k − meio) · U`. U é o vetor que atravessa a faixa e
     gira ao longo do caminho: no alto do pescoço aponta para a frente (os cordões de C2–C4 nascem no seu processo
     transverso e ficam por baixo do de C1, o mais comprido e superficial); descendo, a faixa torce e os quatro se
     abrem lado a lado; na inserção U acompanha a borda do osso (C1 mais embaixo … C4 na borda superior).
   - Seção: tendão fino na origem, ventre redondo, fita larga e fina na inserção (as fitas se sobrepõem como telhas).
     Textura própria (canvas, cores de EV.pal): fibras ao longo do cordão, com as duas pontas clareando em tendão por
     uma transição desfiada. A cor de vértice escurece os sulcos entre cordões vizinhos e a face de dentro.
   - Obstáculos: as costelas 1–2 (EV.thorax) e a borda de cima do romboide menor; o afastamento é alisado ao longo
     do cordão, para não criar degraus.
   - `update(state)`: só a Bézier de baixo muda (acompanha a escápula). A elevação encurta e engrossa o ventre; a
     depressão e a rotação para cima esticam e afinam. O lado esquerdo é o direito espelhado em X (calcula-se um
     lado só). Nada é alocado: position/normal dos oito tubos são reescritos no lugar (função `malhas`). */
(() => {
EV.register('levator', ({THREE, EV, quality}) => {
  const {clamp, lerp, smoothstep} = EV;
  const V3 = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0);
  const group = new THREE.Group();
  const NC = 4, NIVEIS = ['C1', 'C2', 'C3', 'C4'];
  const SEG = Math.max(24, Math.round(60 * quality)), RAD = Math.max(7, Math.round(14 * quality)), CAP = 2;   // estações por cordão, lados do anel
  const tp = n => EV.spine.v(n).tpTip(1);                              // cópia nova a cada chamada

  /* ------------------------------------------------------------ dados fixos (lado direito, cm) */
  /* origens: tubérculo posterior de cada processo transverso (um pouco para dentro do osso) */
  const ORIG = NIVEIS.map((n, k) => tp(n).add(k ? V3(-0.22, -0.1, 0.22) : V3(-0.3, -0.15, 0.1)));
  /* guia do pescoço: por onde o feixe passa em cada nível, em relação à ponta do processo transverso */
  const PU = [null, ORIG[0], tp('C2').add(V3(1.21, 0, 0.47)), tp('C3').add(V3(0.84, 0, 1.08)), tp('C4').add(V3(0.65, 0, 1.48)), tp('C5').add(V3(0.60, 0, 1.60))];
  PU[0] = PU[1].clone().multiplyScalar(2).sub(PU[2]);                  // ponto fantasma antes da origem
  const A = PU[4];                                                     // onde a parte fixa termina e a Bézier começa (nível de C4)
  const DIR1 = V3(0.065, -0.966, 0.250);                               // direção de saída da Bézier (descendo rente ao pescoço)
  PU[5] = PU[3].clone().addScaledVector(DIR1, 3.5);                    // a Catmull-Rom chega em A já nessa direção
  const SA = 0.33;                                                     // fração da linha central ocupada pela parte fixa
  /* através da faixa (do cordão de C1 para o de C4): no alto do pescoço os cordões de C2–C4 ficam POR BAIXO (à
     frente) do de C1, empilhados em profundidade; descendo, a faixa gira e eles se abrem lado a lado, para fora */
  const UT = V3(-0.25, 0, -0.97), U0 = V3(0.766, 0, -0.643);
  const ESP0 = 0.62, ESP1 = 0.68;                                      // distância entre cordões vizinhos (pescoço alto → baixo)
  /* inserção de cada cordão (coordenadas locais da escápula): o leque abraça o ângulo superior — C1 e C2 no alto
     da borda medial (logo acima do romboide menor), C3 e C4 no começo da borda superior */
  const B_SUP = V3(0.975, -0.217, -0.054);                             // direção da borda superior a partir do ângulo
  const INS = [0.036, 0.008].map(t => EV.scap.medial(t).add(V3(0.1, 0, 0.03)));
  for (const d of [0.40, 0.85]) INS.push(EV.scap.L.supAngle.clone().addScaledVector(B_SUP, d).add(V3(0, -0.12, 0)));
  const MARG = 0.42, YTOPO = EV.thorax.range()[1] + 0.5;               // folga sobre o gradil; acima disso não há gradil
  /* eixo do tórax z(y), tabelado (EV.thorax.center aloca; o `update` não pode) */
  const ZC0 = 30, ZCN = 61, ZC = new Float32Array(ZCN); for (let i = 0; i < ZCN; i++) ZC[i] = EV.thorax.center(ZC0 + i * 0.5).z;
  const zc = y => { const f = clamp((y - ZC0) * 2, 0, ZCN - 1.001), i = Math.floor(f); return ZC[i] + (ZC[i + 1] - ZC[i]) * (f - i); };

  /* --------------------------------------------------------------- o que muda com o estado */
  const E = {ins: [V3(), V3(), V3(), V3()], I: V3(), U1: V3(), u1: 0, B1: V3(), B2: V3(), dOut: [V3(), V3(), V3(), V3()], esp: 1,
    Rd: V3(), Rn: V3(), Rz: V3(), Rl: 0, Nf: V3()};
  /* borda de cima do romboide menor (a peça `rhomboids` a faz reta, de pouco acima da ponta de C7 até t ≈ 0,07 da
     borda medial, pelo lado costal): o elevador fica sempre ACIMA dela — não há como perguntar isso ao core */
  const R0 = EV.spine.v('C7').spinousTip.clone().lerp(EV.spine.v('C6').spinousTip, 0.3);
  const R1L = EV.scap.medial(0.07).add(V3(0.14, 0, -0.22)), R1 = V3();
  const tmp = V3(), uu = V3(), q0 = V3(), q1 = V3();
  let CH0 = 0;
  function prepara(state){
    E.I.set(0, 0, 0);
    for (let k = 0; k < NC; k++){ EV.scap.toWorld(INS[k], 1, state, E.ins[k]); E.I.add(E.ins[k]); }
    E.I.multiplyScalar(1 / NC);
    E.U1.copy(E.ins[3]).sub(E.ins[0]).multiplyScalar(1 / 3); E.u1 = E.U1.length();
    for (let k = 0; k < NC; k++) E.dOut[k].copy(E.ins[k]).sub(E.I).addScaledVector(E.U1, -(k - 1.5));
    const dx = E.I.x - A.x, dz = E.I.z - A.z, corda = Math.hypot(dx, E.I.y - A.y, dz), hor = Math.hypot(dx, dz) || 1;
    if (!CH0) CH0 = corda;
    /* esticado, o ventre afina e os cordões chegam mais perto uns dos outros; encurtado, engrossam e se afastam */
    E.esp = clamp(Math.pow(CH0 / corda, 0.45), 0.86, 1.2);
    /* alças da Bézier proporcionais à corda; encurtado (ombro erguido), o trecho rente ao pescoço fica mais curto */
    E.B1.copy(A).addScaledVector(DIR1, 0.72 * corda * clamp(corda / CH0, 0.55, 1.15));
    tmp.set(dx / hor + 0.27, -0.18, dz / hor - 0.27).normalize();      // chega à escápula vindo de dentro, quase na horizontal
    E.B2.copy(E.I).addScaledVector(tmp, -0.46 * corda);                // as duas alças quase se encontram: "cotovelo" marcado na base do pescoço
    E.Nf.crossVectors(tmp, E.U1).normalize();                          // normal de fora do leque de inserção (direção de chegada × através)
    /* referencial da borda do romboide: Rd ao longo dela, Rn "para cima" no plano da lâmina, Rz através da lâmina (para trás) */
    EV.scap.toWorld(R1L, 1, state, R1);
    E.Rd.copy(R1).sub(R0); E.Rl = E.Rd.length(); E.Rd.multiplyScalar(1 / E.Rl);
    E.Rn.set(0, 1, 0).addScaledVector(E.Rd, -E.Rd.y).normalize();
    E.Rz.crossVectors(E.Rd, E.Rn);
  }
  /* linha central do feixe, s em 0..1 (0 = origem em C1, 1 = meio da inserção) */
  function centro(s, out){
    if (s < SA){
      const f = s / SA * 3, i = Math.min(2, Math.floor(f)), u = f - i, u2 = u * u, u3 = u2 * u;
      const p0 = PU[i], p1 = PU[i + 1], p2 = PU[i + 2], p3 = PU[i + 3];
      const a = -0.5 * u3 + u2 - 0.5 * u, b = 1.5 * u3 - 2.5 * u2 + 1, c = -1.5 * u3 + 2 * u2 + 0.5 * u, d = 0.5 * u3 - 0.5 * u2;
      return out.set(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y, a * p0.z + b * p1.z + c * p2.z + d * p3.z);
    }
    const t = (s - SA) / (1 - SA), m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    return out.set(a * A.x + b * E.B1.x + c * E.B2.x + d * E.I.x, a * A.y + b * E.B1.y + c * E.B2.y + d * E.I.y, a * A.z + b * E.B1.z + c * E.B2.z + d * E.I.z);
  }
  /* vetor que atravessa a faixa (de um cordão ao vizinho) em s: alto do pescoço → base do pescoço → borda do osso */
  function cruz(s, out){
    const g0 = smoothstep(0.16, 0.5, s), g = smoothstep(0.58, 0.97, s);
    out.copy(UT).lerp(U0, g0).normalize().multiplyScalar(1 - g).addScaledVector(E.U1, g / (E.u1 || 1)).normalize();
    return out.multiplyScalar(lerp(lerp(ESP0, ESP1, smoothstep(0.35, 0.8, s)) * E.esp, E.u1, smoothstep(0.84, 1, s)));
  }
  /* onde cada cordão entra na faixa (s) e índice do meio da faixa em s (0 só C1 … 1,5 os quatro) */
  const S0 = [0, 0, 0, 0], JS = 0.12;
  const meio = s => 0.5 * (smoothstep(S0[1], S0[1] + JS, s) + smoothstep(S0[2], S0[2] + JS, s) + smoothstep(S0[3], S0[3] + JS, s));
  const TJ = [0, 0.19, 0.19, 0.19], DJ = [V3(), V3(), V3(), V3()];     // trecho de entrada (fração do cordão) e desvio até a origem
  /* ponto do cordão k em t (0 origem … 1 inserção); `up` recebe o vetor através da faixa */
  function ponto(k, t, out, up){
    const s = S0[k] + (1 - S0[k]) * t;
    centro(s, out); cruz(s, uu);
    out.addScaledVector(uu, k - meio(s));
    if (k && t < TJ[k]){ const x = 1 - t / TJ[k]; out.addScaledVector(DJ[k], x * x); }
    if (t > 0.78) out.addScaledVector(E.dOut[k], smoothstep(0.78, 1, t));
    /* no leque as fitas se sobrepõem como telhas (a de C1 por cima), em vez de se atravessarem */
    if (t > 0.6) out.addScaledVector(E.Nf, (1.5 - k) * 0.055 * smoothstep(0.6, 0.85, t));
    if (up) up.copy(uu);
    return out;
  }
  prepara(EV.REST);
  for (let k = 1; k < NC; k++){
    /* o cordão k entra na faixa na altura do seu processo transverso */
    let lo = 0, hi = SA;
    for (let it = 0; it < 30; it++){ const m = (lo + hi) / 2; if (centro(m, q0).y > ORIG[k].y - 0.2) lo = m; else hi = m; }
    S0[k] = (lo + hi) / 2;
  }
  for (let k = 1; k < NC; k++){ centro(S0[k], q0); cruz(S0[k], uu); q0.addScaledVector(uu, k - meio(S0[k])); DJ[k].copy(ORIG[k]).sub(q0); }

  /* ----------------------------------------------------------------- estações dos cordões */
  const mk = () => { const a = []; for (let i = 0; i <= SEG; i++) a.push(V3()); return a; };
  const PR = [], UR = [], RA = [], RB = [], RA0 = [], RB0 = [], VEN = [], FR = [], L0 = [0, 0, 0, 0];
  for (let k = 0; k < NC; k++){ PR.push(mk()); UR.push(mk());
    for (const a of [RA, RB, RA0, RB0, VEN, FR]) a.push(new Float32Array(SEG + 1)); }
  /* Estações do cordão k (lado direito); devolve o comprimento. Onde o cordão passaria por dentro do gradil
     (costelas 1–2) ele é afastado na radial, e onde desceria abaixo da borda de cima do romboide menor ele é
     levantado. Os dois afastamentos são alisados ao longo do cordão (envoltória suave: nunca menos que o
     necessário), para não criar degraus. */
  const DSP = new Float32Array(SEG + 1), NUC = Math.max(5, Math.round(SEG * 0.22)), KER = new Float32Array(NUC + 1);
  for (let j = 0; j <= NUC; j++) KER[j] = 0.5 + 0.5 * Math.cos(Math.PI * j / NUC);          // núcleo do alisamento (cosseno)
  const Y1 = EV.ribs.point(1, 0.22, 1).y;                              // altura do ângulo da 1ª costela (repouso)
  const empurra = (P, i0, i1, desloca) => {
    const a = Math.max(1, i0 - NUC), b = Math.min(SEG - 1, i1 + NUC);
    for (let i = a; i <= b; i++){
      let d = 0;
      for (let j = Math.max(i0, i - NUC); j <= Math.min(i1, i + NUC); j++){ const v = DSP[j] * KER[Math.abs(i - j)]; if (v > d) d = v; }
      d *= Math.min(1, (SEG - i) / 4);                                 // a inserção não sai do lugar
      if (d > 1e-4) desloca(P[i], d);
    }
  };
  const radial = (p, d) => { const dz = p.z - zc(p.y), r = Math.hypot(p.x, dz) || 1; p.x += p.x / r * d; p.z += dz / r * d; };
  const paraCima = (p, d) => { p.addScaledVector(E.Rn, d); };
  function estacoes(k, state){
    const P = PR[k], U = UR[k], rk = RA0[k]; let L = 0, i0 = -1, i1 = -1;
    for (let i = 0; i <= SEG; i++){
      ponto(k, i / SEG, P[i], U[i]);
      let falta = 0;
      if (P[i].y < YTOPO && i < SEG - 1){
        /* acima da 1ª costela a superfície do gradil é só uma cúpula de segurança (não há osso): cobra menos folga */
        falta = MARG - EV.thorax.clearance(P[i], state) - 1.2 * smoothstep(Y1 + 0.3, Y1 + 1.6, P[i].y);
        if (falta > 0){ if (i0 < 0) i0 = i; i1 = i; } else falta = 0;
      }
      DSP[i] = falta;
    }
    if (i0 >= 0) empurra(P, i0, i1, radial);
    /* borda do romboide menor: só perto dela (até ~1,8 cm à frente da lâmina) e ao longo do seu comprimento */
    i0 = i1 = -1;
    for (let i = 0; i <= SEG; i++){
      const p = P[i], vx = p.x - R0.x, vy = p.y - R0.y, vz = p.z - R0.z, a = vx * E.Rd.x + vy * E.Rd.y + vz * E.Rd.z;
      let falta = 0;
      if (a > 0.5 && a < E.Rl + 0.8 && i < SEG - 1){
        const h = vx * E.Rn.x + vy * E.Rn.y + vz * E.Rn.z, fr = -(vx * E.Rz.x + vy * E.Rz.y + vz * E.Rz.z);
        falta = (0.12 + 0.95 * (rk[i] || 0.36) - h) * (1 - smoothstep(0.8, 1.8, fr));
        if (falta > 0){ if (i0 < 0) i0 = i; i1 = i; } else falta = 0;
      }
      DSP[i] = falta;
    }
    if (i0 >= 0) empurra(P, i0, i1, paraCima);
    for (let i = 1; i <= SEG; i++) L += P[i].distanceTo(P[i - 1]);
    return L;
  }
  /* perfil de repouso: raios [ao longo da faixa, espessura] por estação, pela distância (cm) à origem e à inserção */
  const R_TEN = [0.10, 0.085, 0.085, 0.085], L_TEN = [1.6, 0.35, 0.3, 0.3], R_VEN = [0.37, 0.345, 0.335, 0.335];
  for (let k = 0; k < NC; k++){
    const L = L0[k] = estacoes(k, EV.REST), P = PR[k];
    let d = 0;
    for (let i = 0; i <= SEG; i++){
      if (i) d += P[i].distanceTo(P[i - 1]);
      FR[k][i] = d / L;
      const cresce = smoothstep(L_TEN[k] * 0.55, L_TEN[k] + (k ? 2.3 : 4.6), d), d1 = L - d;   // o ventre de C1 engrossa devagar
      const rv = R_VEN[k] * (0.96 + 0.08 * Math.sin(Math.PI * clamp(d / L * 1.15, 0, 1)));     // ventre levemente fusiforme
      RA0[k][i] = lerp(R_TEN[k], lerp(0.31, rv, smoothstep(0.2, 2.6, d1)), cresce);            // na inserção: fita larga…
      RB0[k][i] = lerp(R_TEN[k], lerp(0.07, rv, smoothstep(0.7, 2.6, d1)), cresce);            // …e fina
      VEN[k][i] = cresce * smoothstep(0.8, 3.4, d1);                   // quanto do "engrossar" vale aqui (0 nos tendões)
    }
  }

  /* --------------------------------------------------------------------- textura e material */
  function texturas(){
    const W = 1024, H = 256, P0 = EV.pal || {}, pm = P0.muscle || {}, pt = P0.tendon || {};
    const pal = {base: pm.base || '#b25421', light: pm.light || '#d47a40', dark: pm.dark || '#6a280d', tb: pt.base || '#e2c188', tl: pt.light || '#f3dfb4', osso: P0.bone || '#f6ecd0'};
    const novo = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const cv = novo(), cb = novo(), x = cv.getContext('2d'), b = cb.getContext('2d');
    let seed = 90217; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    x.fillStyle = pal.base; x.fillRect(0, 0, W, H); b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
    x.lineCap = b.lineCap = 'round';
    /* fibras ao longo de X: [quantidade, espessura mín., máx., opacidade mín., máx., comprimento mín., máx. (fração de W)] */
    const niveis = [[10, 16, 40, 0.08, 0.20, 0.5, 1.3], [70, 3, 10, 0.10, 0.28, 0.3, 1.0], [260, 0.8, 2.4, 0.14, 0.45, 0.15, 0.8]];
    for (let nv = 0; nv < niveis.length; nv++) for (let i = 0; i < niveis[nv][0]; i++){
      const [, w0, w1, a0, a1, l0, l1] = niveis[nv];
      const y = rnd() * H, x0 = rnd() * W * 1.3 - W * 0.3, len = W * lerp(l0, l1, rnd()), w = lerp(w0, w1, rnd() * rnd()), claro = rnd() < 0.5, al = lerp(a0, a1, rnd());
      const amp = rnd() * 3, ph = rnd() * 7, fr = (1 + Math.floor(rnd() * 3)) * Math.PI / W;
      for (const [c, cl, es] of [[x, pal.light, pal.dark], [b, '#ffffff', '#000000']]){
        if (c === b && nv === 2) continue;                             // o relevo fica só com as faixas largas (as finas serrilhavam o brilho)
        c.strokeStyle = claro ? cl : es; c.globalAlpha = al * (claro ? 0.85 : 1); c.lineWidth = w;
        for (const oy of [-H, 0, H]){                                  // repete em Y: a textura dá a volta no cordão
          c.beginPath();
          for (let q = 0; q <= len; q += 32){ const xx = x0 + q, yy = y + oy + Math.sin(ph + xx * fr) * amp; if (q === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy); }
          c.stroke();
        }
      }
    }
    /* pontas em tendão, com a transição desfiada (cada faixa de fibras muda num ponto diferente) */
    x.globalAlpha = b.globalAlpha = 1;
    const tb = new THREE.Color(pal.tb), tl = new THREE.Color(pal.tl), osso = new THREE.Color(pal.osso);
    const rgba = (c, a) => 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ',' + a + ')';
    const cO = new THREE.Color(), cI = new THREE.Color();
    for (let r = 0; r < H; r += 2){
      const j = (rnd() - 0.5) * 0.06 + 0.015 * Math.sin(r / H * Math.PI * 6);
      cO.copy(tb).lerp(tl, rnd() * 0.6).multiplyScalar(0.93);          // origem: tendão creme
      cI.copy(tl).lerp(osso, 0.35 + 0.4 * rnd());                      // inserção: quase da cor do osso
      const a1 = clamp(0.10 + j * 0.6, 0.03, 0.16), a2 = clamp(0.165 + j * 1.3, a1 + 0.02, 0.26), b1 = clamp(0.81 + j * 1.4, 0.7, 0.88), b2 = clamp(0.915 + j * 0.6, b1 + 0.03, 0.97);
      for (const [c, co, ci] of [[x, rgba(cO, 1), rgba(cI, 1)], [b, 'rgba(128,128,128,0.75)', 'rgba(128,128,128,0.75)']]){
        const z = s => s.replace(/,[\d.]+\)$/, ',0)');
        const g = c.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, co); g.addColorStop(a1, co); g.addColorStop(a2, z(co)); g.addColorStop(b1, z(ci)); g.addColorStop(b2, ci); g.addColorStop(1, ci);
        c.fillStyle = g; c.fillRect(0, r, W, 2);
      }
    }
    const pronto = (c, cor) => { const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (cor) t.encoding = THREE.sRGBEncoding; return t; };
    return {map: pronto(cv, true), bump: pronto(cb, false)};
  }
  const tex = texturas();
  const mat = EV.mats.muscle({map: tex.map, bumpMap: tex.bump, bump: 0.024, roughness: 0.46});

  /* ----------------------------------------------------------------------------- as malhas */
  /* na textura (u): 0–0,10 tendão de origem · 0,10–0,18 transição · músculo · 0,80–0,92 transição · tendão de inserção */
  const mapaU = (d, L, k) => { const a = L_TEN[k], b = a + 0.7, c = L - 3.0, e = L - 1.2;
    return d < a ? 0.10 * d / a : d < b ? lerp(0.10, 0.18, (d - a) / (b - a)) : d < c ? lerp(0.18, 0.80, (d - b) / (c - b)) : d < e ? lerp(0.80, 0.92, (d - c) / (e - c)) : lerp(0.92, 1, (d - e) / (L - e)); };
  const cordoes = [], rr = [0, 0];
  for (const side of [1, -1]) for (let k = 0; k < NC; k++){
    const ra = RA[k], rb = RB[k], U = UR[k];
    /* (opções só para CRIAR a malha com EV.mesh.tube: daí em diante quem escreve os vértices é `malhas`, abaixo) */
    const opts = {segments: SEG, radial: RAD, caps: true, capRings: CAP,
      radius: t => { const i = Math.round(t * SEG); rr[0] = ra[i]; rr[1] = rb[i]; return rr; },
      up: t => U[Math.round(t * SEG)]};
    cordoes.push({side, k, P: PR[k], opts, m: null});
  }
  function atualiza(state){
    prepara(state);
    for (let k = 0; k < NC; k++){
      const L = estacoes(k, state);
      /* volume constante: encurtou, engrossa; esticou, afina (só no ventre) */
      const eng = clamp(Math.sqrt(L0[k] / L), 0.86, 1.2) - 1, ra = RA[k], rb = RB[k], a0 = RA0[k], b0 = RB0[k], v = VEN[k];
      for (let i = 0; i <= SEG; i++){ const f = 1 + eng * v[i]; ra[i] = a0[i] * f; rb[i] = b0[i] * f; }
    }
  }
  /* Escreve position/normal dos oito tubos no lugar. Mesma malha de EV.mesh.tube (anéis elípticos com semi-eixo a
     ao longo de U, calotas nas pontas), mas cada anel é calculado UMA vez, para o lado direito, e gravado também
     espelhado em X no cordão esquerdo — com a volta do anel invertida, para as faces continuarem viradas para
     fora. Senos e cossenos vêm de tabela. (É o que mantém o `update` bem abaixo de 1 ms.) */
  const COLS = RAD + 1, CJ = new Float32Array(COLS), SJ = new Float32Array(COLS);
  for (let j = 0; j <= RAD; j++){ CJ[j] = Math.cos(j / RAD * Math.PI * 2); SJ[j] = Math.sin(j / RAD * Math.PI * 2); }
  const CSC = [], CSN = []; for (let e = 1; e <= CAP; e++){ const ps = e / CAP * Math.PI / 2; CSC.push(e === CAP ? 1e-4 : Math.cos(ps)); CSN.push(Math.sin(ps)); }
  function malhas(){
    for (let k = 0; k < NC; k++){
      const P = PR[k], U = UR[k], ra = RA[k], rb = RB[k], gR = cordoes[k].m.geometry, gL = cordoes[NC + k].m.geometry;
      const pr = gR.attributes.position.array, nr = gR.attributes.normal.array, pl = gL.attributes.position.array, nl = gL.attributes.normal.array;
      for (let i = 0; i <= SEG; i++){
        const pa = P[i ? i - 1 : 0], pb = P[i < SEG ? i + 1 : SEG], c = P[i], u = U[i];
        let tx = pb.x - pa.x, ty = pb.y - pa.y, tz = pb.z - pa.z, il = 1 / (Math.sqrt(tx * tx + ty * ty + tz * tz) || 1);
        tx *= il; ty *= il; tz *= il;
        let d = u.x * tx + u.y * ty + u.z * tz, ax = u.x - tx * d, ay = u.y - ty * d, az = u.z - tz * d, al = ax * ax + ay * ay + az * az;
        if (al < 1e-10){ ax = Math.abs(tx) < 0.9 ? 1 : 0; ay = ax ? 0 : 1; az = 0; d = ax * tx + ay * ty; ax -= tx * d; ay -= ty * d; az = -tz * d; al = ax * ax + ay * ay + az * az; }
        il = 1 / Math.sqrt(al); ax *= il; ay *= il; az *= il;
        const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
        const a = Math.max(ra[i], 1e-4), b = Math.max(rb[i], 1e-4), nAnel = (i === 0 || i === SEG) ? CAP : 0, hc = Math.min(a, b);
        for (let e = 0; e <= nAnel; e++){
          /* e = 0: o anel da estação; e > 0: anéis da calota (encolhem e avançam ao longo da tangente) */
          const sc = e ? CSC[e - 1] : 1, sg = i === 0 ? -1 : 1, off = e ? sg * hc * CSN[e - 1] : 0, kt = e ? sg * CSN[e - 1] / hc : 0;
          const row = e ? (i === 0 ? CAP - e : CAP + SEG + e) : CAP + i;
          const ox = c.x + tx * off, oy = c.y + ty * off, oz = c.z + tz * off, ka = sc / a, kb = sc / b, sa = a * sc, sb = b * sc;
          let n = row * COLS * 3, m = (row * COLS + RAD) * 3;
          for (let j = 0; j <= RAD; j++, n += 3, m -= 3){
            const cs = CJ[j], sn = SJ[j], qa = sa * cs, qb = sb * sn, wa = ka * cs, wb = kb * sn;
            const x = ox + ax * qa + bx * qb, y = oy + ay * qa + by * qb, z = oz + az * qa + bz * qb;
            let nx = ax * wa + bx * wb + tx * kt, ny = ay * wa + by * wb + ty * kt, nz = az * wa + bz * wb + tz * kt;
            const nn = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1); nx *= nn; ny *= nn; nz *= nn;
            pr[n] = x; pr[n + 1] = y; pr[n + 2] = z; nr[n] = nx; nr[n + 1] = ny; nr[n + 2] = nz;
            pl[m] = -x; pl[m + 1] = y; pl[m + 2] = z; nl[m] = -nx; nl[m + 1] = ny; nl[m + 2] = nz;
          }
        }
      }
      gR.attributes.position.needsUpdate = gR.attributes.normal.needsUpdate = gL.attributes.position.needsUpdate = gL.attributes.normal.needsUpdate = true;
    }
  }
  atualiza(EV.REST);
  for (const c of cordoes){
    const g = EV.mesh.tube(c.P, c.opts), k = c.k;
    g.boundingSphere.set(V3(0, 49, 2), 40);                            // fixa e folgada: os cordões se mexem
    /* uv.x pela distância ao longo do cordão (as zonas de tendão da textura caem nas pontas, com o tamanho certo);
       cor de vértice: sulco escuro do lado de cada vizinho e do lado de dentro (encostado no pescoço) */
    const uv = g.attributes.uv.array, col = g.attributes.color.array, cols = RAD + 1, L = L0[k];
    for (let r = 0; r < SEG + 1 + 2 * CAP; r++){
      const i = clamp(r - CAP, 0, SEG), d = FR[k][i] * L, s = S0[k] + (1 - S0[k]) * (i / SEG);
      const u = mapaU(d, L, k);
      const junto = k ? smoothstep(0.3 * TJ[k], TJ[k], i / SEG) : 1;                       // este cordão já entrou na faixa?
      const viz1 = k < NC - 1 ? smoothstep(S0[k + 1] + 0.3 * JS, S0[k + 1] + JS, s) : 0;   // vizinho de índice maior (lado +U)
      const viz0 = k > 0 ? junto : 0;                                                      // vizinho de índice menor (lado −U)
      for (let j = 0; j <= RAD; j++){
        const n = r * cols + j, a = j / RAD * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a) * c.side;   // sn > 0: lado de fora
        uv[n * 2] = u;
        let occ = 0.62 * viz1 * Math.pow(Math.max(0, cs), 2.2) + 0.62 * viz0 * Math.pow(Math.max(0, -cs), 2.2) + 0.30 * Math.pow(Math.max(0, -sn), 2);
        occ = Math.min(0.8, occ) * (1 - 0.5 * smoothstep(L - 1.6, L, d));                  // no leque tendíneo os sulcos somem aos poucos
        col[n * 3] = 1 - occ * 0.50; col[n * 3 + 1] = 1 - occ * 0.68; col[n * 3 + 2] = 1 - occ * 0.74;
      }
    }
    g.attributes.uv.needsUpdate = true; g.attributes.color.needsUpdate = true;
    c.m = new THREE.Mesh(g, mat); c.m.castShadow = c.m.receiveShadow = true; group.add(c.m);
  }
  malhas();

  /* marcador 1: sobre a faixa, na altura de C7 (como na referência) */
  let SM = 0.8;
  { let lo = SA, hi = 1; for (let it = 0; it < 30; it++){ const m = (lo + hi) / 2; if (centro(m, q0).y > EV.spine.v('C7').pos.y - 0.4) lo = m; else hi = m; } SM = (lo + hi) / 2; }
  const comprimento = state => { prepara(state); let s = 0; for (let k = 0; k < NC; k++){ let L = 0; for (let i = 0; i <= 14; i++){ ponto(k, i / 14, i & 1 ? q1 : q0); if (i) L += q0.distanceTo(q1); } s += L; } return s; };
  const compRest = comprimento(EV.REST);
  /* (strain e o marcador reescrevem o rascunho `E` para o estado pedido; `update` sempre o refaz antes de usar) */
  return {group, tint: [mat],
    update(state){ atualiza(state); malhas(); },
    strain(state){ return comprimento(state) / compRest - 1; },
    markers: [{n: 1, label: 'Elevador da escápula', pos: state => {
      prepara(state);
      const p = centro(SM, V3());
      centro(SM + 0.03, q1).sub(centro(SM - 0.03, q0)).normalize(); cruz(SM, uu);
      return p.addScaledVector(q1.cross(uu).normalize(), 0.9);         // tangente × através = lado de fora (direito)
    }}]};
});
})();
