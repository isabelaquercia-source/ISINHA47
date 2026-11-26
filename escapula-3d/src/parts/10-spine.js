/* Peça `spine` — coluna (PROVISÓRIO: blocos arredondados com processos; será refinado).
   Exemplo de uso: EV.spine.v(nome) dá posição/orientação de cada vértebra; cada uma é modelada por uma SDF
   em coordenadas LOCAIS (+X direita, +Y cranial, +Z posterior) e posicionada com pos/quat. */
(() => {
EV.register('spine', ({THREE, EV, quality}) => {
  const S = EV.sdf, group = new THREE.Group();
  const osso = EV.mats.bone(), disco = EV.mats.cartilage({color: EV.srgb(0xe4d59c)});
  const add = (geom, mat, v) => { const m = new THREE.Mesh(geom, mat); m.position.copy(v.pos); m.quaternion.copy(v.quat); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const nomes = EV.spine.levels.filter(n => n !== 'S1');
  nomes.forEach((nome, k) => {
    const v = EV.spine.v(nome), R = v.bodyR, h = v.height;
    const inv = v.quat.clone().invert();
    const loc = p => { const q = p.clone().sub(v.pos).applyQuaternion(inv); return [q.x, q.y, q.z]; };
    const sp = loc(v.spinousTip), tp = loc(v.tpTip(1)), tpE = [-tp[0], tp[1], tp[2]];
    const f = S.smooth(0.5,
      S.box([0, 0, 0], [R, h * 0.36, R * 0.8], R * 0.45),                       // corpo
      S.capsule([R * 0.6, 0, R * 0.7], [0, 0, R + 1.2], 0.5, 0.6),              // arco (lâminas)
      S.capsule([-R * 0.6, 0, R * 0.7], [0, 0, R + 1.2], 0.5, 0.6),
      S.capsule([0, 0, R + 1.0], sp, 0.6, 0.38),                                // processo espinhoso
      S.capsule([R * 0.6, 0, R * 0.6], tp, 0.5, 0.36),                          // processos transversos
      S.capsule([-R * 0.6, 0, R * 0.6], tpE, 0.5, 0.36));
    const lx = Math.abs(tp[0]) + 0.8;
    add(EV.mesh.fromSDF(f, {min: [-lx, Math.min(sp[1], -h * 0.5) - 0.8, -R - 0.6], max: [lx, h * 0.5 + 0.9, sp[2] + 0.8], cell: 0.34 / quality, ao: true}), osso, v);
    /* disco entre esta vértebra e a de baixo */
    const baixo = EV.spine.v(EV.spine.levels[v.index + 1]);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.95, baixo.bodyR * 0.95, h * 0.3, 20), disco);
    d.position.copy(v.pos).lerp(baixo.pos, nome === 'L5' ? 0.42 : 0.5); d.quaternion.copy(v.quat).slerp(baixo.quat, 0.5); d.scale.z = 0.8;
    d.castShadow = d.receiveShadow = true; group.add(d);
  });
  /* sacro + cóccix no referencial de S1 (o −Y local desce para trás, acompanhando a inclinação do sacro) */
  const s1 = EV.spine.v('S1');
  const asa = s1.quat.clone().invert(), tpS = s1.tpTip(1).sub(s1.pos).applyQuaternion(asa);      // ponta da asa (local)
  const W = tpS.x, ya = tpS.y - 0.9;                                    // meia-largura e altura das asas
  const sacro = S.smooth(1.0,
    S.plate([-W + 0.9, ya, tpS.z + 0.8], [W - 0.9, ya, tpS.z + 0.8], [0, -6.5, 1.0], 2.2),                             // parte de cima (larga, como um escudo)
    S.plate([-4.8, -3.0, 0.9], [4.8, -3.0, 0.9], [0, -13.0, 0.3], 1.9),                                    // parte de baixo (ainda larga; curva para a frente)
    S.box([0, 0.2, -0.4], [2.7, 0.9, 1.9], 0.8),                                                           // corpo de S1 (promontório)
    S.ellipsoid([W - 2.3, ya - 0.3, tpS.z + 0.6], [2.0, 2.4, 1.7]), S.ellipsoid([-W + 2.3, ya - 0.3, tpS.z + 0.6], [2.0, 2.4, 1.7]),   // asas
    S.capsule([0, 0.4, 2.2], [0, -8.5, 2.0], 0.7, 0.45),                                                   // crista mediana
    S.capsule([0, -12.5, 0.3], [0, -15.5, -2.0], 0.75, 0.35));                                             // cóccix
  add(EV.mesh.fromSDF(sacro, {min: [-W - 1.2, -17, -4.2], max: [W + 1.2, 3.4, 4.2], cell: 0.4 / quality, ao: true}), osso, s1);
  return {group};                                                     // estático
});
})();
