/** Articulated SVG athletes — limb groups for GSAP motion */
window.Bodies = (() => {
  const uid = () => Math.random().toString(36).slice(2, 8);

  function athlete({
    id,
    ink = "#e7e2d6",
    accent = "#c8f542",
    fill = true,
    wide = false,
  }) {
    const iid = id || `ath-${uid()}`;
    const vb = wide ? "0 0 320 200" : "0 0 220 340";
    const shadow = wide
      ? `<ellipse class="b-shadow" cx="160" cy="188" rx="70" ry="6" fill="${ink}" opacity=".12"/>`
      : `<ellipse class="b-shadow" cx="110" cy="328" rx="58" ry="7" fill="${ink}" opacity=".12"/>`;

    if (wide) {
      /* plank / horizontal pose base */
      return `
      <svg id="${iid}" class="fig fig-athlete fig-wide" viewBox="${vb}" aria-hidden="true">
        ${shadow}
        <g class="b-root" fill="${fill ? ink : "none"}" stroke="${ink}" stroke-width="${fill ? 0 : 2.4}" stroke-linecap="round" stroke-linejoin="round">
          <g class="b-head" transform="translate(248,58)">
            <ellipse cx="0" cy="0" rx="16" ry="14" ${fill ? `fill="${ink}" opacity=".95"` : ""}/>
          </g>
          <g class="b-torso" style="transform-box:fill-box;transform-origin:center">
            <path d="M70 78 C120 70, 180 68, 232 62" fill="none" stroke="${ink}" stroke-width="18" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
          </g>
          <g class="b-arm-f" style="transform-box:fill-box;transform-origin:top center">
            <path d="M88 86 L88 128" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
            <path d="M78 128 H102" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
          </g>
          <g class="b-arm-b" style="transform-box:fill-box;transform-origin:top center">
            <path d="M210 74 L210 118" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
            <path d="M198 118 H222" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
          </g>
          <g class="b-leg-f" style="transform-box:fill-box;transform-origin:top center">
            <path d="M96 88 L96 140" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round"/>
            <path d="M84 140 H112" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
          </g>
          <g class="b-leg-b" style="transform-box:fill-box;transform-origin:top center">
            <path d="M220 76 L220 132" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round"/>
            <path d="M208 132 H236" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
          </g>
          <path class="b-muscle" d="M130 72 C150 78, 170 76, 190 70" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
        </g>
      </svg>`;
    }

    /* standing athlete — front/3q, joint hierarchy */
    return `
    <svg id="${iid}" class="fig fig-athlete" viewBox="${vb}" aria-hidden="true">
      ${shadow}
      <g class="b-root" transform="translate(110,40)">
        <g class="b-head" style="transform-box:fill-box;transform-origin:center bottom">
          <circle cx="0" cy="0" r="22" fill="${ink}" opacity="${fill ? 0.95 : 0.15}" stroke="${ink}" stroke-width="2"/>
          <circle cx="8" cy="-2" r="3" fill="${accent}"/>
        </g>
        <g class="b-torso" transform="translate(0,28)" style="transform-box:fill-box;transform-origin:center top">
          <path d="M-28 8 C-34 40,-30 78,-22 110 L22 110 C30 78,34 40,28 8 Z" fill="${ink}" opacity="${fill ? 0.9 : 0.12}" stroke="${ink}" stroke-width="2.2"/>
          <path class="b-muscle" d="M-16 48 C-4 62, 4 62, 16 48" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
          <path class="b-muscle-2" d="M-12 28 C0 36, 0 36, 12 28" fill="none" stroke="${accent}" stroke-width="2" opacity=".75"/>

          <g class="b-arm-l" transform="translate(-30,18)" style="transform-box:fill-box;transform-origin:top center">
            <path d="M0 0 L-6 52" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
            <g class="b-forearm-l" transform="translate(-6,52)" style="transform-box:fill-box;transform-origin:top center">
              <path d="M0 0 L-4 48" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
              <circle class="b-hand" cx="-4" cy="52" r="7" fill="${ink}" opacity="${fill ? 0.9 : 0.2}"/>
            </g>
          </g>
          <g class="b-arm-r" transform="translate(30,18)" style="transform-box:fill-box;transform-origin:top center">
            <path d="M0 0 L6 52" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
            <g class="b-forearm-r" transform="translate(6,52)" style="transform-box:fill-box;transform-origin:top center">
              <path d="M0 0 L4 48" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
              <circle class="b-hand" cx="4" cy="52" r="7" fill="${ink}" opacity="${fill ? 0.9 : 0.2}"/>
            </g>
          </g>
        </g>

        <g class="b-hip" transform="translate(0,138)" style="transform-box:fill-box;transform-origin:center top">
          <ellipse cx="0" cy="6" rx="24" ry="12" fill="${ink}" opacity="${fill ? 0.88 : 0.12}" stroke="${ink}" stroke-width="2"/>
          <g class="b-thigh-l" transform="translate(-14,10)" style="transform-box:fill-box;transform-origin:top center">
            <path d="M0 0 L-4 70" fill="none" stroke="${ink}" stroke-width="16" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
            <g class="b-shin-l" transform="translate(-4,70)" style="transform-box:fill-box;transform-origin:top center">
              <path d="M0 0 L2 72" fill="none" stroke="${ink}" stroke-width="14" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
              <path class="b-foot-l" d="M-10 72 H22" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity="${fill ? 0.9 : 1}"/>
            </g>
          </g>
          <g class="b-thigh-r" transform="translate(14,10)" style="transform-box:fill-box;transform-origin:top center">
            <path d="M0 0 L4 70" fill="none" stroke="${ink}" stroke-width="16" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
            <g class="b-shin-r" transform="translate(4,70)" style="transform-box:fill-box;transform-origin:top center">
              <path d="M0 0 L-2 72" fill="none" stroke="${ink}" stroke-width="14" stroke-linecap="round" opacity="${fill ? 0.92 : 1}"/>
              <path class="b-foot-r" d="M-18 72 H14" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round" opacity="${fill ? 0.9 : 1}"/>
            </g>
          </g>
        </g>
      </g>
      <g class="b-bar" opacity="0">
        <rect x="28" y="168" width="164" height="7" rx="3" fill="${accent}"/>
        <circle cx="28" cy="171.5" r="14" fill="none" stroke="${accent}" stroke-width="3"/>
        <circle cx="192" cy="171.5" r="14" fill="none" stroke="${accent}" stroke-width="3"/>
      </g>
    </svg>`;
  }

  function maleSquat(opts = {}) {
    return athlete({
      ink: opts.ink || "#e7e2d6",
      accent: opts.accent || "#c8f542",
      fill: opts.mode !== "shaded",
      id: opts.id,
    });
  }

  function femaleLunge(opts = {}) {
    return athlete({
      ink: opts.ink || "#1c1917",
      accent: opts.accent || "#c45c3e",
      fill: opts.mode !== "shaded",
      id: opts.id,
    });
  }

  function neutralDeadlift(opts = {}) {
    const svg = athlete({
      ink: opts.ink || "#d9e2ea",
      accent: opts.accent || "#5ec8ff",
      fill: opts.mode !== "shaded",
      id: opts.id,
    });
    return svg.replace('class="b-bar" opacity="0"', 'class="b-bar" opacity="1"');
  }

  function malePress(opts = {}) {
    return athlete({
      ink: opts.ink || "#f3efe6",
      accent: opts.accent || "#e2b857",
      fill: opts.mode !== "shaded",
      id: opts.id,
    });
  }

  function femalePlank(opts = {}) {
    return athlete({
      ink: opts.ink || "#f5f5f5",
      accent: opts.accent || "#ff7a59",
      fill: true,
      wide: true,
      id: opts.id,
    });
  }

  function miniPose(kind, accent, ink) {
    const map = {
      squat: () => maleSquat({ accent, ink, id: `mini-${uid()}` }),
      lunge: () => femaleLunge({ accent, ink, id: `mini-${uid()}` }),
      deadlift: () => neutralDeadlift({ accent, ink, id: `mini-${uid()}` }),
      press: () => malePress({ accent, ink, id: `mini-${uid()}` }),
      plank: () => femalePlank({ accent, ink, id: `mini-${uid()}` }),
    };
    return (map[kind] || map.squat)();
  }

  return { maleSquat, femaleLunge, neutralDeadlift, malePress, femalePlank, miniPose, athlete };
})();
