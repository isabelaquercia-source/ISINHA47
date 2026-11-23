/** Shared premium IK athletes for the 10 prototypes */
window.Athletes = (() => {
  const loops = new Set();
  let seq = 0;

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function phase(ms, cycle, down, hold) {
    const x = (ms % cycle) / cycle;
    if (x < down) return easeInOut(x / down);
    if (x < down + hold) return 1;
    const u = down + hold;
    if (x < u + down) return 1 - easeInOut((x - u) / down);
    return 0;
  }
  function ik(hipX, hipY, footX, footY, L1, L2) {
    let dx = footX - hipX,
      dy = footY - hipY;
    let d = Math.hypot(dx, dy);
    d = clamp(d, Math.abs(L1 - L2) + 1, L1 + L2 - 1);
    const base = (Math.atan2(dx, dy) * 180) / Math.PI;
    const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    const a = (Math.acos(clamp(cosA, -1, 1)) * 180) / Math.PI;
    const thighDeg = base - a;
    const kneeX = hipX + L1 * Math.sin((thighDeg * Math.PI) / 180);
    const kneeY = hipY + L1 * Math.cos((thighDeg * Math.PI) / 180);
    const shinDeg =
      (Math.atan2(footX - kneeX, footY - kneeY) * 180) / Math.PI - thighDeg;
    return { thighDeg, shinDeg, footDeg: -(thighDeg + shinDeg) };
  }
  function loop(fn) {
    let id;
    const tick = (now) => {
      fn(now);
      id = requestAnimationFrame(tick);
      loops.add(id);
    };
    id = requestAnimationFrame(tick);
    loops.add(id);
  }
  function killAll() {
    loops.forEach((id) => cancelAnimationFrame(id));
    loops.clear();
  }

  function skinGrad(id, c0, c1, c2) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c0}"/><stop offset="55%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient>`;
  }

  function sideAthlete({ gid, accent, tones, dualLeg = false }) {
    const [c0, c1, c2] = tones;
    return `
    <svg class="fig fig-premium" viewBox="0 0 400 560" aria-hidden="true">
      <defs>${skinGrad(gid, c0, c1, c2)}</defs>
      <ellipse class="a-floor" cx="210" cy="522" rx="110" ry="11" fill="${accent}" opacity=".16"/>
      <g class="a-hip" transform="translate(200 300)">
        <g class="a-torso">
          <path d="M-10 0 C-24 20,-30 55,-26 90 C-22 112,-10 124,4 126 L24 118 C30 96,30 68,26 42 C22 18,10 4,0 0 Z" fill="url(#${gid})"/>
          <path class="a-glow" d="M-2 40 C4 58,8 78,10 98" fill="none" stroke="${accent}" stroke-width="3.2" stroke-linecap="round" opacity=".75"/>
          <ellipse cx="6" cy="26" rx="15" ry="12" fill="url(#${gid})"/>
          <g class="a-head" transform="translate(4 -4)">
            <ellipse cx="2" cy="-32" rx="18" ry="21" fill="url(#${gid})"/>
            <circle cx="10" cy="-34" r="2.2" fill="${accent}"/>
          </g>
          <g class="a-arm" transform="translate(18 24)">
            <path d="M0 0 C8 16,12 34,8 52" fill="none" stroke="url(#${gid})" stroke-width="13" stroke-linecap="round"/>
            <g class="a-fore" transform="translate(8 52)">
              <path d="M0 0 C6 14,6 30,2 46" fill="none" stroke="url(#${gid})" stroke-width="11" stroke-linecap="round"/>
              <circle cx="2" cy="52" r="6.5" fill="url(#${gid})"/>
            </g>
          </g>
          ${
            dualLeg
              ? ""
              : `<g class="a-arm2" opacity=".32" transform="translate(-16 20)">
            <path d="M0 0 C-10 18,-14 38,-10 56" fill="none" stroke="${c2}" stroke-width="11" stroke-linecap="round"/>
          </g>`
          }
        </g>
        <g class="a-thighF">
          <path d="M0 4 C-4 34,-2 64,2 94" fill="none" stroke="url(#${gid})" stroke-width="24" stroke-linecap="round"/>
          <g class="a-shinF" transform="translate(2 94)">
            <circle cx="0" cy="0" r="9" fill="url(#${gid})"/>
            <path d="M0 0 C2 28,2 56,0 88" fill="none" stroke="url(#${gid})" stroke-width="18" stroke-linecap="round"/>
            <g class="a-footF" transform="translate(0 88)">
              <path d="M-8 0 C8 4,36 4,50 0 C54 -2,52 -6,44 -8 C24 -10,4 -6,-6 -3 Z" fill="url(#${gid})"/>
            </g>
          </g>
        </g>
        ${
          dualLeg
            ? `<g class="a-thighB">
          <path d="M4 6 C12 32,22 58,34 82" fill="none" stroke="url(#${gid})" stroke-width="22" stroke-linecap="round" opacity=".92"/>
          <g class="a-shinB" transform="translate(34 82)">
            <circle cx="0" cy="0" r="8" fill="url(#${gid})"/>
            <path d="M0 0 C6 24,14 48,22 74" fill="none" stroke="url(#${gid})" stroke-width="16" stroke-linecap="round"/>
            <g class="a-footB" transform="translate(22 74)">
              <path d="M-6 0 C10 2,28 2,38 -2 C42 -4,40 -8,32 -9 C16 -10,2 -6,-4 -3 Z" fill="url(#${gid})"/>
            </g>
          </g>
        </g>`
            : ""
        }
      </g>
      <g class="a-bar" opacity="0">
        <rect x="70" y="430" width="260" height="7" rx="3" fill="${accent}"/>
        <circle cx="70" cy="433.5" r="14" fill="none" stroke="${accent}" stroke-width="3"/>
        <circle cx="330" cy="433.5" r="14" fill="none" stroke="${accent}" stroke-width="3"/>
      </g>
    </svg>`;
  }

  function plankAthlete({ gid, accent, tones }) {
    const [c0, c1] = tones;
    return `
    <svg class="fig fig-premium fig-wide" viewBox="0 0 480 320" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${c0}"/><stop offset="100%" stop-color="${c1}"/>
        </linearGradient>
      </defs>
      <ellipse class="a-floor" cx="240" cy="280" rx="180" ry="11" fill="${accent}" opacity=".16"/>
      <g class="a-body">
        <ellipse class="a-head" cx="378" cy="118" rx="20" ry="17" fill="url(#${gid})"/>
        <path class="a-torso" d="M95 168 C170 138, 260 130, 358 136" fill="none" stroke="url(#${gid})" stroke-width="26" stroke-linecap="round"/>
        <path class="a-glow" d="M160 152 C230 140, 290 138, 330 142" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
        <path d="M130 165 L130 250" fill="none" stroke="url(#${gid})" stroke-width="14" stroke-linecap="round"/>
        <path d="M112 250 H150" fill="none" stroke="url(#${gid})" stroke-width="12" stroke-linecap="round"/>
        <path d="M310 145 L310 250" fill="none" stroke="url(#${gid})" stroke-width="14" stroke-linecap="round"/>
        <path d="M292 250 H330" fill="none" stroke="url(#${gid})" stroke-width="12" stroke-linecap="round"/>
        <path d="M105 170 L55 250" fill="none" stroke="url(#${gid})" stroke-width="16" stroke-linecap="round"/>
        <path d="M38 250 H72" fill="none" stroke="url(#${gid})" stroke-width="11" stroke-linecap="round"/>
        <path d="M300 148 L250 250" fill="none" stroke="url(#${gid})" stroke-width="16" stroke-linecap="round"/>
        <path d="M232 250 H270" fill="none" stroke="url(#${gid})" stroke-width="11" stroke-linecap="round"/>
      </g>
    </svg>`;
  }

  function tonesFor(move, accent) {
    if (move === "deadlift") return ["#e4eef5", "#9fb4c5", "#5a7388"];
    if (move === "lunge") return ["#f0dfc6", "#c9a57c", "#7d5c3f"];
    if (move === "press") return ["#f3efe6", "#cfc4a8", "#8a7a58"];
    if (move === "plank") return ["#f5f5f5", "#b8b0a4", "#8a8278"];
    return ["#f0dfc6", "#c9a57c", "#7d5c3f"];
  }

  function animateSquat(root) {
    const hip = root.querySelector(".a-hip");
    const torso = root.querySelector(".a-torso");
    const head = root.querySelector(".a-head");
    const thigh = root.querySelector(".a-thighF");
    const shin = root.querySelector(".a-shinF");
    const foot = root.querySelector(".a-footF");
    const arm = root.querySelector(".a-arm");
    const fore = root.querySelector(".a-fore");
    const floor = root.querySelector(".a-floor");
    const glow = root.querySelector(".a-glow");
    const FOOT = { x: 218, y: 500 };
    const L1 = 94,
      L2 = 88;
    loop((now) => {
      const t = phase(now, 3200, 0.42, 0.12);
      // shallower depth + taller stand = less “tenso”
      const hx = lerp(200, 192, t),
        hy = lerp(308, 368, t);
      hip.setAttribute("transform", `translate(${hx} ${hy})`);
      const leg = ik(hx, hy, FOOT.x, FOOT.y, L1, L2);
      thigh.setAttribute("transform", `rotate(${leg.thighDeg})`);
      shin.setAttribute("transform", `translate(2 94) rotate(${leg.shinDeg})`);
      foot.setAttribute(
        "transform",
        `translate(0 88) rotate(${clamp(leg.footDeg, -14, 6)})`,
      );
      torso.setAttribute("transform", `rotate(${lerp(4, 18, t)})`);
      head.setAttribute("transform", `translate(4 -4) rotate(${lerp(-2, -8, t)})`);
      arm.setAttribute("transform", `translate(18 24) rotate(${lerp(8, 36, t)})`);
      if (fore) fore.setAttribute("transform", `translate(8 52) rotate(${lerp(6, 16, t)})`);
      if (floor) {
        floor.setAttribute("rx", String(lerp(100, 114, t)));
        floor.setAttribute("opacity", String(lerp(0.14, 0.22, t)));
      }
      if (glow) glow.setAttribute("opacity", String(lerp(0.45, 0.95, t)));
    });
  }

  function animateLunge(root) {
    const hip = root.querySelector(".a-hip");
    const torso = root.querySelector(".a-torso");
    const head = root.querySelector(".a-head");
    const thighF = root.querySelector(".a-thighF");
    const shinF = root.querySelector(".a-shinF");
    const footF = root.querySelector(".a-footF");
    const thighB = root.querySelector(".a-thighB");
    const shinB = root.querySelector(".a-shinB");
    const footB = root.querySelector(".a-footB");
    const arm = root.querySelector(".a-arm");
    const glow = root.querySelector(".a-glow");
    const FRONT = { x: 150, y: 500 },
      BACK = { x: 310, y: 500 };
    const L1 = 92,
      L2 = 88;
    loop((now) => {
      const t = phase(now, 3000, 0.42, 0.12);
      const hx = lerp(200, 190, t),
        hy = lerp(295, 340, t);
      hip.setAttribute("transform", `translate(${hx} ${hy})`);
      const f = ik(hx, hy, FRONT.x, FRONT.y, L1, L2);
      const b = ik(hx, hy, BACK.x, BACK.y, L1, L2);
      thighF.setAttribute("transform", `rotate(${f.thighDeg})`);
      shinF.setAttribute("transform", `translate(2 94) rotate(${f.shinDeg})`);
      footF.setAttribute(
        "transform",
        `translate(0 88) rotate(${clamp(f.footDeg, -16, 8)})`,
      );
      if (thighB) thighB.setAttribute("transform", `rotate(${b.thighDeg})`);
      if (shinB) shinB.setAttribute("transform", `translate(34 82) rotate(${b.shinDeg})`);
      if (footB)
        footB.setAttribute(
          "transform",
          `translate(22 74) rotate(${clamp(b.footDeg, -16, 10)})`,
        );
      torso.setAttribute("transform", `rotate(${lerp(4, 10, t)})`);
      head.setAttribute("transform", `translate(4 -4) rotate(${lerp(-1, -6, t)})`);
      if (arm) arm.setAttribute("transform", `translate(18 24) rotate(${lerp(8, 28, t)})`);
      if (glow) glow.setAttribute("opacity", String(lerp(0.5, 0.95, t)));
    });
  }

  function animateDeadlift(root) {
    const hip = root.querySelector(".a-hip");
    const torso = root.querySelector(".a-torso");
    const head = root.querySelector(".a-head");
    const thigh = root.querySelector(".a-thighF");
    const shin = root.querySelector(".a-shinF");
    const foot = root.querySelector(".a-footF");
    const arm = root.querySelector(".a-arm");
    const bar = root.querySelector(".a-bar");
    const glow = root.querySelector(".a-glow");
    const FOOT = { x: 210, y: 500 };
    const L1 = 94,
      L2 = 88;
    if (bar) bar.setAttribute("opacity", "1");
    loop((now) => {
      const t = phase(now, 3200, 0.4, 0.14);
      const hx = lerp(200, 192, t),
        hy = lerp(300, 328, t);
      hip.setAttribute("transform", `translate(${hx} ${hy})`);
      const leg = ik(hx, hy, FOOT.x, FOOT.y, L1, L2);
      thigh.setAttribute("transform", `rotate(${leg.thighDeg})`);
      shin.setAttribute("transform", `translate(2 94) rotate(${leg.shinDeg})`);
      foot.setAttribute(
        "transform",
        `translate(0 88) rotate(${clamp(leg.footDeg, -12, 6)})`,
      );
      torso.setAttribute("transform", `rotate(${lerp(3, 32, t)})`);
      head.setAttribute("transform", `translate(4 -4) rotate(${lerp(-2, -9, t)})`);
      if (arm) arm.setAttribute("transform", `translate(18 24) rotate(${lerp(4, 14, t)})`);
      if (bar) bar.setAttribute("transform", `translate(0 ${lerp(-112, 0, t)})`);
      if (glow) glow.setAttribute("opacity", String(lerp(0.95, 0.5, t)));
    });
  }

  function animatePress(root) {
    const arm = root.querySelector(".a-arm");
    const fore = root.querySelector(".a-fore");
    const arm2 = root.querySelector(".a-arm2");
    const bar = root.querySelector(".a-bar");
    const hip = root.querySelector(".a-hip");
    const torso = root.querySelector(".a-torso");
    if (bar) bar.setAttribute("opacity", "1");
    if (arm2) arm2.setAttribute("opacity", "0.9");
    loop((now) => {
      const t = phase(now, 2800, 0.42, 0.12);
      // calmer press arc — less behind-head crossing
      if (arm) arm.setAttribute("transform", `translate(18 24) rotate(${lerp(25, 130, t)})`);
      if (fore) fore.setAttribute("transform", `translate(8 52) rotate(${lerp(70, 5, t)})`);
      if (arm2) arm2.setAttribute("transform", `translate(-16 20) rotate(${lerp(-25, -130, t)})`);
      if (bar) bar.setAttribute("transform", `translate(0 ${lerp(-200, -310, t)})`);
      if (hip) hip.setAttribute("transform", `translate(200 ${lerp(312, 306, t)})`);
      if (torso) torso.setAttribute("transform", `rotate(${lerp(2, 0, t)})`);
    });
  }

  function animatePlank(root) {
    const body = root.querySelector(".a-body");
    const glow = root.querySelector(".a-glow");
    const torso = root.querySelector(".a-torso");
    loop((now) => {
      const w = (Math.sin(now / 900) + 1) / 2;
      if (body) body.setAttribute("transform", `translate(0 ${-3.5 * w})`);
      if (glow) glow.setAttribute("opacity", String(lerp(0.45, 0.9, w)));
      if (torso) torso.setAttribute("stroke-width", String(lerp(25, 28, w)));
    });
  }

  const animators = {
    squat: animateSquat,
    lunge: animateLunge,
    deadlift: animateDeadlift,
    press: animatePress,
    plank: animatePlank,
  };

  function mount(el, opts = {}) {
    const move = opts.move || el.dataset.athlete || "squat";
    const accent = opts.accent || el.dataset.accent || "#c8f542";
    const tones = tonesFor(move, accent);
    const gid = `sk-${++seq}`;
    el.innerHTML =
      move === "plank"
        ? plankAthlete({ gid, accent, tones })
        : sideAthlete({
            gid,
            accent,
            tones,
            dualLeg: move === "lunge",
          });
    // mini thumbs: pose only (no loop) — calmer + faster
    const staticOnly =
      prefersReduced() ||
      el.classList.contains("athlete-slot-mini") ||
      el.dataset.static === "1";
    if (!staticOnly) (animators[move] || animateSquat)(el);
    else {
      // freeze at a readable mid pose once
      const svg = el.querySelector(".fig-premium");
      if (svg && move !== "plank") {
        const hip = svg.querySelector(".a-hip");
        if (hip) hip.setAttribute("transform", "translate(200 330)");
        const torso = svg.querySelector(".a-torso");
        if (torso) torso.setAttribute("transform", "rotate(12)");
      }
    }
    return el;
  }

  function bootStage(root) {
    killAll();
    if (!root) return;
    root.querySelectorAll("[data-athlete]").forEach((el) => mount(el));
  }

  return { mount, bootStage, killAll };
})();
