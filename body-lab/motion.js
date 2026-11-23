/** Max-motion exercise cycles with GSAP — tuned joint kinematics */
window.BodyMotion = (() => {
  let active = [];

  function killAll() {
    active.forEach((t) => {
      try {
        t.kill();
      } catch (_) {}
    });
    active = [];
    if (typeof gsap !== "undefined") gsap.killTweensOf("*");
  }

  function q(root, sel) {
    return root.querySelector(sel);
  }

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function track(tl) {
    active.push(tl);
    return tl;
  }

  function joints(root) {
    const parts = {
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
      muscle2: q(root, ".b-muscle-2"),
      legF: q(root, ".b-leg-f"),
      legB: q(root, ".b-leg-b"),
    };
    const limbKeys = [
      "thighL",
      "thighR",
      "shinL",
      "shinR",
      "armL",
      "armR",
      "forearmL",
      "forearmR",
      "torso",
      "hip",
      "head",
    ];
    limbKeys.forEach((k) => {
      if (parts[k]) gsap.set(parts[k], { transformOrigin: "50% 0%", force3D: false });
    });
    if (parts.head) gsap.set(parts.head, { transformOrigin: "50% 100%" });
    return parts;
  }

  function squat(root, { intensity = 1 } = {}) {
    if (!root || prefersReduced()) return null;
    const p = joints(root);
    const tl = track(gsap.timeline({ repeat: -1, defaults: { ease: "power1.inOut" } }));
    const i = intensity;

    /* descend */
    tl.to(p.hip, { y: 48 * i, duration: 1.2 }, 0)
      .to(p.thighL, { rotation: 58 * i, duration: 1.2 }, 0)
      .to(p.thighR, { rotation: -58 * i, duration: 1.2 }, 0)
      .to(p.shinL, { rotation: -64 * i, duration: 1.2 }, 0)
      .to(p.shinR, { rotation: 64 * i, duration: 1.2 }, 0)
      .to(p.torso, { rotation: 10 * i, y: 4, duration: 1.2 }, 0)
      .to(p.head, { rotation: -8 * i, duration: 1.2 }, 0)
      .to(p.armL, { rotation: -12 * i, duration: 1.2 }, 0)
      .to(p.armR, { rotation: 12 * i, duration: 1.2 }, 0)
      .to(p.shadow, { scaleX: 1.3, transformOrigin: "50% 50%", duration: 1.2 }, 0)
      .to(p.muscle, { attr: { "stroke-width": 4.5 }, opacity: 1, duration: 1.2 }, 0)
      /* hold */
      .to({}, { duration: 0.22 })
      /* ascend — explosive */
      .to(p.hip, { y: 0, duration: 0.95, ease: "power3.out" })
      .to(p.thighL, { rotation: 0, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.thighR, { rotation: 0, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.shinL, { rotation: 0, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.shinR, { rotation: 0, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.torso, { rotation: 0, y: 0, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.head, { rotation: 0, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.armL, { rotation: 0, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.armR, { rotation: 0, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.shadow, { scaleX: 1, duration: 0.95, ease: "power3.out" }, "<")
      .to(p.muscle, { attr: { "stroke-width": 3 }, opacity: 0.85, duration: 0.95 }, "<")
      .to({}, { duration: 0.4 });

    return tl;
  }

  function lunge(root, { intensity = 1 } = {}) {
    if (!root || prefersReduced()) return null;
    const p = joints(root);
    const tl = track(gsap.timeline({ repeat: -1, defaults: { ease: "power1.inOut" } }));
    const i = Math.min(intensity, 1.05);

    tl.to(p.root, { x: -6, duration: 1.25 }, 0)
      .to(p.hip, { y: 22 * i, duration: 1.25 }, 0)
      .to(p.thighL, { rotation: 42 * i, duration: 1.25 }, 0)
      .to(p.shinL, { rotation: -48 * i, duration: 1.25 }, 0)
      .to(p.thighR, { rotation: -22 * i, duration: 1.25 }, 0)
      .to(p.shinR, { rotation: 8 * i, duration: 1.25 }, 0)
      .to(p.torso, { rotation: 5 * i, duration: 1.25 }, 0)
      .to(p.armL, { rotation: -28 * i, duration: 1.25 }, 0)
      .to(p.armR, { rotation: 24 * i, duration: 1.25 }, 0)
      .to({}, { duration: 0.25 })
      .to(p.root, { x: 0, duration: 1.15, ease: "power2.out" })
      .to(p.hip, { y: 0, duration: 1.15, ease: "power2.out" }, "<")
      .to(p.thighL, { rotation: 0, duration: 1.15, ease: "power2.out" }, "<")
      .to(p.shinL, { rotation: 0, duration: 1.15, ease: "power2.out" }, "<")
      .to(p.thighR, { rotation: 0, duration: 1.15, ease: "power2.out" }, "<")
      .to(p.shinR, { rotation: 0, duration: 1.15, ease: "power2.out" }, "<")
      .to(p.torso, { rotation: 0, duration: 1.15, ease: "power2.out" }, "<")
      .to(p.armL, { rotation: 0, duration: 1.15, ease: "power2.out" }, "<")
      .to(p.armR, { rotation: 0, duration: 1.15, ease: "power2.out" }, "<")
      .to({}, { duration: 0.35 });

    return tl;
  }

  function deadlift(root) {
    if (!root || prefersReduced()) return null;
    const p = joints(root);
    const tl = track(gsap.timeline({ repeat: -1, defaults: { ease: "power1.inOut" } }));

    if (p.bar) gsap.set(p.bar, { opacity: 1, y: 36 });

    /* hinge down */
    tl.to(p.torso, { rotation: 42, y: 10, duration: 1.15 }, 0)
      .to(p.hip, { y: 10, duration: 1.15 }, 0)
      .to(p.head, { rotation: -10, duration: 1.15 }, 0)
      .to(p.thighL, { rotation: 18, duration: 1.15 }, 0)
      .to(p.thighR, { rotation: -18, duration: 1.15 }, 0)
      .to(p.armL, { rotation: 6, duration: 1.15 }, 0)
      .to(p.armR, { rotation: -6, duration: 1.15 }, 0)
      .to(p.bar, { y: 52, duration: 1.15 }, 0)
      .to({}, { duration: 0.18 })
      /* lockout */
      .to(p.torso, { rotation: 0, y: 0, duration: 0.9, ease: "power3.out" })
      .to(p.hip, { y: 0, duration: 0.9, ease: "power3.out" }, "<")
      .to(p.head, { rotation: 0, duration: 0.9, ease: "power3.out" }, "<")
      .to(p.thighL, { rotation: 0, duration: 0.9, ease: "power3.out" }, "<")
      .to(p.thighR, { rotation: 0, duration: 0.9, ease: "power3.out" }, "<")
      .to(p.bar, { y: 0, duration: 0.9, ease: "power3.out" }, "<")
      .to({}, { duration: 0.5 });

    return tl;
  }

  function press(root) {
    if (!root || prefersReduced()) return null;
    const p = joints(root);
    const tl = track(gsap.timeline({ repeat: -1, defaults: { ease: "power1.inOut" } }));

    if (p.bar) gsap.set(p.bar, { opacity: 1, y: -88, scaleX: 0.72, transformOrigin: "50% 50%" });
    gsap.set(p.forearmL, { rotation: -95 });
    gsap.set(p.forearmR, { rotation: 95 });

    tl.to(p.armL, { rotation: -150, duration: 0.95 }, 0)
      .to(p.armR, { rotation: 150, duration: 0.95 }, 0)
      .to(p.forearmL, { rotation: -15, duration: 0.95 }, 0)
      .to(p.forearmR, { rotation: 15, duration: 0.95 }, 0)
      .to(p.bar, { y: -168, duration: 0.95 }, 0)
      .to(p.torso, { y: -3, duration: 0.95 }, 0)
      .to({}, { duration: 0.22 })
      .to(p.armL, { rotation: 0, duration: 1.05, ease: "power2.inOut" })
      .to(p.armR, { rotation: 0, duration: 1.05, ease: "power2.inOut" }, "<")
      .to(p.forearmL, { rotation: -95, duration: 1.05, ease: "power2.inOut" }, "<")
      .to(p.forearmR, { rotation: 95, duration: 1.05, ease: "power2.inOut" }, "<")
      .to(p.bar, { y: -88, duration: 1.05, ease: "power2.inOut" }, "<")
      .to(p.torso, { y: 0, duration: 1.05 }, "<")
      .to({}, { duration: 0.35 });

    return tl;
  }

  function plank(root) {
    if (!root || prefersReduced()) return null;
    const p = joints(root);
    const tl = track(
      gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } }),
    );

    tl.to(p.torso, { y: -4, duration: 1.5 }, 0)
      .to(p.head, { y: -3, rotation: -5, duration: 1.5 }, 0)
      .to(p.muscle, { opacity: 1, attr: { "stroke-width": 4 }, duration: 1.5 }, 0)
      .to(p.legF, { y: 2, duration: 1.5 }, 0)
      .to(p.legB, { y: -2, duration: 1.5 }, 0);

    return tl;
  }

  function pulseAccent(root) {
    if (!root || prefersReduced()) return null;
    const muscle = root.querySelectorAll(".b-muscle, .b-muscle-2");
    if (!muscle.length) return null;
    return track(
      gsap.to(muscle, {
        opacity: 0.4,
        duration: 0.85,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        stagger: 0.12,
      }),
    );
  }

  function bootStage(stage) {
    killAll();
    if (!stage || typeof gsap === "undefined") return;
    stage.querySelectorAll(".fig-athlete[data-motion]").forEach((el, i) => {
      const kind = el.dataset.motion;
      const delay = Number(el.dataset.delay || 0) + i * 0.06;
      const intensity = Number(el.dataset.intensity || 1);
      const map = { squat, lunge, deadlift, press, plank };
      const fn = map[kind] || squat;
      const run = () => {
        fn(el, { intensity });
        pulseAccent(el);
      };
      if (delay) {
        const d = gsap.delayedCall(delay, run);
        active.push(d);
      } else run();
    });
  }

  return { squat, lunge, deadlift, press, plank, bootStage, killAll };
})();
