/* Peça `rhomboids` — romboide menor (marcador 2) e romboide maior (marcador 3) dos dois lados + faixa tendínea
   creme sobre os processos espinhosos.

   Como é montado
   - LINHA DE ORIGEM: uma curva no plano mediano pelas pontas dos processos espinhosos, de pouco acima de C7
     (ligamento nucal) até a ponta de T5. `g` (0..1) é a fração do comprimento dela; T1 fica em `gT1`: acima é o
     romboide MENOR, abaixo o MAIOR.
   - INSERÇÃO: a borda medial da escápula (EV.scap.medial): o menor do ângulo superior até a raiz da espinha, o
     maior da raiz até o ângulo inferior. As fibras descem paralelas, de dentro e de cima para fora e para baixo.
   - Cada LÂMINA é uma casca própria (não usa EV.mesh.sheet): u = origem → inserção (direção das fibras),
     v = de cima para baixo. A superfície de base é a reta origem → inserção, mantida por fora do gradil por um
     "wrap" suave; sobre ela vai a espessura: aponeurose fina na origem, ventre almofadado, afinando na inserção.
     O maior passa um pouco por baixo do menor (que fica mais saliente); a cor de vértice escurece o sulco entre
     os dois, a inserção sob o lábio do osso e a face de dentro.
   - TEXTURA própria (canvas, espaço uv da lâmina; uv.y = g): estrias finas de vários tons de laranja ao longo das
     fibras e, junto da origem, a aponeurose creme que entra no laranja em franjas ("em pena"). As cores vêm de
     EV.pal. O relevo (bumpMap) é pintado junto, com o mesmo desenho.
   - FAIXA TENDÍNEA: é a própria aponeurose das duas lâminas, que se encontram no plano mediano sem emenda (a borda
     de origem é aberta e fica exatamente em x = 0, com a normal no plano sagital); uma crista baixa ao longo das
     pontas dos espinhosos faz o ligamento supraespinal. A faixa acaba logo acima da ponta de T5, que fica à mostra.
   - LUZ PINTADA: a cor de vértice traz também um gradiente medido na referência (mais claro em cima e perto da
     faixa, mais escuro embaixo e junto da escápula). Com o mapa de tons do app a luz sozinha quase não dá esse
     contraste; se a iluminação do app mudar, é em `luz` (dentro de criaLamina) que se reequilibra.
   - O lado esquerdo é a MESMA malha do direito (mesmos atributos de posição/normal/cor), desenhada com escala −1
     em X: `update` calcula um lado só. Só o uv muda, para cada lado usar a sua metade da textura.
   - `update(state)`: só reescreve position/normal. A retração encurta e engrossa o ventre; a protração estica e
     afina (volume aproximadamente conservado). */
(() => {
EV.register('rhomboids', ({THREE, EV, quality}) => {
  const T = THREE, {clamp, lerp, smoothstep} = EV;
  const q = clamp(quality || 1, 0.3, 1), group = new T.Group();
  const ponta = n => EV.spine.v(n).spinousTip;                       // congelado: sempre .clone() antes de mexer
  const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  /* ------------------------------------------------------------------ medidas (cm) */
  const Z0 = 0.03;                        // a base da lâmina passa logo atrás das pontas dos espinhosos (que ficam cobertas)
  const CRISTA = 0.04, CRISTA_L = 0.7;    // crista baixa sobre as pontas (ligamento supraespinal): altura e meia-largura
  const UA = 0.16, TA = 0.34;             // textura: os primeiros 16% da fibra (aponeurose e franja) ocupam 34% da largura
  const INS = [0.14, 0, -0.22];           // inserção, em coordenadas locais da escápula: um pouco para dentro do osso e pelo lado costal da borda
  const T_MENOR = [0.07, 0.225], T_MAIOR_FIM = 0.968;                  // trechos da borda medial (t de EV.scap.medial)
  const SOBRE = 0.36;                     // quanto o maior passa por baixo do menor
  const FO = 0.72, FI = 0.28;             // fração da espessura para fora / para dentro da superfície de base
  const MARGEM = 1.0, SUAVE = 0.6;        // folga mínima da base sobre o gradil e largura da transição do "wrap"
  const ARCO = 0.14;                      // abaulamento da lâmina para trás (ela passa por cima dos eretores)

  /* ---------------------------------------------------------- linha de origem */
  const apice = ponta('C7').clone().lerp(ponta('C6'), 0.3);
  const fim = ponta('T5').clone().lerp(ponta('T4'), 0.17);         // a faixa acaba ~0,5 cm acima da ponta de T5
  const linha = EV.curve([apice, ponta('C7').clone(), ponta('T1').clone(), ponta('T2').clone(), ponta('T3').clone(), ponta('T4').clone(), fim]);
  const _v = new T.Vector3(), _w = new T.Vector3(), _l = new T.Vector3(), _t = new T.Vector3();
  let gT1 = 0.2;
  { let dm = 1e9; const t1 = ponta('T1'); for (let k = 0; k <= 400; k++){ const d = linha.at(k / 400, _v).distanceToSquared(t1); if (d < dm){ dm = d; gT1 = k / 400; } } }
  const LG = linha.length, MED = 16.2;                                 // comprimentos da origem e (aprox.) da borda medial
  /* espessura ao longo da fibra: aponeurose fina → ventre → inserção */
  const perfilU = u => 0.42 + 0.58 * smoothstep(0, 0.42, u) - 0.50 * smoothstep(0.58, 1, u);
  const defs = [
    {nome: 'menor', n: 2, label: 'Romboide menor', g: [0, gT1], t: T_MENOR, C: 16, ev: [0.07, 0.12], marca: [0.47, 0.75],
      esp: (u, v) => 0.76 * perfilU(u)},
    {nome: 'maior', n: 3, label: 'Romboide maior', g: [gT1 - SOBRE / LG, 1], t: [T_MENOR[1] - SOBRE / MED, T_MAIOR_FIM], C: 48, ev: [SOBRE / LG / (1 - gT1 + SOBRE / LG), 0.028], marca: [0.52, 0.57],
      esp: (u, v) => 0.72 * perfilU(u) * (0.66 + 0.34 * smoothstep(0.03, 0.17, v)) * (1 - 0.3 * smoothstep(0.8, 1, v))}];

  /* eixo do tórax (z do centro por altura), amostrado uma vez: o "wrap" suave do update não aloca nada */
  const [TY0, TY1] = EV.thorax.range(), TZ = new Float64Array(Math.round((TY1 - TY0) * 2) + 1);
  for (let k = 0; k < TZ.length; k++) TZ[k] = EV.thorax.center(TY0 + k * 0.5).z;
  const zc = y => { const f = clamp((y - TY0) * 2, 0, TZ.length - 1.001), k = Math.floor(f); return TZ[k] + (TZ[k + 1] - TZ[k]) * (f - k); };

  /* ------------------------------------------------------------------ textura */
  const uTex = u => u < UA ? u * TA / UA : TA + (u - UA) * (1 - TA) / (1 - UA);     // u da fibra → uv.x (mais resolução junto da origem)
  /* alcance lateral (cm) da fibra em repouso para cada g: a franja creme é pintada em cm de distância à linha média */
  const FIB = new Float64Array(129);
  for (let k = 0; k <= 128; k++){
    const g = k / 128, d = g < gT1 ? defs[0] : defs[1], v = clamp((g - d.g[0]) / (d.g[1] - d.g[0]), 0, 1);
    FIB[k] = EV.scap.toWorld(EV.scap.medial(lerp(d.t[0], d.t[1], v), _l), 1, EV.REST, _w).x;
  }
  const fibra0 = g => FIB[Math.round(clamp(g, 0, 1) * 128)];
  /* meia-largura (cm) da faixa creme: leque largo no alto do menor, ~0,9 cm ao longo do maior, afinando no fim */
  const cremeCm = g => g < gT1 ? lerp(1.2, 0.8, smoothstep(0, 1, g / gT1)) : 0.9 - 0.16 * smoothstep(0.88, 1, g);
  function pintaTextura(){
    const Wd = q < 0.7 ? 256 : 512, Hd = q < 0.7 ? 512 : 1024, sx = Wd / 512, sy = Hd / 1024;
    /* atlas com duas metades, uma para cada lado do corpo (desenhos diferentes: de costas, a faixa e as estrias não
       ficam espelhadas). A metade do lado esquerdo é pintada ao contrário (origem em x = 1), de modo que no meio do
       atlas as duas se encontram pela ponta da inserção e as origens creme ficam nas bordas de fora. */
    const tela = () => { const c = document.createElement('canvas'); c.width = Wd * 2; c.height = Hd; return c; };
    const cc = tela(), cb = tela(), x = cc.getContext('2d'), b = cb.getContext('2d');
    const M = EV.pal.muscle, Tn = EV.pal.tendon;
    const memo = new Map();                                            // as mesmas misturas de cor se repetem milhares de vezes
    const mix = (a, c, t) => { const k = a + '|' + c + '|' + t; let r = memo.get(k); if (!r){ r = new T.Color(a).lerp(new T.Color(c), t).getStyle(); memo.set(k, r); } return r; };
    const rgba = (c, al) => { const k = c + '@' + al; let r = memo.get(k); if (!r){ r = new T.Color(c).getStyle().replace('rgb', 'rgba').replace(')', ',' + al + ')'); memo.set(k, r); } return r; };
    const X = (cm, L) => uTex(cm / L) * Wd;                           // distância à linha média (cm) → x no canvas
    const laranja = mix(M.base, M.light, 0.55);
    x.lineCap = b.lineCap = 'round';
    for (let lado = 0; lado < 2; lado++){
    const rnd = rng(4021 + 977 * lado);
    for (const c of [x, b]){ c.save(); if (lado){ c.translate(2 * Wd, 0); c.scale(-1, 1); } c.beginPath(); c.rect(0, 0, Wd, Hd); c.clip(); }
    x.globalAlpha = b.globalAlpha = 1;
    x.fillStyle = laranja; x.fillRect(0, 0, Wd, Hd); b.fillStyle = '#808080'; b.fillRect(0, 0, Wd, Hd);
    /* um traço ao longo da fibra (levemente ondulado), pintado na cor e no relevo */
    const traco = (y, x0, len, w, cor, al, claro, alB, amp) => {
      const ph = rnd() * 7, fr = (0.6 + rnd()) * 2 * Math.PI / Wd, passo = 22 * sx;
      for (let k = 0; k < 2; k++){
        const c = k ? b : x;
        c.globalAlpha = Math.min(1, k ? alB : al); c.strokeStyle = k ? (claro ? '#ffffff' : '#000000') : cor; c.lineWidth = w;
        c.beginPath(); c.moveTo(x0, y + Math.sin(ph + x0 * fr) * amp);
        for (let s = passo; s < len + passo; s += passo){ const xx = x0 + Math.min(s, len); c.lineTo(xx, y + Math.sin(ph + xx * fr) * amp); }
        c.stroke();
      }
    };
    const claros = [mix(M.light, '#f58a2a', 0.4), mix(M.light, '#ffb45a', 0.3), M.light], escuros = [mix(M.base, M.dark, 0.6), mix(M.base, M.dark, 0.35), mix(M.base, M.dark, 0.85)];
    /* [quantidade, espessura mín., máx. (px de 1024), opacidade mín., máx., comprimento mín., máx. (fração da largura), ondulação, peso dos claros] */
    const niveis = [[80, 14, 44, 0.06, 0.18, 0.5, 1.3, 3, 1, 0.5], [320, 5, 14, 0.08, 0.22, 0.25, 0.9, 2.5, 0.9, 0.5], [820, 1.5, 4, 0.11, 0.34, 0.1, 0.6, 1.6, 0.45, 0.36]];
    /* manchas largas e suaves (feixes um pouco mais escuros ou mais claros), alongadas no sentido da fibra */
    for (let i = 0; i < 34; i++){
      const cx = rnd() * Wd, cy = rnd() * Hd, r = (10 + 26 * rnd()) * sy, claro = rnd() < 0.4, gr = x.createRadialGradient(0, 0, 0, 0, 0, r), c = claro ? M.light : mix(M.base, M.dark, 0.5);
      gr.addColorStop(0, rgba(c, claro ? 0.16 : 0.22)); gr.addColorStop(1, rgba(c, 0));
      x.save(); x.translate(cx, cy); x.scale(3 + 4 * rnd(), 1); x.fillStyle = gr; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.restore();
    }
    for (const [n, w0, w1, a0, a1, l0, l1, amp, kc, pc] of niveis){
      for (let i = 0; i < n; i++){
        const claro = rnd() < pc, len = Wd * lerp(l0, l1, rnd() * rnd()), al = lerp(a0, a1, rnd()) * (claro ? kc : 1);
        traco(rnd() * Hd, rnd() * (Wd + len) - len, len, lerp(w0, w1, rnd() * rnd()) * sy, (claro ? claros : escuros)[Math.floor(rnd() * 3)], al, claro, al * 1.1, amp * sy * rnd());
      }
    }
    /* pintas escuras curtas, como na referência */
    for (let i = 0; i < 200; i++) traco(rnd() * Hd, rnd() * Wd, (5 + 16 * rnd()) * sx, (1.6 + 1.8 * rnd()) * sy, escuros[Math.floor(rnd() * 3)], 0.2 + 0.25 * rnd(), false, 0.3, 0);
    /* sombra curta na inserção (o músculo mergulha sob o lábio da borda medial) */
    { const gr = x.createLinearGradient(Wd * 0.93, 0, Wd, 0); gr.addColorStop(0, rgba(M.dark, 0)); gr.addColorStop(1, rgba(M.dark, 1));
      x.globalAlpha = 0.45; x.fillStyle = gr; x.fillRect(Wd * 0.93, 0, Wd * 0.07, Hd); }

    /* --- aponeurose creme junto da origem, entrando no laranja "em pena" --- */
    const cremeFora = mix(mix(Tn.base, Tn.dark, 0.4), M.light, 0.1), cremeBorda = mix(mix(Tn.base, Tn.dark, 0.4), M.light, 0.3);
    const f1 = rnd() * 7, f2 = rnd() * 7, f3 = rnd() * 7;
    const beira = g => cremeCm(g) + 0.04 * Math.sin(g * 44 + f1) + 0.035 * Math.sin(g * 107 + f2) + 0.025 * Math.sin(g * 260 + f3);   // beira ondulada (cm)
    /* 1) a faixa: creme claro no meio, mais quente perto da beira; cada fascículo (2 px) acaba num ponto um pouco
          diferente e esfumado (no leque do menor, bem mais esfumado) */
    let passeio = 0;
    for (let y = 0; y < Hd; y += 2){
      passeio = clamp(passeio * 0.72 + (rnd() - 0.5) * 0.16, -0.14, 0.14);
      const g = (y + 1) / Hd, L = fibra0(g), cm = beira(g) + passeio, menor = g < gT1, sf = menor ? lerp(0.6, 0.3, g / gT1) : 0.05 + 0.08 * rnd(), x1 = X(cm + sf, L), k0 = X(Math.max(0.1, cm - sf), L) / x1;
      const gr = x.createLinearGradient(0, 0, x1, 0);
      /* o creme é mais claro no leque do menor e vai ficando mais quente e escuro para baixo, como na referência */
      const meio = menor ? mix(Tn.base, Tn.light, Math.round(30 * (1 - g / gT1)) / 100) : mix(Tn.base, Tn.dark, Math.round(12 + 36 * (g - gT1) / (1 - gT1)) / 100);
      gr.addColorStop(0, meio); gr.addColorStop(k0 * 0.62, mix(meio, cremeFora, 0.6)); gr.addColorStop(k0, rgba(cremeBorda, 0.95)); gr.addColorStop(1, rgba(cremeBorda, 0));
      x.globalAlpha = 1; x.fillStyle = gr; x.fillRect(0, y, x1, 2);
      const gb = b.createLinearGradient(0, 0, x1, 0); gb.addColorStop(0, 'rgba(138,138,138,0.85)'); gb.addColorStop(k0, 'rgba(132,132,132,0.75)'); gb.addColorStop(1, 'rgba(128,128,128,0)');   // relevo: a aponeurose é mais lisa
      b.globalAlpha = 1; b.fillStyle = gb; b.fillRect(0, y, x1, 2);
    }
    /* 2) as franjas: fios creme finos que avançam sobre o laranja, línguas laranja que entram no creme e riscos
          escuros curtos na beira (os fascículos terminam em alturas diferentes e fazem sombra) */
    const dente = (y, hh, xa, xb, cor, al) => { x.globalAlpha = al; x.fillStyle = cor; x.beginPath(); x.moveTo(xa, y - hh); x.lineTo(xb, y + hh * (rnd() - 0.5)); x.lineTo(xa, y + hh); x.closePath(); x.fill(); };
    for (let y = 0; y < Hd;){
      const g = clamp(y / Hd, 0, 1), L = fibra0(g), cm = beira(g), menor = g < gT1, hh = (1.4 + 3 * rnd()) * sy, r = rnd();
      if (r < 0.5){                                                    // fio creme
        const len = (menor ? 0.3 + 0.8 * rnd() : 0.10 + 0.28 * rnd() * rnd() + (rnd() < 0.08 ? 0.25 : 0)), xa = X(cm - 0.15, L), xb = X(cm + len, L);
        const gr = x.createLinearGradient(xa, 0, xb, 0); gr.addColorStop(0, rgba(cremeBorda, 0.9)); gr.addColorStop(0.5, rgba(mix(cremeBorda, Tn.light, 0.3), 0.75)); gr.addColorStop(1, rgba(cremeBorda, 0.1));
        dente(y, hh, xa, xb, gr, menor ? 0.55 : 0.9);
      } else if (r < 0.8 && !menor){                                   // língua laranja para dentro do creme
        const len = 0.08 + 0.24 * rnd(), xa = X(cm + 0.1, L), xb = X(cm - len, L);
        dente(y, hh, xa, xb, mix(laranja, M.base, Math.round(5 * rnd()) / 10), 0.85);
      }
      if (!menor && rnd() < 0.5){                                      // risco escuro
        const xa = X(cm - 0.2 + 0.2 * rnd(), L);
        traco(y + hh, xa, X(cm + 0.08 + 0.26 * rnd(), L) - xa, (1.4 + 2 * rnd()) * sy, escuros[2], 0.38 + 0.34 * rnd(), false, 0.5, 0);
      }
      y += hh * (1.2 + 1.6 * rnd());
    }
    /* 3) fibras discretas dentro do creme */
    for (let i = 0; i < 380; i++){
      const yy = rnd() * Hd, L = fibra0(clamp(yy / Hd, 0, 1)), lim = X(cremeCm(yy / Hd), L), claro = rnd() < 0.5, xa = rnd() * lim * 0.8, len = Math.min(lim * 0.92 - xa, lim * (0.3 + 0.7 * rnd()));
      if (len > 2) traco(yy, xa, len, (1 + 2.2 * rnd()) * sy, claro ? Tn.light : Tn.dark, claro ? 0.28 : 0.12 + 0.12 * rnd(), claro, 0.1, 0.6 * sy);
    }
    /* --- sulco entre o menor e o maior: linha fina e escura (a borda do menor faz sombra sobre o maior) --- */
    { const yc = gT1 * Hd, cm = Hd / LG, cor = mix(M.dark, '#1a0500', 0.3);
      for (let xa = 0; xa < Wd; xa += 8 * sx){                         // em trechos, com a força variando suavemente ao longo do sulco
        const k = 0.78 + 0.12 * Math.sin(xa * 0.045 / sx + f1) + 0.08 * Math.sin(xa * 0.13 / sx + f2), gr = x.createLinearGradient(0, yc - 0.12 * cm, 0, yc + 0.09 * cm);
        gr.addColorStop(0, rgba(cor, 0)); gr.addColorStop(0.4, rgba(cor, 0.8 * k)); gr.addColorStop(0.6, rgba(cor, 0.85 * k)); gr.addColorStop(0.78, rgba(cor, 0.3 * k)); gr.addColorStop(1, rgba(cor, 0));
        x.globalAlpha = 1; x.fillStyle = gr; x.fillRect(xa, yc - 0.12 * cm, 8 * sx, 0.21 * cm);
      } }
    x.restore(); b.restore();
    }
    x.globalAlpha = b.globalAlpha = 1;
    const map = new T.CanvasTexture(cc), bump = new T.CanvasTexture(cb);
    for (const t of [map, bump]){ t.flipY = false; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.anisotropy = 8; }
    map.encoding = T.sRGBEncoding;
    return {map, bump};
  }
  const tex = pintaTextura();
  const mat = EV.mats.muscle({map: tex.map, bumpMap: tex.bump, bump: 0.035});

  /* ------------------------------------------------------------------ lâminas */
  /* n+1 parâmetros em 0..1 com 3 anéis apertados junto de cada borda (perfil circular da borda arredondada).
     `aberta`: a borda 0 não se arredonda (é a emenda no plano mediano) — os anéis ficam, com peso 1. */
  function params(n, e0, e1, aberta){
    const t = new Float64Array(n + 1), w = new Float64Array(n + 1), a = [0, 0.16, 0.5, 1], a0 = aberta ? [0, 1 / 3, 2 / 3, 1] : a;
    for (let k = 0; k <= n; k++){
      const u = k <= 3 ? a0[k] * e0 : k >= n - 3 ? 1 - a[n - k] * e1 : lerp(e0, 1 - e1, (k - 3) / (n - 6));
      const d = Math.min(aberta ? 1 : u / e0, (1 - u) / e1);
      t[k] = u; w[k] = d >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - d) * (1 - d)));
    }
    return {t, w};
  }
  const LUZ_EXP = [1.25, 1, 0.97], LUZ_CREME = [0.95, 1.12, 1.4];      // expoentes por canal: o ventre perde vermelho ao escurecer, o creme fica mais quente
  const SOMBRA = [0.40, 0.21, 0.15];                                   // cor (linear) que multiplica a superfície no fundo dos sulcos
  function criaLamina(d){
    const R = Math.max(14, Math.round(44 * q)), C = Math.max(9, Math.round(d.C * q)), nc = C + 1, n1 = (R + 1) * nc;
    const U = params(R, 0.045, 0.028, true), W = params(C, d.ev[0], d.ev[1]);
    /* por coluna: origem (fixa), inserção local (fixa) e no mundo (por estado), comprimento de repouso */
    const O = new Float64Array(nc * 3), IL = [], IW = new Float64Array(nc * 3), L0 = new Float64Array(nc), kE = new Float64Array(nc), NS = new Float64Array(nc * 2), dS = new Float64Array(nc);
    for (let j = 0; j <= C; j++){
      linha.at(lerp(d.g[0], d.g[1], W.t[j]), _v); O[j * 3] = 0; O[j * 3 + 1] = _v.y; O[j * 3 + 2] = _v.z + Z0;
      linha.tangent(lerp(d.g[0], d.g[1], W.t[j]), _t); const sg = _t.y > 0 ? 1 : -1; NS[j * 2] = -_t.z * sg; NS[j * 2 + 1] = _t.y * sg;     // normal da lâmina no plano sagital (y, z), para trás
      const l = EV.scap.medial(lerp(d.t[0], d.t[1], W.t[j])); l.x += INS[0]; l.y += INS[1]; l.z += INS[2]; IL.push(l);
      EV.scap.toWorld(l, 1, EV.REST, _w); L0[j] = Math.hypot(_w.x - O[j * 3], _w.y - O[j * 3 + 1], _w.z - O[j * 3 + 2]);
    }
    /* por vértice (fixo): espessura de repouso × perfil da borda, abaulamento + crista, peso da variação de espessura */
    const esp = new Float64Array(n1), arco = new Float64Array(n1), kU = new Float64Array(R + 1), cU = new Float64Array(R + 1);
    for (let i = 0; i <= R; i++){
      const u = U.t[i]; kU[i] = smoothstep(0.03, 0.3, u) * (1 - smoothstep(0.8, 0.98, u));
      cU[i] = u * Math.pow(1 - u, 6);                                 // a lâmina sai da linha média sem quina (as duas metades formam uma superfície lisa)
      for (let j = 0; j <= C; j++){
        esp[i * nc + j] = d.esp(u, W.t[j]) * U.w[i] * W.w[j];
        arco[i * nc + j] = ARCO * Math.pow(Math.sin(Math.PI * u), 1.3) + CRISTA * (1 - smoothstep(0, CRISTA_L, u * L0[j])) * W.w[j];
      }
    }
    const g = new T.BufferGeometry(), pos = new Float32Array(n1 * 6), nor = new Float32Array(n1 * 6), cor = new Float32Array(n1 * 6), uv = new Float32Array(n1 * 4), uvE = new Float32Array(n1 * 4);
    for (let i = 0; i <= R; i++) for (let j = 0; j <= C; j++){
      const n = i * nc + j, u = U.t[i], v = W.t[j], gg = lerp(d.g[0], d.g[1], v);
      uv[n * 2] = uv[(n + n1) * 2] = uTex(u) * 0.5; uvE[n * 2] = uvE[(n + n1) * 2] = 1 - uTex(u) * 0.5;          // metade do atlas de cada lado
      uv[n * 2 + 1] = uv[(n + n1) * 2 + 1] = uvE[n * 2 + 1] = uvE[(n + n1) * 2 + 1] = gg;
      /* oclusão pintada: sulco menor/maior, inserção sob o lábio do osso, bordas livres; a face de dentro é mais escura */
      let oc = 0.5 * smoothstep(1 - 0.55 / L0[j], 1, u);
      if (d.nome === 'maior'){ const cm = (gg - gT1) * LG; oc = Math.max(oc, 0.9 * (1 - smoothstep(-0.04, 0.3, cm)), 0.3 * smoothstep(1 - d.ev[1], 1, v)); }
      else oc = Math.max(oc, 0.45 * smoothstep(1 - d.ev[1] * 0.6, 1, v));
      /* luz "de estúdio" pintada: a referência é mais clara em cima e mais escura (e menos vermelha) embaixo; com o
         mapa de tons do app, o vermelho quase não cede, por isso ele cai com expoente maior */
      const cai = smoothstep(0.2, 1.05, gg), wm = smoothstep(0.65, 1.5, u * L0[j] * 0.85);                  // wm: 0 na faixa creme … 1 no ventre
      const luz = lerp(lerp(1.10, 0.54, cai), lerp(0.74, 0.46, cai) * lerp(1.12, 0.88, smoothstep(0.08, 0.9, u)), wm);   // a faixa escurece menos; o ventre é mais claro perto dela
      for (let k = 0; k < 3; k++){ cor[n * 3 + k] = Math.pow(luz, lerp(LUZ_CREME[k], LUZ_EXP[k], wm)) * (1 - oc * (1 - SOMBRA[k])); cor[(n + n1) * 3 + k] = 1 - Math.max(oc, 0.5) * (1 - SOMBRA[k]); }
    }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('color', new T.BufferAttribute(cor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    /* casca: a face de dentro reaproveita os vértices das bordas arredondadas da face de fora; a borda de origem
       (i = 0) fica aberta — quem fecha é a lâmina espelhada do outro lado */
    const borda = (i, j) => i === R || j === 0 || j === C, fo = (i, j) => i * nc + j, fi = (i, j) => borda(i, j) ? fo(i, j) : n1 + fo(i, j);
    const idx = new Uint16Array(R * C * 12);
    let ni = 0;
    const tri = (a, b, c, inv) => { idx[ni++] = a; idx[ni++] = inv ? c : b; idx[ni++] = inv ? b : c; };
    /* no lado direito, com u para fora (+X) e v para baixo (−Y), dP/dv × dP/du aponta para +Z (para trás): é o lado de fora */
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++){
      tri(fo(i, j), fo(i + 1, j), fo(i + 1, j + 1), true); tri(fo(i, j), fo(i + 1, j + 1), fo(i, j + 1), true);
      tri(fi(i, j), fi(i + 1, j), fi(i + 1, j + 1), false); tri(fi(i, j), fi(i + 1, j + 1), fi(i, j + 1), false);
    }
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.boundingSphere = new T.Sphere(new T.Vector3(5, 38, 5), 22);
    /* a geometria do lado esquerdo usa os MESMOS atributos (position, normal, color, índice): só o uv é outro */
    const gE = new T.BufferGeometry();
    for (const k of ['position', 'normal', 'color']) gE.setAttribute(k, g.attributes[k]);
    gE.setAttribute('uv', new T.BufferAttribute(uvE, 2)); gE.setIndex(g.index); gE.boundingSphere = g.boundingSphere.clone();
    const B = new Float64Array(n1 * 3), N = new Float64Array(n1 * 3);
    const atualiza = st => {
      for (let j = 0; j <= C; j++){
        EV.scap.toWorld(IL[j], 1, st, _w); IW[j * 3] = _w.x; IW[j * 3 + 1] = _w.y; IW[j * 3 + 2] = _w.z;
        const L = Math.hypot(_w.x - O[j * 3], _w.y - O[j * 3 + 1], _w.z - O[j * 3 + 2]);
        kE[j] = clamp(Math.pow(L0[j] / Math.max(L, 0.5), 0.85), 0.6, 1.6);
        dS[j] = (_w.y - O[j * 3 + 1]) * NS[j * 2] + (_w.z - O[j * 3 + 2]) * NS[j * 2 + 1];
      }
      /* superfície de base: reta origem → inserção, afastada do gradil por um máximo suave */
      for (let i = 0; i <= R; i++){
        const u = U.t[i], cu = cU[i];
        for (let j = 0; j <= C; j++){
          const a = j * 3, n = (i * nc + j) * 3, ks = cu * dS[j];
          let bx = O[a] + (IW[a] - O[a]) * u; const by = O[a + 1] + (IW[a + 1] - O[a + 1]) * u - NS[j * 2] * ks; let bz = O[a + 2] + (IW[a + 2] - O[a + 2]) * u - NS[j * 2 + 1] * ks;
          const c = EV.thorax.clearance(_v.set(bx, by, bz), st) - MARGEM;
          if (c < SUAVE){
            const h = clamp(0.5 + 0.5 * c / SUAVE, 0, 1), c2 = c * h + SUAVE * h * (1 - h), z0 = zc(by), dz = bz - z0, r = Math.hypot(bx, dz), k = (r + c2 - c) / Math.max(r, 1e-4);
            bx *= k; bz = z0 + dz * k;
          }
          B[n] = bx; B[n + 1] = by; B[n + 2] = bz;
        }
      }
      /* normal da base (diferenças centrais na grade); na origem ela fica no plano sagital, para as duas metades casarem */
      for (let i = 0; i <= R; i++){
        const ia = (i > 0 ? i - 1 : 0) * nc, ib = (i < R ? i + 1 : R) * nc;
        for (let j = 0; j <= C; j++){
          const ja = j > 0 ? j - 1 : 0, jb = j < C ? j + 1 : C, p = (ia + j) * 3, s = (ib + j) * 3, e = (i * nc + ja) * 3, f = (i * nc + jb) * 3, n = (i * nc + j) * 3;
          const ux = B[s] - B[p], uy = B[s + 1] - B[p + 1], uz = B[s + 2] - B[p + 2], vx = B[f] - B[e], vy = B[f + 1] - B[e + 1], vz = B[f + 2] - B[e + 2];
          let x = vy * uz - vz * uy; const y = vz * ux - vx * uz, z = vx * uy - vy * ux;       // dP/dv × dP/du: para trás
          if (i === 0) x = 0;
          const il = 1 / (Math.hypot(x, y, z) || 1);
          N[n] = x * il; N[n + 1] = y * il; N[n + 2] = z * il;
        }
      }
      /* faces de fora e de dentro */
      for (let i = 0; i <= R; i++) for (let j = 0; j <= C; j++){
        const m = i * nc + j, n = m * 3, n2 = n + n1 * 3, k = 1 + (kE[j] - 1) * kU[i], e = esp[m] * k, ar = arco[m] * k;
        const ho = ar + FO * e, hi = ar - FI * e;
        pos[n] = B[n] + N[n] * ho; pos[n + 1] = B[n + 1] + N[n + 1] * ho; pos[n + 2] = B[n + 2] + N[n + 2] * ho;
        pos[n2] = B[n] + N[n] * hi; pos[n2 + 1] = B[n + 1] + N[n + 1] * hi; pos[n2 + 2] = B[n + 2] + N[n + 2] * hi;
      }
      /* normais suaves: soma das normais das faces */
      nor.fill(0);
      for (let t = 0; t < idx.length; t += 3){
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
        nor[a] += x; nor[a + 1] += y; nor[a + 2] += z; nor[b] += x; nor[b + 1] += y; nor[b + 2] += z; nor[c] += x; nor[c + 1] += y; nor[c + 2] += z;
      }
      for (let j = 0; j <= C; j++){ nor[j * 3] = 0; nor[(n1 + j) * 3] = 0; }      // emenda no plano mediano: sem componente lateral
      for (let t = 0; t < nor.length; t += 3){ const il = 1 / (Math.hypot(nor[t], nor[t + 1], nor[t + 2]) || 1); nor[t] *= il; nor[t + 1] *= il; nor[t + 2] *= il; }
      g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    };
    atualiza(EV.REST);
    for (const side of [1, -1]){
      const m = new T.Mesh(side < 0 ? gE : g, mat); m.castShadow = m.receiveShadow = true;
      if (side < 0){ m.scale.x = -1; m.updateMatrix(); }             // lado esquerdo: a mesma malha espelhada (o three.js corrige a face frontal)
      group.add(m);
    }
    /* comprimento médio das fibras num estado (para `strain`) */
    const comp = st => { let s = 0; for (let j = 2; j < C; j += 3){ EV.scap.toWorld(IL[j], 1, st, _w); s += Math.hypot(_w.x - O[j * 3], _w.y - O[j * 3 + 1], _w.z - O[j * 3 + 2]); } return s; };
    /* ponto da superfície de fora em (u, v), lado direito — para o marcador numerado */
    const alvo = new T.Vector3();
    const sobre = (u, v, st) => {
      linha.at(lerp(d.g[0], d.g[1], v), _v); linha.tangent(lerp(d.g[0], d.g[1], v), _t);
      EV.scap.medial(lerp(d.t[0], d.t[1], v), _l); _l.x += INS[0]; _l.z += INS[2]; EV.scap.toWorld(_l, 1, st, _w);
      alvo.copy(_v).lerp(_w, u); _w.sub(_v); _t.cross(_w).normalize(); if (_t.z < 0) _t.negate();
      return alvo.addScaledVector(_t, ARCO + FO * d.esp(u, v) + 0.25);
    };
    return {d, atualiza, comp, rest: comp(EV.REST), sobre};
  }
  const laminas = defs.map(criaLamina);

  let ue = NaN, ur = NaN, uo = NaN, ub = NaN;
  return {group, tint: [mat],
    update(state){
      const e = state.elev || 0, r = state.retr || 0, o = state.rot || 0, b = state.breath || 0;
      if (e === ue && r === ur && o === uo && b === ub) return;        // nada mudou desde o último quadro
      ue = e; ur = r; uo = o; ub = b;
      for (const l of laminas) l.atualiza(state);
    },
    strain(state){ let a = 0, c = 0; for (const l of laminas){ a += l.comp(state); c += l.rest; } return a / c - 1; },
    markers: laminas.map(l => ({n: l.d.n, label: l.d.label, pos: state => l.sobre(l.d.marca[0], l.d.marca[1], state)}))};
});
})();
