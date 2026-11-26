/* Peça `levator` — elevador da escápula (PROVISÓRIO: 4 cordões; será refinado).
   Exemplo de uso: EV.mesh.tube com caminho em função de t; origem nos processos transversos de C1–C4
   (EV.spine.v(n).tpTip), inserção no ângulo superior / borda medial alta (EV.scap.medial + EV.scap.toWorld).
   Os 4 cordões saem cada um do seu processo transverso e logo se juntam num feixe que desce colado ao pescoço
   (o "tronco" comum, do transverso de C1 ao ângulo superior) e só abre de novo na inserção. */
(() => {
EV.register('levator', ({THREE, EV, quality}) => {
  const group = new THREE.Group(), mat = EV.mats.muscle({repeat: [2, 1]});
  let st = EV.REST;
  const V3 = () => new THREE.Vector3();
  const a = V3(), b = V3(), loc = V3(), p = V3(), g = V3(), g0 = V3(), a1 = V3(), b1 = V3();
  const NIVEIS = ['C1', 'C2', 'C3', 'C4'], ENTRA = [0, 0.13, 0.24, 0.34];     // onde cada cordão entra no tronco (fração do tronco)
  /* origens (a coluna não se mexe): guardadas uma vez — tpTip() devolve uma cópia nova a cada chamada */
  const origem = {}; for (const s of [1, -1]) for (const n of NIVEIS){ const o = EV.spine.v(n).tpTip(s); o.z += 0.5; origem[n + s] = o; }
  const cordoes = [];
  for (const side of [1, -1]){
    /* tronco comum: reta de C1 ao ângulo superior, arqueada para dentro e para a frente (junto do pescoço) */
    const tronco = (s, state, out) => {
      a1.copy(origem['C1' + side]);
      EV.scap.toWorld(EV.scap.medial(0.035, loc), side, state, b1);
      const w = Math.sin(Math.PI * Math.pow(s, 1.8));
      out.copy(a1).lerp(b1, s); out.x -= side * 3.0 * w; out.z -= 1.6 * w;
      return out;
    };
    NIVEIS.forEach((nome, k) => {
      const extremos = state => {                                     // escreve origem em `a` e inserção em `b`
        a.copy(origem[nome + side]);
        EV.scap.toWorld(EV.scap.medial(0.01 + 0.017 * k, loc), side, state, b);
      };
      const caminho = t => {
        extremos(st);
        const s = ENTRA[k] + (1 - ENTRA[k]) * t;
        tronco(s, st, p);
        const sai = 1 - EV.smoothstep(0, 0.45, t), chega = EV.smoothstep(0.62, 1, t);
        p.addScaledVector(a.sub(tronco(ENTRA[k], st, g0)), sai);       // sai do seu processo transverso…
        p.addScaledVector(b.sub(tronco(1, st, g)), chega);             // …e chega ao seu ponto da borda medial
        p.x += side * (k - 1.5) * 0.3 * (1 - sai) * (1 - chega);       // lado a lado dentro do feixe
        return EV.thorax.wrap(p, 0.7, st, p);
      };
      const opts = {segments: 22 * quality, radial: 8, caps: true, radius: t => 0.18 + 0.2 * Math.sin(Math.PI * Math.pow(t, 0.8))};
      const m = new THREE.Mesh(EV.mesh.tube(caminho, opts), mat); m.castShadow = m.receiveShadow = true; group.add(m);
      const comp = state => { extremos(state); return a.distanceTo(b); };
      cordoes.push({side, m, caminho, opts, comp, rest: comp(EV.REST), extremos});
    });
  }
  return {group, tint: [mat],
    update(state){ st = state; for (const c of cordoes) EV.mesh.tubeUpdate(c.m.geometry, c.caminho, c.opts); },
    strain(state){ let s = 0; for (const c of cordoes) s += c.comp(state) / c.rest - 1; return s / cordoes.length; },
    markers: [{n: 1, label: 'Elevador da escápula', pos: state => { const c = cordoes[1], q = V3(), old = st; st = state; q.copy(c.caminho(0.74)); st = old; return q.add(EV.V(0.5, 0, 1.2)); }}]};
});
})();
