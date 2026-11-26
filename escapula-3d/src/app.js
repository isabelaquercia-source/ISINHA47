(() => {
  const canvas = document.getElementById('ev-canvas');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, preserveDrawingBuffer:true});
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 1, 1000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8877aa, .7)); const d = new THREE.DirectionalLight(0xffffff, 1); d.position.set(-30,60,80); scene.add(d);
  const timings = {}, errors = [];
  for (const n in EV.parts){ const t = performance.now(); try { scene.add(EV.parts[n]({THREE, EV}).group); } catch (e) { errors.push(n + ': ' + e.message); } timings[n] = Math.round(performance.now() - t); }
  window.EVAPP = {timings, errors, ready: Promise.resolve(), shot(o){ o = o || {}; const w = o.width || 876, h = o.height || 1200;
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; camera.aspect = w/h; camera.updateProjectionMatrix();
    camera.position.set(40, 10, 90); camera.lookAt(0,0,0); renderer.render(scene, camera); return canvas.toDataURL('image/png'); }};
})();
