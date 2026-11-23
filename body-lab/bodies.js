/** SVG figures: male, female, neutral × silhouette / shaded */
window.Bodies = (() => {
  const common = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;

  function maleSquat(opts = {}) {
    const mode = opts.mode || "silhouette";
    const accent = opts.accent || "#c8f542";
    const ink = opts.ink || "#e8e4dc";
    const gid = `mShade-${Math.random().toString(36).slice(2, 7)}`;
    if (mode === "silhouette") {
      return `
      <svg viewBox="0 0 200 320" class="fig" aria-hidden="true">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${ink}" stop-opacity=".95"/>
            <stop offset="100%" stop-color="${ink}" stop-opacity=".55"/>
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="302" rx="48" ry="8" fill="${ink}" opacity=".12"/>
        <path fill="url(#${gid})" d="M100 28c14 0 24 11 24 26 0 12-7 22-18 25v8c22 6 38 22 42 44l8 48c2 12-4 18-14 16l-12-4v28c0 18 4 36 6 54l4 28c1 8-4 12-10 10l-18-6-8-40-6 40-18 6c-6 2-11-2-10-10l4-28c2-18 6-36 6-54v-28l-12 4c-10 2-16-4-14-16l8-48c4-22 20-38 42-44v-8c-11-3-18-13-18-25 0-15 10-26 24-26z"/>
        <path ${common} stroke="${accent}" stroke-width="2.5" d="M78 118c8 14 22 22 36 22s28-8 36-22"/>
        <circle cx="100" cy="54" r="3" fill="${accent}"/>
      </svg>`;
    }
    return `
    <svg viewBox="0 0 200 320" class="fig" aria-hidden="true">
      <ellipse cx="100" cy="302" rx="48" ry="8" fill="${ink}" opacity=".1"/>
      <g ${common} stroke="${ink}" stroke-width="2.2">
        <circle cx="100" cy="48" r="22" fill="${ink}" fill-opacity=".08"/>
        <path d="M86 68c4 10 10 14 14 14s10-4 14-14"/>
        <path d="M78 92c8-6 16-8 22-8s14 2 22 8"/>
        <path d="M72 108c10 8 18 12 28 12s18-4 28-12"/>
        <path d="M68 130c-8 4-16 2-22-4M132 130c8 4 16 2 22-4"/>
        <path d="M86 142v36c0 10-2 22-6 34l-10 42M114 142v36c0 10 2 22 6 34l10 42"/>
        <path d="M70 252c8 2 14-4 16-12M130 252c-8 2-14-4-16-12"/>
        <path d="M88 118c4 18 10 28 12 28s8-10 12-28" stroke="${accent}" stroke-width="2.8"/>
        <path d="M92 96c6 8 10 10 8 10M108 96c-6 8-10 10-8 10" stroke="${accent}" stroke-width="1.6" opacity=".7"/>
      </g>
    </svg>`;
  }

  function femaleLunge(opts = {}) {
    const mode = opts.mode || "shaded";
    const accent = opts.accent || "#ff6b4a";
    const ink = opts.ink || "#1a1a1a";
    if (mode === "silhouette") {
      return `
      <svg viewBox="0 0 300 320" class="fig" aria-hidden="true">
        <ellipse cx="150" cy="310" rx="80" ry="6" fill="${ink}" opacity=".12"/>
        <g fill="${ink}">
          <circle cx="168" cy="42" r="18"/>
          <path d="M154 58h28l4 16-8 8v36l-6 6-16-4v-38l-6-8z"/>
          <path d="M148 118h36l4 28-10 8-24-2-6-10z"/>
          <path d="M150 150l-28 58-6 70h22l8-66 18-50z"/>
          <path d="M176 152l48 46 36 70-22 8-34-64-36-48z"/>
          <path d="M146 128l-40 8-8-14 42-12z"/>
          <path d="M186 122l46-28 10 12-48 30z"/>
        </g>
        <path ${common} stroke="${accent}" stroke-width="2.6" d="M156 130c18 14 36 16 50 6"/>
        <circle cx="196" cy="188" r="5" fill="${accent}"/>
      </svg>`;
    }
    return `
    <svg viewBox="0 0 300 320" class="fig" aria-hidden="true">
      <ellipse cx="150" cy="310" rx="80" ry="6" fill="${ink}" opacity=".1"/>
      <g ${common} stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="168" cy="42" r="18" fill="${ink}" fill-opacity=".06"/>
        <path d="M168 60v28"/>
        <path d="M152 96c10-4 16-5 24-4 8 1 18 5 28 12"/>
        <path d="M148 122c14 8 26 10 36 8 12-2 24-8 36-18"/>
        <path d="M148 130c-16 4-34 4-50-4"/>
        <path d="M210 116c18-8 34-20 46-34"/>
        <path d="M162 140c-6 24-18 52-30 78l-8 48"/>
        <path d="M182 140c16 22 36 48 56 72l28 44"/>
        <path d="M120 268h28M264 256h28"/>
        <path d="M164 124c12 14 24 18 30 12" stroke="${accent}" stroke-width="2.8"/>
        <circle cx="200" cy="186" r="5" fill="${accent}"/>
      </g>
    </svg>`;
  }

  function neutralDeadlift(opts = {}) {
    const mode = opts.mode || "silhouette";
    const accent = opts.accent || "#5ec8ff";
    const ink = opts.ink || "#f2f0ea";
    const gid = `nShade-${Math.random().toString(36).slice(2, 7)}`;
    if (mode === "silhouette") {
      return `
      <svg viewBox="0 0 240 320" class="fig" aria-hidden="true">
        <defs>
          <linearGradient id="${gid}" x1=".2" y1="0" x2=".8" y2="1">
            <stop offset="0%" stop-color="${ink}" stop-opacity=".92"/>
            <stop offset="100%" stop-color="${ink}" stop-opacity=".48"/>
          </linearGradient>
        </defs>
        <ellipse cx="120" cy="304" rx="56" ry="8" fill="${ink}" opacity=".1"/>
        <path fill="url(#${gid})" d="M120 30c13 0 23 10 23 24 0 11-7 20-16 23v8c16 3 28 14 34 30l18 52c4 12-2 18-12 16l-14-4 2 20c2 16 4 34 4 52v36c0 8-5 12-12 10l-14-4v-78l-6 78-14 4c-7 2-12-2-12-10v-36c0-18 2-36 4-52l2-20-14 4c-10 2-16-4-12-16l18-52c6-16 18-27 34-30v-8c-9-3-16-12-16-23 0-14 10-24 23-24z"/>
        <rect x="48" y="168" width="144" height="8" rx="3" fill="${accent}" opacity=".9"/>
        <circle cx="48" cy="172" r="14" fill="none" stroke="${accent}" stroke-width="3"/>
        <circle cx="192" cy="172" r="14" fill="none" stroke="${accent}" stroke-width="3"/>
      </svg>`;
    }
    return `
    <svg viewBox="0 0 240 320" class="fig" aria-hidden="true">
      <ellipse cx="120" cy="304" rx="56" ry="8" fill="${ink}" opacity=".08"/>
      <g ${common} stroke="${ink}" stroke-width="2.1">
        <ellipse cx="120" cy="46" rx="20" ry="22" fill="${ink}" fill-opacity=".07"/>
        <path d="M108 66c4 8 8 12 12 12s8-4 12-12"/>
        <path d="M98 92c12-4 20-6 28-4"/>
        <path d="M92 114c14 6 24 8 36 6"/>
        <path d="M84 136c-12 6-24 8-36 4M156 136c12 6 24 8 36 4"/>
        <path d="M104 148v40c0 14 0 30-2 46l-6 40M136 148v40c0 14 0 30 2 46l6 40"/>
        <path d="M70 172h100" stroke="${accent}" stroke-width="3"/>
        <circle cx="58" cy="172" r="12" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="182" cy="172" r="12" stroke="${accent}" stroke-width="2.5"/>
        <path d="M110 120c6 12 10 16 10 14s4-2 10-14" stroke="${accent}" stroke-width="2.2"/>
      </g>
    </svg>`;
  }

  function malePress(opts = {}) {
    const accent = opts.accent || "#f0c14a";
    const ink = opts.ink || "#111";
    return `
    <svg viewBox="0 0 200 300" class="fig" aria-hidden="true">
      <g ${common} stroke="${ink}" stroke-width="2">
        <circle cx="100" cy="42" r="20" fill="${ink}" fill-opacity=".06"/>
        <path d="M86 60c4 8 10 12 14 12s10-4 14-12"/>
        <path d="M78 84c10-4 16-6 22-6s12 2 22 6"/>
        <path d="M70 108c12 8 20 12 30 12s18-4 30-12"/>
        <path d="M64 100c-4-20-6-36-4-48M136 100c4-20 6-36 4-48"/>
        <path d="M58 52h-20M142 52h20" stroke="${accent}" stroke-width="3"/>
        <circle cx="34" cy="52" r="10" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="166" cy="52" r="10" stroke="${accent}" stroke-width="2.5"/>
        <path d="M88 132v48c0 12-2 28-4 42l-8 36M112 132v48c0 12 2 28 4 42l8 36"/>
        <path d="M92 108c4 10 8 14 8 12s4-2 8-12" stroke="${accent}" stroke-width="2"/>
      </g>
    </svg>`;
  }

  function femalePlank(opts = {}) {
    const accent = opts.accent || "#2dd4a8";
    const ink = opts.ink || "#0f172a";
    return `
    <svg viewBox="0 0 320 160" class="fig fig-wide" aria-hidden="true">
      <g ${common} stroke="${ink}" stroke-width="2">
        <ellipse cx="268" cy="58" rx="18" ry="16" fill="${ink}" fill-opacity=".06"/>
        <path d="M250 66c-28 4-56 6-84 4-36-2-72-8-108-4"/>
        <path d="M250 78c-30 2-60 2-90 0-34-2-68-6-98 2"/>
        <path d="M58 80v36M86 82v40M230 78v42M256 74v40"/>
        <path d="M48 116h24M76 122h24M220 120h24M246 114h24"/>
        <path d="M140 72c8 6 16 8 24 6" stroke="${accent}" stroke-width="2.4"/>
        <path d="M100 76c6 4 12 4 18 2" stroke="${accent}" stroke-width="1.6" opacity=".7"/>
      </g>
    </svg>`;
  }

  function miniPose(kind, accent, ink) {
    const map = {
      squat: maleSquat({ mode: "silhouette", accent, ink }),
      lunge: femaleLunge({ mode: "silhouette", accent, ink }),
      deadlift: neutralDeadlift({ mode: "silhouette", accent, ink }),
      press: malePress({ accent, ink }),
      plank: femalePlank({ accent, ink }),
    };
    return map[kind] || map.squat;
  }

  return { maleSquat, femaleLunge, neutralDeadlift, malePress, femalePlank, miniPose };
})();
