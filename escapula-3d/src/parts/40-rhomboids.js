/* Peça `rhomboids` — romboide menor e maior + faixa tendínea (PROVISÓRIO; será refinado).
   Exemplo de uso: EV.mesh.sheet com u = origem (processos espinhosos) → inserção (borda medial da escápula),
   v = de cima para baixo; no `update`, EV.mesh.sheetUpdate. EV.thorax.wrap mantém a lâmina fora do gradil. */
(() => {
EV.register('rhomboids', ({THREE, EV, quality}) => {
  const group = new THREE.Group(), tendao = EV.mats.tendon({repeat: [2, 1]});
  const mat = EV.mats.muscle({repeat: [1, 1.5], color: new THREE.Color(0.80, 0.78, 0.76)});   // lâmina larga de frente para a luz: um pouco mais escura
  let st = EV.REST;
  const ponta = n => EV.spine.v(n).spinousTip;
  /* cada lâmina: linha de origem nos espinhosos + trecho [ta, tb] da borda medial */
  const t12 = ponta('T1').clone().lerp(ponta('T2'), 0.1);              // divisa menor/maior na linha dos espinhosos
  const defs = [
    {nome: 'menor', n: 2, label: 'Romboide menor', origem: EV.curve([ponta('C7'), ponta('T1'), t12]), ta: 0.14, tb: 0.275, esp: 0.75},
    {nome: 'maior', n: 3, label: 'Romboide maior', origem: EV.curve([t12, ponta('T3'), ponta('T4'), ponta('T5')]), ta: 0.275, tb: 0.985, esp: 0.85}];
  const o = new THREE.Vector3(), ins = new THREE.Vector3(), loc = new THREE.Vector3(), p = new THREE.Vector3(), nrm = new THREE.Vector3();
  const laminas = [];
  for (const side of [1, -1]) for (const d of defs){
    const fibra = (v, state) => {                                      // extremos da fibra v: escreve em `o` e `ins`
      d.origem.at(v, o); o.x += side * 0.35; o.z += 0.1;
      EV.scap.toWorld(EV.scap.medial(EV.lerp(d.ta, d.tb, v), loc), side, state, ins);
    };
    const opts = {rows: 22 * quality, cols: (d.nome === 'maior' ? 16 : 8) * quality, thickness: d.esp,                  // EV.mesh.sheet arredonda
      point: (u, v) => { fibra(v, st); return EV.thorax.wrap(p.copy(o).lerp(ins, u), 1.2, st, p); },
      normal: (u, v) => { fibra(v, st); return EV.thorax.out(p.copy(o).lerp(ins, u), st, nrm); }};
    const m = new THREE.Mesh(EV.mesh.sheet(opts), mat); m.castShadow = m.receiveShadow = true; group.add(m);
    const comp = state => { let s = 0; for (let k = 1; k < 6; k++){ fibra(k / 6, state); s += o.distanceTo(ins); } return s / 5; };
    laminas.push({side, d, m, opts, comp, rest: comp(EV.REST), fibra});
  }
  /* faixa tendínea creme sobre os processos espinhosos de C7 a T5 */
  const linha = EV.curve(['C7', 'T1', 'T2', 'T3', 'T4', 'T5'].map(ponta));
  /* mais larga em cima (~2 cm em C7) e afilando até a ponta de T5, como na referência */
  const faixa = new THREE.Mesh(EV.mesh.sheet({rows: 20, cols: 8, thickness: 0.3,
    point: (u, v) => linha.at(u, p).add(EV.V((v - 0.5) * EV.lerp(2.1, 0.7, u), 0, 0.3)), normal: () => nrm.set(0, 0, 1)}), tendao);
  faixa.castShadow = faixa.receiveShadow = true; group.add(faixa);
  const meio = d => state => { const l = laminas.find(x => x.side === 1 && x.d === d); l.fibra(0.45, state); return o.clone().lerp(ins, 0.5).add(EV.V(0, 0, 0.8)); };
  return {group, tint: [mat],
    update(state){ st = state; for (const l of laminas) EV.mesh.sheetUpdate(l.m.geometry, l.opts); },
    strain(state){ let s = 0; for (const l of laminas) s += l.comp(state) / l.rest - 1; return s / laminas.length; },
    markers: defs.map(d => ({n: d.n, label: d.label, pos: meio(d)}))};
});
})();
