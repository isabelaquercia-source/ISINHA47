/* Peça `ribs` — costelas, cartilagens e esterno (PROVISÓRIO: tubos simples; será refinado).
   Exemplo de uso: EV.mesh.tube com caminho/raio/`up` vindos de EV.ribs.point / radii / frame; no `update`,
   EV.mesh.tubeUpdate reescreve a mesma geometria (respiração). Nada é alocado por quadro: os Vector3 de destino
   (`tmp`) e o referencial (`ref`) são reaproveitados. */
(() => {
EV.register('ribs', ({THREE, EV, quality}) => {
  const group = new THREE.Group(), osso = EV.mats.bone(), cart = EV.mats.cartilage();
  const seg = 44 * quality;                                           // EV.mesh.tube arredonda as resoluções
  const tmp = new THREE.Vector3(), ref = {};
  let st = EV.REST;                                                   // estado usado pelos caminhos abaixo
  const pecas = [];                                                   // {malha, caminho, opts, antes?}
  const tubo = (caminho, opts, mat, antes) => {
    if (antes) antes();
    const malha = new THREE.Mesh(EV.mesh.tube(caminho, opts), mat);
    malha.castShadow = malha.receiveShadow = true; group.add(malha); pecas.push({malha, caminho, opts, antes});
  };
  for (const side of [1, -1]){
    for (let i = 1; i <= 12; i++){
      tubo(t => EV.ribs.point(i, t, side, st, tmp),
        {segments: seg, radial: 8, caps: true, radius: t => EV.ribs.radii(i, t), up: t => EV.ribs.frame(i, t, side, st, ref).up}, osso);
      if (i <= 10){
        /* a cartilagem continua a seção da ponta da costela e afina; o `up` dela é o da ponta da costela,
           constante ao longo do tubo: calculado uma vez por update (função `antes`), não uma vez por anel */
        const fim = EV.ribs.radii(i, 1), upC = new THREE.Vector3();
        tubo(s => EV.ribs.cartilage(i, s, side, st, tmp),
          {segments: 12, radial: 8, radius: s => [EV.lerp(fim[0], 0.42, s), EV.lerp(fim[1], 0.30, s)], up: upC}, cart,
          () => upC.copy(EV.ribs.frame(i, 1, side, st, ref).up));
      }
    }
  }
  /* esterno: SDF num referencial próprio (origem no ângulo esternal, +Y ao longo do corpo, para cima).
     EV.sternum.pose(state) é uma pose rígida: basta reposicionar a malha. */
  const p0 = EV.sternum.pose(), L = p0.angle.distanceTo(p0.xj), Lm = p0.notch.distanceTo(p0.angle), S = EV.sdf;
  const esterno = new THREE.Mesh(EV.mesh.fromSDF(S.smooth(0.8,
      S.box([0, Lm * 0.5, 0.25], [2.9, Lm * 0.5 + 0.3, 0.55], 0.5),                // manúbrio
      S.box([0, -L * 0.5, 0], [1.8, L * 0.5, 0.5], 0.45),                          // corpo
      S.capsule([0, -L, 0], [0, -L - 3.0, 0.4], 0.7, 0.35)),                       // processo xifoide
    {min: [-3.6, -L - 4, -1.4], max: [3.6, Lm + 1.4, 1.6], cell: 0.36 / quality, ao: true}), osso);
  esterno.castShadow = esterno.receiveShadow = true; group.add(esterno);
  const ex = new THREE.Vector3(1, 0, 0), ey = new THREE.Vector3(), ez = new THREE.Vector3(), M = new THREE.Matrix4();
  const poeEsterno = state => {
    const p = EV.sternum.pose(state);
    ey.copy(p.angle).sub(p.xj).normalize(); ez.crossVectors(ex, ey);
    esterno.quaternion.setFromRotationMatrix(M.makeBasis(ex, ey, ez)); esterno.position.copy(p.angle);
  };
  poeEsterno(EV.REST);
  let ultimo = 0;
  return {group,
    update(state){
      const b = state.breath || 0; if (b === ultimo) return;          // só a respiração mexe nas costelas
      ultimo = b; st = state;
      for (const p of pecas){ if (p.antes) p.antes(); EV.mesh.tubeUpdate(p.malha.geometry, p.caminho, p.opts); }
      poeEsterno(state);
    }};
});
})();
