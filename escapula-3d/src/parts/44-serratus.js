/* Peça `serratus` — serrátil anterior (PROVISÓRIO: 9 digitações em tubo achatado; será refinado).
   Exemplo de uso: origem num ponto da costela (EV.ribs.point), inserção na face costal da borda medial
   (EV.scap.medial + toWorld); o caminho reto é empurrado para a superfície do gradil com EV.thorax.wrap e a
   seção achatada fica deitada sobre ele (`up` = tangente à superfície, perpendicular ao caminho).
   Fora da escápula o dedo é gordo; onde passa por baixo da lâmina ele se achata para caber na folga entre o
   osso e as costelas (testado a cada anel, no referencial local da escápula — acompanha os movimentos). */
(() => {
EV.register('serratus', ({THREE, EV, quality}) => {
  const group = new THREE.Group(), mat = EV.mats.muscle({repeat: [1.5, 1]});
  let st = EV.REST;
  /* costela i → [t na costela (parte ântero-lateral; a linha de origem recua para trás conforme desce), t na borda
     medial] (as de baixo convergem para o ângulo inferior) */
  const DIG = {1: [0.70, 0.02], 2: [0.70, 0.08], 3: [0.66, 0.30], 4: [0.64, 0.52], 5: [0.64, 0.74], 6: [0.62, 0.86], 7: [0.60, 0.93], 8: [0.58, 0.97], 9: [0.56, 0.995]};
  const V3 = () => new THREE.Vector3();
  const a = V3(), b = V3(), loc = V3(), p = V3(), q = V3(), tg = V3(), up = V3(), nrm = V3();
  const DENTRO = EV.V(0.9, 0, -0.7);                                  // da borda medial para a face costal (local)
  const SEG = Math.max(1, Math.round(20 * quality));
  /* quanto o ponto q (coordenadas locais da escápula direita) está debaixo da lâmina: 0 fora … 1 dentro */
  const L = EV.scap.L, k = -L.infAngle.y / 13.4, cx = 8.4 * k, cy = -1.7 * k, dx = L.infAngle.x - cx, dy = L.infAngle.y - cy, dl = Math.hypot(dx, dy);
  const sob = v => {
    const lateral = v.y > cy ? 10 * k - v.x : ((v.x - cx) * dy - (v.y - cy) * dx) / dl;      // para dentro da borda lateral
    return EV.smoothstep(-1.2, 0.5, Math.min(lateral, v.x + 0.4, 3.9 * k - v.y));
  };
  const inv = {1: new THREE.Matrix4(), [-1]: new THREE.Matrix4()};
  const poeInv = state => { for (const s of [1, -1]) inv[s].copy(EV.scap.matrix(s, state)).invert(); };
  poeInv(st);
  const digs = [];
  for (const side of [1, -1]) for (let i = 1; i <= 9; i++){
    const u = new Float32Array(SEG + 1);                              // "debaixo da escápula" em cada anel
    const extremos = state => {
      EV.ribs.point(i, DIG[i][0], side, state, a);
      EV.scap.toWorld(EV.scap.medial(DIG[i][1], loc).add(DENTRO), side, state, b);               // face costal, um pouco para dentro da borda
    };
    const afina = t => (0.82 + 0.18 * EV.smoothstep(0, 0.14, t)) * (1 - 0.55 * EV.smoothstep(0.35, 1, t));  // ponta rombuda na costela, afina rumo à inserção
    const meia = (t, s) => EV.lerp(0.8 * afina(t), 0.24, s);                                       // meia-espessura (cm)
    const debaixo = t => { const f = EV.clamp(t, 0, 1) * SEG, n = Math.min(SEG - 1, Math.floor(f)); return EV.lerp(u[n], u[n + 1], f - n); };
    /* ponto do caminho: reta origem→inserção deitada sobre o gradil (margem = meia-espessura + 0,12) */
    const ponto = (t, alvo, s) => EV.thorax.wrap(alvo.copy(a).lerp(b, t), 0.12 + meia(t, s), st, alvo);
    const caminho = t => {
      extremos(st);
      const s = sob(q.copy(a).lerp(b, t).applyMatrix4(inv[side]));
      u[Math.round(t * SEG)] = s;
      return ponto(t, p, s);
    };
    const opts = {segments: SEG, radial: 10, caps: true,
      radius: t => { const s = debaixo(t); return [1.5 * afina(t) * (1 - 0.15 * s), meia(t, s)]; },
      up: t => { extremos(st); const s = debaixo(t); ponto(Math.min(1, t + 0.03), tg, s).sub(ponto(Math.max(0, t - 0.03), q, s)); ponto(t, q, s); return up.crossVectors(EV.thorax.out(q, st, nrm), tg); }};
    const m = new THREE.Mesh(EV.mesh.tube(caminho, opts), mat); m.castShadow = m.receiveShadow = true; group.add(m);
    const comp = state => { extremos(state); return a.distanceTo(b); };
    digs.push({side, i, m, caminho, opts, comp, rest: comp(EV.REST), extremos, ponto, debaixo});
  }
  return {group, tint: [mat],
    update(state){ st = state; poeInv(state); for (const d of digs) EV.mesh.tubeUpdate(d.m.geometry, d.caminho, d.opts); },
    strain(state){ let s = 0; for (const d of digs) s += d.comp(state) / d.rest - 1; return s / digs.length; },
    markers: [{n: 4, label: 'Serrátil anterior', pos: state => { const d = digs[5], r = V3(), old = st; st = state; d.extremos(state); d.ponto(0.34, r, 0); st = old; return r.add(EV.thorax.out(r, state).multiplyScalar(1.4)); }}]};
});
})();
