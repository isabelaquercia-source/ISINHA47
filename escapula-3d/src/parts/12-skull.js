/* Peça `skull` — crânio (PROVISÓRIO: elipsoides; será refinado).
   Exemplo de uso: EV.skull dá centro, orientação e escala; a SDF é escrita em cm no referencial local do crânio
   (+X direita, +Y para cima, +Z posterior, origem no centro da calota) e a malha recebe center/quat/scale. */
(() => {
EV.register('skull', ({THREE, EV, quality}) => {
  const S = EV.sdf, sk = EV.skull;
  const lados = f => [f(1), f(-1)];
  const f = S.smooth(1.2,
    S.ellipsoid([0, 0.3, 0.5], [7.3, 6.6, 9.2]),                                   // calota
    S.ellipsoid([0, -4.0, 2.6], [5.6, 3.0, 5.2]),                                  // base / occipital
    S.ellipsoid([0, -4.8, -6.4], [4.9, 4.4, 3.2]),                                 // face (maxila)
    ...lados(s => S.capsule([s * 5.4, -5.0, 1.8], [s * 5.5, -7.0, 1.4], 1.0, 0.6)),          // mastoide
    ...lados(s => S.capsule([s * 6.3, -3.4, -1.2], [s * 5.7, -3.9, -6.4], 0.45)),            // arco zigomático
    ...lados(s => S.capsule([s * 5.0, -4.4, -1.0], [s * 4.8, -9.6, -1.8], 1.0, 0.9)),        // ramo da mandíbula
    ...lados(s => S.capsule([s * 4.8, -9.9, -2.0], [s * 0.8, -11.3, -8.4], 0.9, 1.0)));      // corpo da mandíbula
  const geom = EV.mesh.fromSDF(f, {min: [-8.4, -13, -11], max: [8.4, 7.6, 10.6], cell: 0.48 / quality, ao: true, aoRadius: 2.4, aoColor: [0.50, 0.47, 0.64]});
  /* base do crânio arroxeada (sombra lavanda da referência): cor de vértice mais fria para baixo e nas faces viradas para baixo */
  { const pos = geom.attributes.position.array, nor = geom.attributes.normal.array, cor = geom.attributes.color.array;
    for (let i = 0; i < pos.length; i += 3){
      const w = EV.smoothstep(-0.8, -5.2, pos[i + 1]) * (0.55 + 0.45 * EV.smoothstep(0.3, -0.6, nor[i + 1])) * 0.85 * EV.smoothstep(-3.2, 0.2, pos[i + 2]);   // só o occipital (parte de trás)
      cor[i] *= EV.lerp(1, 0.88, w); cor[i + 1] *= EV.lerp(1, 0.84, w); cor[i + 2] *= EV.lerp(1, 1.75, w);     // (> 1 no azul: compensa a luz quente de baixo)
    } }
  const malha = new THREE.Mesh(geom, EV.mats.bone());
  malha.position.copy(sk.center); malha.quaternion.copy(sk.quat); malha.scale.setScalar(sk.scale);
  malha.castShadow = malha.receiveShadow = true;
  const group = new THREE.Group(); group.add(malha);
  return {group};                                                     // estático
});
})();
