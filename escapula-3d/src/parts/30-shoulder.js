/* Peça `shoulder` — escápulas e clavículas (PROVISÓRIO: placa com espinha; será refinado).
   Exemplo de uso: a escápula é modelada UMA vez em coordenadas locais (EV.scap.L) e posicionada dos dois lados
   com EV.scap.place(malha, side, state); a clavícula é um tubo entre EV.sternum.sc e a articulação acromioclavicular (EV.scap.L.ac → EV.scap.toWorld). */
(() => {
EV.register('shoulder', ({THREE, EV, quality}) => {
  const S = EV.sdf, L = EV.scap.L, group = new THREE.Group(), osso = EV.mats.bone();
  const a = v => [v.x, v.y, v.z];
  const k = -L.infAngle.y / 13.4;                                     // escala em relação às medidas nominais (cm)
  const P = (x, y, z) => [x * k, y * k, z * k];
  const colo = P(8.4, -1.7, -1.0);                                    // colo da escápula (junto da glenoide)
  const f = S.smooth(0.7 * k,
    S.plate(a(L.supAngle), a(L.root), colo, 0.55), S.plate(a(L.root), a(L.infAngle), colo, 0.55),      // corpo
    S.plate(a(L.supAngle), colo, P(8.2, 2.0, -1.4), 0.55),                                             // fossa supraespinal / borda superior
    S.capsule(P(9.0, -3.8, -1.0), a(L.infAngle), 0.55, 0.45),                                          // borda lateral
    S.plate(P(0.2, 0, 0.1), a(L.acromionAngle), P(9.0, -0.5, -0.4), 0.6),                              // espinha (parede)
    S.capsule(P(0.5, 0, 0.3), a(L.acromionAngle), 0.38, 0.7),                                          // crista da espinha
    S.capsule(a(L.acromionAngle), a(L.acromionTip), 0.8, 0.6),                                         // acrômio: borda posterior…
    S.plate(a(L.acromionAngle), a(L.acromionTip), P(10.6, 2.9, -0.4), 0.7),                            // …e a sua prateleira achatada
    S.ellipsoid(a(L.glenoid), [0.9 * k, 1.8 * k, 1.4 * k]),                                            // glenoide
    S.capsule(P(8.6, 1.6, -1.4), P(9.0, 2.6, -3.0), 0.75, 0.65), S.capsule(P(9.0, 2.6, -3.0), a(L.coracoidTip), 0.65, 0.5));   // coracoide
  /* atenção: placas finas somem se a célula for maior que ~0,7 × a espessura; por isso a célula não cresce tanto no celular */
  const geom = EV.mesh.fromSDF(f, {min: [-1.2, -13.6, -6.2], max: [14.4, 5.6, 4.6], cell: 0.3 / Math.sqrt(quality), ao: true});
  const lados = [1, -1].map(side => {
    const esc = new THREE.Mesh(geom, osso); esc.castShadow = esc.receiveShadow = true; group.add(esc);
    /* clavícula: em S (2/3 mediais convexos para a frente, 1/3 lateral para trás) */
    const sc = new THREE.Vector3(), ac = new THREE.Vector3(), p = new THREE.Vector3();
    const caminho = t => {                                             // reaproveita `p`: nada é alocado no update
      p.copy(sc).lerp(ac, t); p.y += 0.3 * Math.sin(Math.PI * t);
      p.z += t < 0.62 ? -1.5 * Math.sin(Math.PI * t / 0.62) : 1.1 * Math.sin(Math.PI * (t - 0.62) / 0.38);
      return p;
    };
    const opts = {segments: 28 * quality, radial: 10, caps: true, radius: t => { const k = 0.52 + 0.22 * Math.pow(Math.abs(t - 0.45) * 2, 2); return [k, k * 0.85]; }};
    const pega = state => { EV.sternum.sc(side, state, sc); EV.scap.toWorld(L.ac, side, state, ac); };        // extremos: esterno e acrômio (escritos em sc/ac)
    pega(EV.REST);
    const clav = new THREE.Mesh(EV.mesh.tube(caminho, opts), osso); clav.castShadow = clav.receiveShadow = true; group.add(clav);
    return {side, esc, clav, caminho, opts, pega};
  });
  return {group,
    update(state){
      for (const l of lados){
        EV.scap.place(l.esc, l.side, state);
        l.pega(state); EV.mesh.tubeUpdate(l.clav.geometry, l.caminho, l.opts);
      }
    }};
});
})();
