/* Peça `body` — corpo "fantasma" (PROVISÓRIO: formas simples; será refinado).
   Exemplo de uso: EV.sdf (união suave de elipsoides e cápsulas) → EV.mesh.fromSDF → EV.mats.ghost().
   O material fantasma é desenhado antes de tudo e não escreve profundidade: fica atrás dos ossos e músculos. */
(() => {
EV.register('body', ({THREE, EV, quality}) => {
  const S = EV.sdf, sk = EV.skull, c = sk.center;
  const lados = f => [f(1), f(-1)];
  const corpo = S.smooth(2.5,
    S.ellipsoid([0, 31, -2.3], [14.8, 15.0, 11.0]),                    // tórax
    S.ellipsoid([0, 38.5, -1.5], [17.3, 6.5, 9.6]),                    // cintura escapular
    S.ellipsoid([0, 11, -3.4], [13.6, 14.0, 10.4]),                    // cintura
    S.ellipsoid([0, 2, -4.0], [12.9, 9.0, 10.6]),                      // flancos (liga cintura e quadril sem estrangular)
    S.ellipsoid([0, -6, -4.2], [12.9, 14.0, 11.0]),                    // quadril (a massa da pelve fica à frente da coluna)
    S.ellipsoid([0, -11, 1.5], [11.5, 9.0, 8.0]),                      // glúteos (cobrem o sacro por trás)
    S.capsule([0, 45, -1.0], [0, 60, -1.5], 5.0, 4.8),                 // pescoço
    S.ellipsoid([c.x, c.y - 0.6, c.z - 0.8], [7.9 * sk.scale, 10.2 * sk.scale, 10.0 * sk.scale]),   // cabeça
    ...lados(s => S.capsule([s * 4, 46.3, 0.3], [s * 15.5, 41.4, 0], 4.2, 4.4)),    // trapézio / ombro
    ...lados(s => S.sphere([s * 17.8, 38.8, -1], 5.0)),                              // deltoide
    ...lados(s => S.capsule([s * 19.3, 36, -1], [s * 22.6, 8, -2.5], 3.5, 2.9)),    // braço (um pouco afastado do tronco)
    ...lados(s => S.capsule([s * 22.6, 8, -2.5], [s * 20.5, -15, -5.5], 2.9, 2.4))  // antebraço
  );
  const geom = EV.mesh.fromSDF(corpo, {min: [-29.5, -19.5, -15], max: [29.5, 80, 13.5], cell: 1.25 / quality});
  const malha = new THREE.Mesh(geom, EV.mats.ghost());
  const group = new THREE.Group(); group.add(malha);
  return {group};                                                     // estático: sem update
});
})();
