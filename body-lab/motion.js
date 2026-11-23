/** Exercise motion — zero CDN dependency (rAF + SVG transforms) */
window.BodyMotion = (() => {
  const loops = new Set();

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function killAll() {
    loops.forEach((id) => cancelAnimationFrame(id));
    loops.clear();
  }

  function q(root, sel) {
    return root.querySelector(sel);
  }

  function setXform(el, { x = 0, y = 0, r = 0, sx = 1 } = {}) {
    if (!el) return;
    el.style.transformOrigin = el.dataset.origin || "50% 0%";
    el.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scaleX(${sx})`;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /** ping-pong 0→1→0 over durationMs */
  function cycle(durationMs, hold = 0.08) {
    const t = (performance.now() % durationMs) / durationMs;
    if (t < 0.45) return easeInOut(t / 0.45);
    if (t < 0.45 + hold) return 1;
    if (t < 0.9 + hold) return 1 - easeOut((t - 0.45 - hold) / 0.45);
    return 0;
  }

  function parts(root) {
    const p = {
      root: q(root, ".b-root"),
      head: q(root, ".b-head"),
      torso: q(root, ".b-torso"),
      hip: q(root, ".b-hip"),
      thighL: q(root, ".b-thigh-l"),
      thighR: q(root, ".b-thigh-r"),
      shinL: q(root, ".b-shin-l"),
      shinR: q(root, ".b-shin-r"),
      armL: q(root, ".b-arm-l"),
      armR: q(root, ".b-arm-r"),
      forearmL: q(root, ".b-forearm-l"),
      forearmR: q(root, ".b-forearm-r"),
      bar: q(root, ".b-bar"),
      shadow: q(root, ".b-shadow"),
      muscle: q(root, ".b-muscle"),
      legF: q(root, ".b-leg-f"),
      legB: q(root, ".b-leg-b"),
    };
    if (p.head) p.head.dataset.origin = "50% 100%";
    if (p.shadow) p.shadow.dataset.origin = "50% 50%";
    return p;
  }

  function loop(fn) {
    let id;
    const tick = () => {
      fn();
      id = requestAnimationFrame(tick);
      loops.add(id);
    };
    id = requestAnimationFrame(tick);
    loops.add(id);
  }

  function squat(root, { intensity = 1 } = {}) {
    const p = parts(root);
    const i = intensity;
    loop(() => {
      const t = cycle(2400);
      setXform(p.hip, { y: 48 * i * t });
      setXform(p.thighL, { r: 58 * i * t });
      setXform(p.thighR, { r: -58 * i * t });
      setXform(p.shinL, { r: -64 * i * t });
      setXform(p.shinR, { r: 64 * i * t });
      setXform(p.torso, { r: 10 * i * t, y: 4 * t });
      setXform(p.head, { r: -8 * i * t });
      setXform(p.armL, { r: -12 * i * t });
      setXform(p.armR, { r: 12 * i * t });
      setXform(p.shadow, { sx: 1 + 0.3 * t });
      if (p.muscle) p.muscle.style.opacity = String(0.7 + 0.3 * t);
    });
  }

  function lunge(root, { intensity = 1 } = {}) {
    const p = parts(root);
    const i = Math.min(intensity, 1.05);
    loop(() => {
      const t = cycle(2600);
      setXform(p.root, { x: -6 * t });
      setXform(p.hip, { y: 22 * i * t });
      setXform(p.thighL, { r: 42 * i * t });
      setXform(p.shinL, { r: -48 * i * t });
      setXform(p.thighR, { r: -22 * i * t });
      setXform(p.shinR, { r: 8 * i * t });
      setXform(p.torso, { r: 5 * i * t });
      setXform(p.armL, { r: -28 * i * t });
      setXform(p.armR, { r: 24 * i * t });
    });
  }

  function deadlift(root) {
    const p = parts(root);
    if (p.bar) p.bar.style.opacity = "1";
    loop(() => {
      const t = cycle(2500, 0.12);
      setXform(p.torso, { r: 42 * t, y: 10 * t });
      setXform(p.hip, { y: 10 * t });
      setXform(p.head, { r: -10 * t });
      setXform(p.thighL, { r: 18 * t });
      setXform(p.thighR, { r: -18 * t });
      setXform(p.armL, { r: 6 * t });
      setXform(p.armR, { r: -6 * t });
      setXform(p.bar, { y: 36 + 16 * t });
    });
  }

  function press(root) {
    const p = parts(root);
    if (p.bar) {
      p.bar.style.opacity = "1";
      p.bar.dataset.origin = "50% 50%";
    }
    loop(() => {
      const t = cycle(2300, 0.1);
      setXform(p.armL, { r: -150 * t });
      setXform(p.armR, { r: 150 * t });
      setXform(p.forearmL, { r: lerp(-95, -15, t) });
      setXform(p.forearmR, { r: lerp(95, 15, t) });
      setXform(p.bar, { y: lerp(-88, -168, t), sx: 0.72 });
      setXform(p.torso, { y: -3 * t });
    });
  }

  function plank(root) {
    const p = parts(root);
    loop(() => {
      const t = (Math.sin(performance.now() / 700) + 1) / 2;
      setXform(p.torso, { y: -4 * t });
      setXform(p.head, { y: -3 * t, r: -5 * t });
      setXform(p.legF, { y: 2 * t });
      setXform(p.legB, { y: -2 * t });
      if (p.muscle) p.muscle.style.opacity = String(0.6 + 0.4 * t);
    });
  }

  function bootStage(stage) {
    killAll();
    if (!stage || prefersReduced()) return;
    const map = { squat, lunge, deadlift, press, plank };
    stage.querySelectorAll(".fig-athlete[data-motion]").forEach((el, i) => {
      const kind = el.dataset.motion;
      const intensity = Number(el.dataset.intensity || 1);
      const delay = (Number(el.dataset.delay || 0) + i * 0.05) * 1000;
      const fn = map[kind] || squat;
      setTimeout(() => fn(el, { intensity }), delay);
    });
  }

  return { squat, lunge, deadlift, press, plank, bootStage, killAll };
})();
