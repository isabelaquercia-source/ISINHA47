/* Peça `ribs` — 12 pares de costelas, cartilagens costais e esterno.

   Costelas: FITAS de seção achatada (superelipse: faces planas, bordas roliças, borda de cima mais grossa que a de
   baixo) que acompanham a parede do gradil — a seção é inclinada pelo declive da parede medido entre a costela de
   cima e a de baixo no mesmo azimute (as de cima olham para cima e para fora, as de baixo um pouco para baixo; a 1ª é
   deitada). Cabeça e tubérculo arredondados junto da coluna, colo roliço, pontas em fuso nas flutuantes. A face de
   dentro do gradil leva uma cor de vértice mais escura (oclusão de ambiente "assada"), como na referência, onde as
   costelas do lado de lá aparecem cinza-bege por dentro.

   Respiração sem custo por quadro: tudo é calculado duas vezes na construção (repouso e inspiração completa) e
   guardado como alvo de morph (morphAttributes); `update` só escreve morphTargetInfluences e a pose rígida do
   esterno. Duas malhas (osso e cartilagem) para os dois lados + o esterno = 3 chamadas de desenho. */
(() => {
EV.register('ribs', ({THREE, EV, quality}) => {
  const group = new THREE.Group();
  const lerp = EV.lerp, clamp = EV.clamp, ss = EV.smoothstep;
  const q = clamp(quality || 1, 0.3, 1);
  const NR = q >= 0.9 ? 16 : q >= 0.7 ? 14 : 12;                    // pontos em volta da seção
  const CAP = 3;                                                    // anéis de cada calota
  const REST = EV.REST, CHEIO = {elev: 0, retr: 0, rot: 0, breath: 1};
  const V3 = () => new THREE.Vector3();
  const v = V3(), fr = {};
  const bump = (t, c, w) => { const u = (t - c) / w; return u < -1 || u > 1 ? 0 : (1 - u * u) * (1 - u * u); };
  const zEixo = y => EV.thorax.center(y).z;                         // só na construção

  /* --------------------------------------------------------------- seção
     Perfil em volta do anel (SX ao longo de A = "altura" da fita, SY ao longo de B = para fora) e a normal 2D dele. */
  const SX = new Float32Array(NR), SY = new Float32Array(NR), NX = new Float32Array(NR), NY = new Float32Array(NR);
  const CS = new Float32Array(NR), SN = new Float32Array(NR);
  for (let j = 0; j < NR; j++){ const a = j / NR * Math.PI * 2; CS[j] = Math.cos(a); SN[j] = Math.sin(a); }
  function secao(a, e, n, assim){
    const p = 2 / n, pn = 2 - p;
    for (let j = 0; j < NR; j++){
      const c = CS[j], s = SN[j], ac = Math.abs(c), as = Math.abs(s);
      const x = (c < 0 ? -1 : 1) * Math.pow(ac, p), y = (s < 0 ? -1 : 1) * Math.pow(as, p);
      SX[j] = a * x; SY[j] = e * y * (1 + assim * x) * (s < 0 ? 0.9 : 1);        // borda de cima mais grossa; face de dentro mais chata
      let nx = (c < 0 ? -1 : 1) * Math.pow(ac, pn) / a, ny = (s < 0 ? -1 : 1) * Math.pow(as, pn) / e;
      const il = 1 / (Math.hypot(nx, ny) || 1); NX[j] = nx * il; NY[j] = ny * il;
    }
  }
  /* raios e forma da seção da costela i em t (cabeça inchada, colo, tubérculo, corpo em fita) */
  const sec = {a: 0, e: 0, n: 2, assim: 0, tub: 0};
  function forma(i, t){
    const r = EV.ribs.radii(i, t), cab = 1 - ss(0, 0.045, t), colo = bump(t, 0.055, 0.035), tub = bump(t, 0.10, 0.04);
    sec.a = r[0] * (1 + 0.20 * cab - 0.07 * colo + 0.10 * tub);
    sec.e = r[1] * (1 + 0.20 * cab - 0.07 * colo + 0.32 * tub);
    sec.tub = tub;
    const corpo = ss(0.12, 0.30, t);
    if (i === 1){ sec.n = lerp(2, 2.5, corpo); sec.assim = 0; }
    else if (i >= 11){ sec.n = lerp(2, 2.4, corpo) - 0.35 * ss(0.8, 1, t); sec.assim = 0.10 * corpo; }
    else { sec.n = lerp(2, 2.45, corpo); sec.assim = 0.14 * corpo; }
    return sec;
  }

  /* ---------------------------------------------------- inclinação da fita
     φ(t): ângulo (rad) da "altura" da fita em relação à vertical do referencial radial; tan φ = dr/dy da parede. */
  const polar = (i, t, o) => { EV.ribs.point(i, t, 1, REST, v); const dz = v.z - zEixo(v.y); o.th = Math.atan2(v.x, dz); o.r = Math.hypot(v.x, dz); o.y = v.y; return o; };
  const pa = {}, pb = {}, pm = {}, p0 = {}, pu = {}, pd = {};
  function noAzimute(j, th, o){                                     // ponto da costela j no azimute th; false se ela não passa por lá
    let lo = 0.16, hi = 1;
    if (polar(j, lo, pa).th > th || polar(j, hi, pb).th < th) return false;
    for (let k = 0; k < 13; k++){ const m = (lo + hi) / 2; if (polar(j, m, pm).th < th) lo = m; else hi = m; }
    polar(j, (lo + hi) / 2, o); return true;
  }
  /* por costela: [ângulo máx. (rad), t onde começa, t onde está cheia, t onde começa a desfazer, t onde acaba] */
  const TORCE = [null, null, null, [0.35, 0.14, 0.2, 0.25, 0.36], [0.35, 0.14, 0.2, 0.25, 0.36], [0.4, 0.14, 0.2, 0.25, 0.36], [0.4, 0.14, 0.2, 0.25, 0.36],
    [0.45, 0.14, 0.2, 0.25, 0.36], [0.5, 0.14, 0.2, 0.26, 0.38], [0.95, 0.16, 0.21, 0.23, 0.33], [1.05, 0.17, 0.22, 0.25, 0.36], [0.9, 0.15, 0.22, 0.28, 0.42], null];
  function inclinacao(i, ts){
    const n = ts.length, f = new Float32Array(n), g = new Float32Array(n);
    for (let k = 0; k < n; k++){
      const t = ts[k];
      if (i === 1){ f[k] = 0.32 * ss(0.08, 0.3, t); continue; }      // 1ª: deitada, borda de fora mais baixa
      if (t < 0.13 || i >= 11) continue;                             // flutuantes: sem parede para acompanhar
      polar(i, t, p0);
      const up = i > 1 && noAzimute(i - 1, p0.th, pu), dn = i < 12 && noAzimute(i + 1, p0.th, pd);
      let s = 0;
      if (up && dn && pu.y - pd.y > 1.5) s = (pu.r - pd.r) / (pu.y - pd.y);
      else if (up && pu.y - p0.y > 0.8) s = (pu.r - p0.r) / (pu.y - p0.y);
      else if (dn && p0.y - pd.y > 0.8) s = (p0.r - pd.r) / (p0.y - pd.y);
      f[k] = clamp(Math.atan(s), -0.7, 0.6) * ss(0.13, 0.27, t);
    }
    /* torção do terço de trás: logo depois do ângulo, onde a costela mergulha, a face de fora olha para trás, para
       dentro e para BAIXO (vista por trás e de lado a fita aparece de perfil, fina, e só abre mais adiante) */
    const tw = TORCE[i];
    if (tw) for (let k = 0; k < n; k++) f[k] += tw[0] * ss(tw[1], tw[2], ts[k]) * (1 - ss(tw[3], tw[4], ts[k]));
    if (i > 1) for (let pass = 0; pass < 3; pass++){                 // suaviza ao longo da costela
      for (let k = 0; k < n; k++) g[k] = (f[Math.max(0, k - 1)] + 2 * f[k] + f[Math.min(n - 1, k + 1)]) / 4;
      f.set(g);
    }
    return f;
  }

  /* ------------------------------------------------------ malha de tubos
     Cada tubo ocupa (2·CAP + n) anéis de NR vértices. `anel` escreve um anel em pos/nor a partir do centro C, da
     tangente T e dos eixos A, B; sc < 1 e off ≠ 0 nas calotas. */
  const C = V3(), Tg = V3(), A = V3(), B = V3(), A0 = V3(), B0 = V3(), Bt = V3(), O = V3();
  function anel(pos, nor, o, sc, off, sinal){
    const cx = C.x + Tg.x * off, cy = C.y + Tg.y * off, cz = C.z + Tg.z * off, kt = sinal * Math.sqrt(Math.max(0, 1 - sc * sc));
    for (let j = 0; j < NR; j++, o += 3){
      const x = SX[j] * sc, y = SY[j] * sc;
      pos[o] = cx + A.x * x + B.x * y; pos[o + 1] = cy + A.y * x + B.y * y; pos[o + 2] = cz + A.z * x + B.z * y;
      let nx = (A.x * NX[j] + B.x * NY[j]) * sc + Tg.x * kt, ny = (A.y * NX[j] + B.y * NY[j]) * sc + Tg.y * kt, nz = (A.z * NX[j] + B.z * NY[j]) * sc + Tg.z * kt;
      const il = 1 / (Math.hypot(nx, ny, nz) || 1);
      nor[o] = nx * il; nor[o + 1] = ny * il; nor[o + 2] = nz * il;
    }
    return o;
  }
  /* anel completo (com as calotas quando é o primeiro ou o último); hc0/hc1 = comprimento das calotas */
  function aneis(pos, nor, o, k, n, hc0, hc1){
    if (k === 0) for (let e = CAP; e >= 1; e--){ const ps = e / CAP * Math.PI / 2; o = anel(pos, nor, o, e === CAP ? 0.02 : Math.cos(ps), -hc0 * Math.sin(ps), -1); }
    o = anel(pos, nor, o, 1, 0, 0);
    if (k === n - 1) for (let e = 1; e <= CAP; e++){ const ps = e / CAP * Math.PI / 2; o = anel(pos, nor, o, e === CAP ? 0.02 : Math.cos(ps), hc1 * Math.sin(ps), 1); }
    return o;
  }
  const linhas = n => n + 2 * CAP;

  /* referencial de cada anel da costela: B0 = para fora do gradil (radial), ⟂ à tangente. Entre o tubérculo e o
     ângulo as costelas de baixo correm quase na radial (o "para fora" fica indefinido): ali o referencial é
     transportado a partir do corpo da costela, sem torção. Guarda centro, tangente e B0 de todos os anéis em `F`. */
  const NF = 10;                                                    // por anel: centro (3), tangente (3), B0 (3), alinhamento (1)
  let F = new Float32Array(0);
  function referenciais(i, ts, st){
    const n = ts.length;
    if (F.length < n * NF) F = new Float32Array(n * NF);
    for (let k = 0; k < n; k++){
      EV.ribs.frame(i, ts[k], 1, st, fr);
      O.set(fr.p.x, 0, fr.p.z - zEixo(fr.p.y)).normalize();
      const o = k * NF;
      F[o] = fr.p.x; F[o + 1] = fr.p.y; F[o + 2] = fr.p.z; F[o + 3] = fr.tangent.x; F[o + 4] = fr.tangent.y; F[o + 5] = fr.tangent.z;
      F[o + 6] = fr.out.x; F[o + 7] = fr.out.y; F[o + 8] = fr.out.z;
      F[o + 9] = Math.abs(O.dot(fr.tangent));                       // quão radial é a tangente (1 = "para fora" indefinido)
    }
    if (i >= 11){
      /* flutuantes: ficam na parede de trás do abdome — a face de fora olha para TRÁS (na 11ª vira para fora perto da ponta) */
      for (let k = 0; k < n; k++){
        const o = k * NF, w = i === 11 ? ss(0.45, 0.95, ts[k]) : 0;
        Tg.set(F[o + 3], F[o + 4], F[o + 5]);
        O.set(0, 0, 1).lerp(Bt.set(F[o + 6], F[o + 7], F[o + 8]), w); O.addScaledVector(Tg, -O.dot(Tg)).normalize();
        F[o + 6] = O.x; F[o + 7] = O.y; F[o + 8] = O.z;
      }
      return;
    }
    /* do corpo (t ≥ 0,3) para trás, rumo à cabeça */
    let k0 = 0; while (k0 < n - 1 && ts[k0] < 0.3) k0++;
    for (let k = k0 - 1; k >= 0; k--){
      const o = k * NF;
      Tg.set(F[o + 3], F[o + 4], F[o + 5]);
      Bt.set(F[o + NF + 6], F[o + NF + 7], F[o + NF + 8]); Bt.addScaledVector(Tg, -Bt.dot(Tg)).normalize();
      O.set(F[o + 6], F[o + 7], F[o + 8]);
      if (O.dot(Bt) < 0) O.negate();
      O.lerp(Bt, ss(0.55, 0.85, F[o + 9])); O.addScaledVector(Tg, -O.dot(Tg)).normalize();
      F[o + 6] = O.x; F[o + 7] = O.y; F[o + 8] = O.z;
    }
  }

  /* ------------------------------------------------- assenta no gradil
     EV.thorax promete passar por FORA do osso. A fita inclinada, de cantos vivos, pode furar essa superfície por
     1–2 mm nas bordas: cada anel que fura é recuado na radial até caber (o recuo é suavizado ao longo do tubo). */
  let DESL = new Float32Array(128), DTMP = new Float32Array(128);
  function assenta(pos, base, n, st, tDe){
    let algum = false;
    for (let k = 0; k < n; k++){
      DESL[k] = 0;
      if (k / (n - 1) < tDe) continue;
      let mx = -1e9, o = (base + (CAP + k) * NR) * 3;
      for (let j = 0; j < NR; j++, o += 3){ const c = EV.thorax.clearance(v.set(pos[o], pos[o + 1], pos[o + 2]), st); if (c > mx) mx = c; }
      if (mx > -0.015 && mx < 1.2){ DESL[k] = mx + 0.015; algum = true; }      // > 1,2: fora da faixa do gradil (cúpulas): não mexe
    }
    if (!algum) return;
    for (let pass = 0; pass < 2; pass++){
      for (let k = 0; k < n; k++) DTMP[k] = Math.max(DESL[k], (DESL[Math.max(0, k - 1)] + DESL[k] + DESL[Math.min(n - 1, k + 1)]) / 3);
      for (let k = 0; k < n; k++) DESL[k] = DTMP[k];
    }
    const L = n + 2 * CAP;
    for (let r = 0; r < L; r++){
      const d = DESL[clamp(r - CAP, 0, n - 1)]; if (d <= 0) continue;
      let o = (base + r * NR) * 3, cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < NR; j++){ cx += pos[o + j * 3]; cy += pos[o + j * 3 + 1]; cz += pos[o + j * 3 + 2]; }
      cx /= NR; cy /= NR; cz = cz / NR - zEixo(cy);
      const il = d / (Math.hypot(cx, cz) || 1), dx = cx * il, dz = cz * il;
      for (let j = 0; j < NR; j++, o += 3){ pos[o] -= dx; pos[o + 2] -= dz; }
    }
  }

  /* ------------------------------------------------------------ costelas */
  const nSeg = i => Math.max(12, Math.round((i === 12 ? 30 : (i <= 2 || i === 11) ? 42 : 58) * q));
  const TS = [null], FI = [null];
  for (let i = 1; i <= 12; i++){
    const n = nSeg(i) + 1, ts = new Float32Array(n);
    for (let k = 0; k < n; k++) ts[k] = k / (n - 1);
    TS.push(ts); FI.push(inclinacao(i, ts));
  }
  let nvOsso = 0, niOsso = 0;
  const baseR = [null];
  for (let i = 1; i <= 12; i++){ baseR.push(nvOsso); const L = linhas(TS[i].length); nvOsso += L * NR; niOsso += (L - 1) * NR * 6; }
  const nvLado = nvOsso; nvOsso *= 2; niOsso *= 2;
  const mk = n => new Float32Array(n * 3);
  const posO = [mk(nvOsso), mk(nvOsso)], norO = [mk(nvOsso), mk(nvOsso)], corO = mk(nvOsso);
  /* cor de vértice ("luz assada", como na referência, onde cada fita tem a borda de cima clara e escurece para
     um cinza-lavanda embaixo): por fora depende de para onde a normal olha na vertical; por dentro do gradil e junto
     da coluna fica creme-acinzentada. Valores lineares que multiplicam a cor do material. */
  const DENTRO = [0.56, 0.535, 0.465], MEIO = [0.74, 0.72, 0.715], BAIXO = [0.46, 0.43, 0.52];
  function tinge(cor, w, ny, fora, k){
    const u = ny >= 0 ? ss(0, 0.9, ny) : -ss(0, 0.7, -ny);
    for (let c = 0; c < 3; c++){
      const luz = u >= 0 ? lerp(MEIO[c], 1, u) : lerp(MEIO[c], BAIXO[c], -u);
      cor[w + c] = luz * lerp(DENTRO[c], 1, fora) * (k.length ? k[c] : k);
    }
  }
  const fimR = [null];                                              // seção e eixos na ponta de cada costela (para a cartilagem)
  for (let i = 1; i <= 12; i++) fimR.push([{A: V3(), B: V3(), a: 0, e: 0}, {A: V3(), B: V3(), a: 0, e: 0}]);
  function costela(i, m){
    const ts = TS[i], fi = FI[i], n = ts.length, st = m ? CHEIO : REST, pos = posO[m], nor = norO[m];
    referenciais(i, ts, st);
    let o = baseR[i] * 3;
    const gama = i === 1 ? 1.15 : i === 2 ? 0.6 : i === 3 ? 0.3 : i === 4 ? 0.12 : 0;   // quanto o "para fora" olha para cima (cúpula)
    for (let k = 0; k < n; k++){
      const t = ts[k], f = k * NF, s = forma(i, t);
      C.set(F[f], F[f + 1], F[f + 2]); Tg.set(F[f + 3], F[f + 4], F[f + 5]); B0.set(F[f + 6], F[f + 7], F[f + 8]);
      A0.crossVectors(B0, Tg).normalize();
      const c = Math.cos(fi[k]), sn = Math.sin(fi[k]);
      A.copy(A0).multiplyScalar(c).addScaledVector(B0, sn); B.copy(B0).multiplyScalar(c).addScaledVector(A0, -sn);
      C.addScaledVector(B0, 0.14 * s.tub);                            // tubérculo: saliência para trás
      secao(s.a, s.e, s.n, s.assim);
      const mn = Math.min(s.a, s.e);
      const o0 = o;
      o = aneis(pos, nor, o, k, n, mn * 0.9, i >= 11 ? mn * 1.6 : mn * 0.5);
      if (m === 0){
        /* cor: pelo lado para onde olha a normal (no repouso) */
        const sombra = lerp(0.80, 1, ss(0.02, 0.17, t));
        O.set(B0.x, 0, B0.z).normalize().multiplyScalar(Math.cos(gama)); O.y = Math.sin(gama);
        for (let w = o0; w < o; w += 3){
          const d = nor[w] * O.x + nor[w + 1] * O.y + nor[w + 2] * O.z;
          tinge(corO, w, nor[w + 1], ss(-0.62, 0.22, d), sombra);
        }
      }
      if (k === n - 1){ const e = fimR[i][m]; e.A.copy(A); e.B.copy(B); e.a = s.a; e.e = s.e; }
    }
    assenta(pos, baseR[i], n, st, 0.2);
  }
  for (let i = 1; i <= 12; i++){ costela(i, 0); costela(i, 1); }

  /* índices de um tubo de L linhas a partir do vértice `base`; espelhado = lado esquerdo (inverte a face) */
  function indices(idx, n, base, L, espelhado){
    for (let r = 0; r < L - 1; r++) for (let j = 0; j < NR; j++){
      const a = base + r * NR + j, e = base + r * NR + (j + 1) % NR, b = a + NR, c = e + NR;
      if (espelhado){ idx[n++] = a; idx[n++] = b; idx[n++] = e; idx[n++] = b; idx[n++] = c; idx[n++] = e; }
      else { idx[n++] = a; idx[n++] = e; idx[n++] = b; idx[n++] = b; idx[n++] = e; idx[n++] = c; }
    }
    return n;
  }
  /* espelha a metade direita (vértices 0..nv/2) para a esquerda */
  function espelha(arr, nvMeio, negaX){
    for (let k = 0, o = nvMeio * 3; k < nvMeio * 3; k += 3, o += 3){ arr[o] = negaX ? -arr[k] : arr[k]; arr[o + 1] = arr[k + 1]; arr[o + 2] = arr[k + 2]; }
  }
  function malha(pos, nor, cor, idx, mat){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos[0], 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor[0], 3));
    g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    g.morphAttributes.position = [new THREE.BufferAttribute(pos[1], 3)];
    g.morphAttributes.normal = [new THREE.BufferAttribute(nor[1], 3)];
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.boundingSphere.radius *= 1.12;       // a respiração mexe um pouco
    mat.morphTargets = true; mat.morphNormals = true;
    const me = new THREE.Mesh(g, mat);
    me.castShadow = me.receiveShadow = true; group.add(me);
    return me;
  }
  for (const a of posO) espelha(a, nvLado, true);
  for (const a of norO) espelha(a, nvLado, true);
  espelha(corO, nvLado, false);
  const idxO = nvOsso > 65535 ? new Uint32Array(niOsso) : new Uint16Array(niOsso);
  { let n = 0;
    for (let lado = 0; lado < 2; lado++) for (let i = 1; i <= 12; i++) n = indices(idxO, n, baseR[i] + lado * nvLado, linhas(TS[i].length), lado === 1); }
  const malhaOsso = malha(posO, norO, corO, idxO, EV.mats.bone());
  malhaOsso.userData.costelas = {inicio: baseR, porLado: nvLado, NR};   // para testes: faixa de vértices de cada costela

  /* ---------------------------------------------------------- cartilagens
     Continuam a seção da ponta da costela (um pouco menores, nascendo de dentro dela) e afinam até o esterno (1–7)
     ou até a cartilagem de cima (8–10, margem costal). */
  const nSegC = i => Math.max(5, Math.round((i === 1 ? 7 : i <= 4 ? 11 : i <= 7 ? 16 : 12) * q));
  let nvCart = 0, niCart = 0;
  const baseC = [null];
  for (let i = 1; i <= 10; i++){ baseC.push(nvCart); const L = linhas(nSegC(i) + 1); nvCart += L * NR; niCart += (L - 1) * NR * 6; }
  const nvLadoC = nvCart; nvCart *= 2; niCart *= 2;
  const posC = [mk(nvCart), mk(nvCart)], norC = [mk(nvCart), mk(nvCart)], corC = mk(nvCart);
  const Pa = V3(), Pb = V3();
  const TOM = [0.93, 0.89, 0.76];                                   // puxa a cartilagem para um creme mais amarelado que o osso
  function cartilagem(i, m){
    const st = m ? CHEIO : REST, pos = posC[m], nor = norC[m], n = nSegC(i) + 1, fim = fimR[i][m];
    const s0 = -0.03;                                               // nasce um pouco para dentro da costela
    let o = baseC[i] * 3;
    Bt.copy(fim.B);
    for (let k = 0; k < n; k++){
      const s = lerp(s0, 1, k / (n - 1)), h = 0.02;
      const sp = Math.max(s, 0);
      EV.ribs.cartilage(i, sp, 1, st, C);
      EV.ribs.cartilage(i, Math.min(1, sp + h), 1, st, Pb); EV.ribs.cartilage(i, Math.max(0, sp - h), 1, st, Pa);
      Tg.copy(Pb).sub(Pa).normalize();
      if (s < 0){ EV.ribs.cartilage(i, 0.03, 1, st, Pb); EV.ribs.cartilage(i, 0, 1, st, Pa); Tg.copy(Pb).sub(Pa); const L = Tg.length() / 0.03; Tg.normalize(); C.addScaledVector(Tg, s * L); }
      /* B: transportado desde a ponta da costela e puxado para a radial do gradil */
      Bt.addScaledVector(Tg, -Bt.dot(Tg)).normalize();
      O.set(C.x, 0, C.z - zEixo(C.y)); O.addScaledVector(Tg, -O.dot(Tg));
      if (O.lengthSq() > 0.04){ O.normalize(); if (O.dot(Bt) < 0.2) O.copy(Bt); Bt.lerp(O, 0.25 * ss(0.05, 0.5, sp)).normalize(); }
      B.copy(Bt); A.crossVectors(B, Tg).normalize();
      const u = ss(0, i >= 8 ? 1 : 0.75, sp);
      const a1 = i === 1 ? 0.40 : i === 10 ? 0.27 : i >= 8 ? 0.36 : 0.50, e1 = i === 1 ? 0.55 : i === 10 ? 0.21 : i >= 8 ? 0.25 : 0.30;
      const a = lerp(fim.a * 0.95, a1, u), e = lerp(fim.e * 0.93, e1, u);
      secao(a, e, lerp(2.7, 2.3, u), 0.08 * (1 - u));
      const mn = Math.min(a, e), o0 = o;
      o = aneis(pos, nor, o, k, n, mn * 0.4, mn * 0.8);
      if (m === 0){
        O.set(C.x, 0, C.z - zEixo(C.y)).normalize();
        for (let w = o0; w < o; w += 3){
          const d = nor[w] * O.x + nor[w + 2] * O.z;
          tinge(corC, w, nor[w + 1], ss(-0.62, 0.22, d), TOM);
        }
      }
    }
    assenta(pos, baseC[i], n, st, 0);
  }
  for (let i = 1; i <= 10; i++){ cartilagem(i, 0); cartilagem(i, 1); }
  for (const a of posC) espelha(a, nvLadoC, true);
  for (const a of norC) espelha(a, nvLadoC, true);
  espelha(corC, nvLadoC, false);
  const idxC = nvCart > 65535 ? new Uint32Array(niCart) : new Uint16Array(niCart);
  { let n = 0;
    for (let lado = 0; lado < 2; lado++) for (let i = 1; i <= 10; i++) n = indices(idxC, n, baseC[i] + lado * nvLadoC, linhas(nSegC(i) + 1), lado === 1); }
  const malhaCart = malha(posC, norC, corC, idxC, EV.mats.cartilage());

  /* -------------------------------------------------------------- esterno
     SDF num referencial próprio: origem no ângulo esternal, +Y ao longo do corpo (para cima), +Z = face de trás.
     Manúbrio (inclinado para trás no ângulo esternal, com a incisura jugular e os cantos das clavículas), corpo
     (mais largo embaixo, bordas recortadas onde entram as cartilagens) e processo xifoide. A pose com a respiração
     é rígida (EV.sternum.pose): `update` só interpola posição e rotação entre o repouso e a inspiração completa. */
  const eixos = p => {
    const ey = p.angle.clone().sub(p.xj).normalize(), ex = new THREE.Vector3(1, 0, 0), ez = new THREE.Vector3().crossVectors(ex, ey);
    return {pos: p.angle.clone(), quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez)), ey, ez};
  };
  const pr = EV.sternum.pose(REST), e0 = eixos(pr), e1 = eixos(EV.sternum.pose(CHEIO));
  const Lc = pr.angle.distanceTo(pr.xj);
  const loc = p => { const d = p.clone().sub(pr.angle); return [d.x, d.dot(e0.ey), d.dot(e0.ez)]; };
  const nl = loc(pr.notch), Lm = Math.hypot(nl[1], nl[2]), beta = Math.atan2(nl[2], nl[1]), cb = Math.cos(beta), sb = Math.sin(beta);
  const xl = loc(pr.xiphoid);
  const yCart = []; for (let i = 3; i <= 7; i++) yCart.push(loc(EV.sternum.attach(i, 1, REST))[1]);
  /* placa de contorno variável: meia-largura w(y), topo top(|x|), base bot, meia-espessura th(|x|, y), bordas de raio r */
  const placa = (w, top, bot, th, r) => (x, y, z) => {
    const ax = Math.abs(x);
    const dx = ax - w(y) + r, dy = Math.max(y - top(ax), bot - y) + r, dz = Math.abs(z) - th(ax, y) + r;
    const mx = dx > 0 ? dx : 0, my = dy > 0 ? dy : 0, mz = dz > 0 ? dz : 0, m = Math.max(dx, dy, dz);
    return Math.sqrt(mx * mx + my * my + mz * mz) + (m < 0 ? m : 0) - r;
  };
  const wCorpo = y => {
    const u = clamp(-y / Lc, 0, 1);                                 // 0 no ângulo, 1 na junção xifoesternal
    let w = lerp(1.72, 1.92, ss(0.1, 0.62, u)) - 0.78 * ss(0.74, 1, u) * ss(0.74, 1, u);
    for (const yc of yCart) w -= 0.10 * bump(y, yc + 0.1, 0.45);     // incisuras costais
    w += 0.07 * bump(y, 0, 0.9);
    return w;
  };
  const corpo = placa(wCorpo, () => 0.25, -Lc - 0.1, (ax, y) => 0.47 - 0.05 * clamp(-y / Lc, 0, 1) - 0.035 * ax * ax, 0.30);
  const wManu = y => { const u = clamp(y / Lm, 0, 1.2); return lerp(1.70, 2.78, ss(0.05, 0.72, u)) - 0.22 * ss(0.8, 1.15, u); };
  const manu0 = placa(wManu, ax => Lm + 0.62 * ss(0.35, 1.75, ax) - 0.25 * ss(1.9, 2.8, ax), -0.3, (ax, y) => 0.50 + 0.10 * ss(0.3, 1, y / Lm) - 0.02 * ax * ax, 0.36);
  const manu = (x, y, z) => manu0(x, y * cb + z * sb, -y * sb + z * cb);
  /* xifoide: lâmina fina que continua o corpo e dobra um pouco para trás, rumo a EV.sternum.xiphoid */
  const xd = Math.hypot(xl[1] + Lc, xl[2]), xcs = -(xl[1] + Lc) / xd, xsn = xl[2] / xd, Lx = xd * 0.92;
  const xif0 = placa(y => 0.16 + 0.62 * Math.sqrt(clamp((y + Lx) / Lx, 0, 1)), () => 0.5, -Lx, () => 0.20, 0.19);   // ponta em arco
  const xif = (x, y, z) => { const yy = y + Lc, c = Math.cos(0.5 * Math.acos(clamp(xcs, -1, 1))), s = Math.sin(0.5 * Math.acos(clamp(xcs, -1, 1))) * (xsn < 0 ? -1 : 1); return xif0(x, yy * c - z * s, yy * s + z * c); };
  const S = EV.sdf;
  const crista = S.capsule([-1.35, 0.02, -0.06], [1.35, 0.02, -0.06], 0.50);        // ressalto do ângulo esternal
  const fEst = S.smooth(0.22, S.smooth(0.35, corpo, manu, crista), xif);
  const esterno = new THREE.Mesh(EV.mesh.fromSDF(fEst,
    {min: [-3.3, -Lc - Lx - 0.8, -1.5], max: [3.3, Lm + 1.6, 2.0], cell: 0.27 / q, ao: true, aoRadius: 1.2, aoStrength: 0.8, exact: true}), EV.mats.bone());
  esterno.castShadow = esterno.receiveShadow = true; group.add(esterno);
  const poeEsterno = b => {
    esterno.position.lerpVectors(e0.pos, e1.pos, b);
    esterno.quaternion.copy(e0.quat).slerp(e1.quat, b);
  };
  poeEsterno(0);

  let ultimo = 0;
  return {group,
    update(state){
      const b = clamp((state && state.breath) || 0, 0, 1.2);
      if (b === ultimo) return;                                     // só a respiração mexe nas costelas
      ultimo = b;
      malhaOsso.morphTargetInfluences[0] = b; malhaCart.morphTargetInfluences[0] = b;
      poeEsterno(b);
    }};
});
})();
