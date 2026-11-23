/* Câmera Distante — motor compartilhado das 6 ideias */
(function () {
  "use strict";

  const OPEN_MIDI = [64, 59, 55, 50, 45, 40];
  const FINGER = { 0: "#94a3b8", 1: "#f59e0b", 2: "#a855f7", 3: "#0ea5e9", 4: "#ec4899" };
  const noteFreq = (s, f) => 440 * Math.pow(2, (OPEN_MIDI[s] + f - 69) / 12);

  const CHORDS = {
    F: { name: "F", color: "#d99b26", frets: [0, 1, 2, 3, -1, -1], fingers: [0, 1, 2, 3, 0, 0], lo: 0, hi: 3, freqs: [329.63, 261.63, 220, 174.61, null, null], bass: 87.31 },
    G: { name: "G", color: "#df6d47", frets: [3, 0, 0, 0, 2, 3], fingers: [4, 0, 0, 0, 1, 2], lo: 0, hi: 5, freqs: [392, 246.94, 196, 146.83, 123.47, 98], bass: 98 },
    Am: { name: "Am", color: "#9333ea", frets: [0, 1, 2, 2, 0, -1], fingers: [0, 1, 3, 2, 0, 0], lo: 0, hi: 4, freqs: [329.63, 261.63, 220, 164.81, 110, null], bass: 110 },
    Em: { name: "Em", color: "#dfba37", frets: [0, 0, 0, 2, 2, 0], fingers: [0, 0, 0, 3, 2, 0], lo: 0, hi: 5, freqs: [329.63, 246.94, 196, 164.81, 123.47, 82.41], bass: 82.41 },
    Dm: { name: "Dm", color: "#2563eb", frets: [1, 3, 2, 0, -1, -1], fingers: [1, 3, 2, 0, 0, 0], lo: 0, hi: 3, freqs: [349.23, 293.66, 220, 146.83, null, null], bass: 73.42 },
    C: { name: "C", color: "#0d9488", frets: [0, 1, 0, 2, 3, -1], fingers: [0, 1, 0, 2, 3, 0], lo: 0, hi: 4, freqs: [329.63, 261.63, 196, 164.81, 130.81, null], bass: 130.81 },
  };

  const STRUM = [
    { off: 0, dur: 0.9, dir: "D" },
    { off: 1, dur: 0.9, dir: "D" },
    { off: 2, dur: 0.45, dir: "D" },
    { off: 2.5, dur: 0.45, dir: "U" },
    { off: 3, dur: 0.9, dir: "D" },
    { off: 4, dur: 0.9, dir: "D" },
    { off: 5, dur: 0.9, dir: "D" },
    { off: 6, dur: 0.9, dir: "D" },
  ];

  const PROG = [
    { section: "Contagem", kind: "rest", beats: 4, lyric: "One, two" },
    { section: "Intro", kind: "chord", chord: "F", beats: 4, lyric: "One, two" },
    { section: "Intro", kind: "chord", chord: "G", beats: 4, lyric: "One, two" },
    { section: "Intro", kind: "chord", chord: "Am", beats: 8, lyric: "Oh, life is bigger" },
    { section: "Verso 1", kind: "chord", chord: "Am", beats: 8, lyric: "Oh, life is bigger" },
    { section: "Verso 1", kind: "chord", chord: "Em", beats: 8, lyric: "It's bigger than you" },
    { section: "Verso 1", kind: "chord", chord: "Dm", beats: 8, lyric: "I've said too much" },
    { section: "Verso 1", kind: "chord", chord: "G", beats: 8, lyric: "I set it up" },
    { section: "Refrão", kind: "chord", chord: "F", beats: 4, lyric: "I thought that I heard you laughing" },
    { section: "Refrão", kind: "chord", chord: "G", beats: 4, lyric: "I thought that I heard you sing" },
    { section: "Refrão", kind: "chord", chord: "Am", beats: 8, lyric: "I think I thought I saw you try" },
    { section: "Ponte", kind: "chord", chord: "C", beats: 4, lyric: "But that was just a dream" },
    { section: "Ponte", kind: "chord", chord: "F", beats: 8, lyric: "Just a dream, just a dream" },
    { section: "Ponte", kind: "chord", chord: "G", beats: 4, lyric: "Dream..." },
  ];

  const theme = Object.assign(
    {
      skyTop: "#12c98a",
      skyMid: "#0ea28f",
      skyBot: "#127391",
      seaTop: "#0e4c9a",
      seaMid: "#1d47b8",
      seaBot: "#3b2db8",
      boardTop: "#2a2d32",
      boardBot: "#202226",
      stringHi: "#d4d8de",
      stringLo: "#bfa065",
      playhead: 0.455,
      boardY: 0.495,
      boardH: 0.138,
      accent: "#4ade80",
      pause: "#6366f1",
      font: "Outfit, system-ui, sans-serif",
      displayFont: "Fraunces, Georgia, serif",
    },
    window.CD_THEME || {}
  );

  const state = {
    playing: false,
    beat: 0,
    total: 0,
    speed: 100,
    events: [],
    sections: [],
    lyrics: [],
    lastT: 0,
    floats: [],
    vol: 0.8,
  };

  let audioCtx = null;
  const canvas = document.getElementById("highway");
  const ctx = canvas.getContext("2d");
  const map = document.getElementById("minimap");
  const mctx = map ? map.getContext("2d") : null;

  function compile() {
    const events = [];
    const sections = new Map();
    const lyrics = [];
    let cur = 0;
    let id = 0;
    PROG.forEach((seg) => {
      const a = cur;
      const b = cur + seg.beats;
      if (seg.section !== "Contagem") {
        if (!sections.has(seg.section)) sections.set(seg.section, { name: seg.section, a, b });
        else sections.get(seg.section).b = b;
      }
      if (!lyrics.length || lyrics[lyrics.length - 1].text !== seg.lyric) lyrics.push({ text: seg.lyric, a, b });
      else lyrics[lyrics.length - 1].b = b;
      if (seg.kind === "chord") {
        STRUM.forEach((st, i) => {
          if (st.off >= seg.beats) return;
          events.push({
            id: id++,
            kind: "chord",
            chord: seg.chord,
            beat: a + st.off,
            dur: Math.min(st.dur, seg.beats - st.off - 0.05),
            dir: st.dir,
            first: i === 0,
            status: "pending",
          });
        });
      }
      cur = b;
    });
    state.events = events;
    state.sections = [...sections.values()];
    state.lyrics = lyrics;
    state.total = cur;
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function tone(freq, t0, dur, gain, bright) {
    const ac = ensureAudio();
    if (!ac || gain < 0.001) return;
    const o1 = ac.createOscillator();
    const o2 = ac.createOscillator();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    o1.type = "triangle";
    o2.type = bright ? "sawtooth" : "sine";
    o1.frequency.setValueAtTime(freq, t0);
    o2.frequency.setValueAtTime(freq * (bright ? 1.002 : 2), t0);
    f.type = "lowpass";
    f.frequency.setValueAtTime(bright ? 3200 : 2000, t0);
    f.frequency.exponentialRampToValueAtTime(600, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(ac.destination);
    o1.start(t0);
    o2.start(t0);
    o1.stop(t0 + dur + 0.02);
    o2.stop(t0 + dur + 0.02);
  }

  function strum(key, dir) {
    const ac = ensureAudio();
    const ch = CHORDS[key];
    if (!ac || !ch) return;
    const now = ac.currentTime;
    const order = dir === "U" ? [0, 1, 2, 3] : [5, 4, 3, 2, 1, 0];
    let step = 0;
    order.forEach((s) => {
      if (!ch.freqs[s]) return;
      tone(ch.freqs[s], now + step * 0.012, dir === "U" ? 0.7 : 1.1, state.vol * 0.12, true);
      step++;
    });
  }

  function drawHighway() {
    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const portrait = h > w * 1.05;
    const boardH = portrait ? Math.min(126, Math.max(88, h * theme.boardH)) : Math.min(200, h * 0.34);
    const boardTop = portrait ? Math.round(h * theme.boardY) : Math.round(h - boardH - 60);
    const boardBot = boardTop + boardH;
    const playX = w * theme.playhead;
    const px = portrait ? Math.max(40, Math.min(58, w * 0.125)) : Math.max(58, w * 0.09);

    ctx.save();
    ctx.scale(dpr, dpr);

    const sky = ctx.createLinearGradient(0, 0, 0, boardTop);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(0.5, theme.skyMid);
    sky.addColorStop(1, theme.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, boardTop + 2);

    const sea = ctx.createLinearGradient(0, boardBot, 0, h);
    sea.addColorStop(0, theme.seaTop);
    sea.addColorStop(0.55, theme.seaMid);
    sea.addColorStop(1, theme.seaBot);
    ctx.fillStyle = sea;
    ctx.fillRect(0, boardBot - 1, w, h - boardBot + 2);

    const board = ctx.createLinearGradient(0, boardTop, 0, boardBot);
    board.addColorStop(0, theme.boardTop);
    board.addColorStop(1, theme.boardBot);
    ctx.fillStyle = board;
    ctx.fillRect(0, boardTop, w, boardH);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, boardBot - 4, w, 4);

    const topPad = boardH * 0.1;
    const span = boardH - topPad - boardH * 0.14;
    const step = span / 5;
    const ys = [];
    for (let s = 0; s < 6; s++) {
      const y = boardTop + topPad + s * step;
      ys.push(y);
      ctx.strokeStyle = s < 3 ? theme.stringHi : theme.stringLo;
      ctx.lineWidth = s < 3 ? 1 + s * 0.2 : 1.6 + (s - 3) * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const minB = state.beat - playX / px - 2;
    const maxB = state.beat + (w - playX) / px + 2;

    state.sections.forEach((sec) => {
      const x = playX + (sec.a - state.beat) * px;
      if (x < -80 || x > w + 40) return;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = `700 11px ${theme.font}`;
      ctx.fillText(sec.name, x + 4, boardTop - 8);
    });

    state.events.forEach((ev) => {
      if (ev.beat + ev.dur < minB || ev.beat > maxB) return;
      const x = playX + (ev.beat - state.beat) * px;
      const ch = CHORDS[ev.chord];
      if (!ch) return;
      const bw = Math.max(10, ev.dur * px - 2);
      const top = ys[ch.lo] - step * 0.35;
      const bot = ys[ch.hi] + step * 0.35;
      let col = ch.color;
      if (ev.status === "perfect") col = "#16a34a";
      if (ev.status === "missed") col = "#dc5b57";
      ctx.fillStyle = col;
      ctx.beginPath();
      const r = 3;
      ctx.moveTo(x + r, top);
      ctx.arcTo(x + bw, top, x + bw, bot, r);
      ctx.arcTo(x + bw, bot, x, bot, r);
      ctx.arcTo(x, bot, x, top, r);
      ctx.arcTo(x, top, x + bw, top, r);
      ctx.fill();
      if (ev.first) {
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${portrait ? 14 : 18}px ${theme.font}`;
        ctx.fillText(ch.name, x + 4, (top + bot) / 2 + 5);
      }
    });

    // bounce ball
    let ballY = boardTop - 16;
    let prev = null;
    let next = null;
    for (let i = 0; i < state.events.length; i++) {
      if (state.events[i].beat <= state.beat) prev = state.events[i];
      if (state.events[i].beat > state.beat) {
        next = state.events[i];
        break;
      }
    }
    if (prev && next) {
      const spanB = next.beat - prev.beat;
      const t = Math.max(0, Math.min(1, (state.beat - prev.beat) / spanB));
      const y1 = boardTop + span * 0.28;
      const y2 = boardTop + span * 0.28;
      const peak = Math.min(portrait ? 30 : 46, Math.max(12, spanB * 16));
      ballY = y1 + (y2 - y1) * t - 4 * peak * t * (1 - t);
    }
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(playX, ballY, portrait ? 5.8 : 7, 0, Math.PI * 2);
    ctx.fill();

    if (state.playing && state.beat >= 1 && state.beat < 4) {
      const n = 4 - Math.floor(state.beat);
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${portrait ? 80 : 96}px ${theme.displayFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n), w * 0.5, boardTop + boardH * 0.52);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    const now = performance.now();
    state.floats = state.floats.filter((f) => now - f.t < 900);
    state.floats.forEach((f) => {
      const age = (now - f.t) / 900;
      const x = playX + (f.beat - state.beat) * px;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = f.color;
      ctx.font = `700 12px ${theme.font}`;
      ctx.fillText(f.text, x - 12, boardTop - 8 - age * 20);
      ctx.globalAlpha = 1;
    });

    ctx.restore();
    syncLyrics();
    drawMap();
  }

  function syncLyrics() {
    const hi = document.getElementById("lyricNow");
    const nx = document.getElementById("lyricNext");
    if (!hi) return;
    let idx = 0;
    for (let i = 0; i < state.lyrics.length; i++) {
      if (state.beat >= state.lyrics[i].a) idx = i;
    }
    const cur = state.lyrics[idx];
    const nxt = state.lyrics[idx + 1];
    if (cur) {
      const p = Math.max(0, Math.min(1, (state.beat - cur.a) / Math.max(0.4, cur.b - cur.a)));
      const cut = Math.round(cur.text.length * p);
      hi.innerHTML = `<span class="hi">${cur.text.slice(0, cut)}</span><span class="lo">${cur.text.slice(cut)}</span>`;
    }
    if (nx) nx.textContent = nxt ? nxt.text : "";
  }

  function drawMap() {
    if (!mctx || !map) return;
    const dpr = devicePixelRatio || 1;
    const w = map.clientWidth || 280;
    const h = map.clientHeight || 22;
    if (map.width !== Math.round(w * dpr) || map.height !== Math.round(h * dpr)) {
      map.width = Math.round(w * dpr);
      map.height = Math.round(h * dpr);
    }
    mctx.save();
    mctx.scale(dpr, dpr);
    mctx.clearRect(0, 0, w, h);
    const total = Math.max(1, state.total);
    state.sections.forEach((s) => {
      mctx.fillStyle = "rgba(250,204,21,0.85)";
      mctx.fillRect((s.a / total) * w, 1, 1.4, h - 2);
    });
    state.events.forEach((ev) => {
      const ch = CHORDS[ev.chord];
      mctx.fillStyle = ev.status === "perfect" ? "#22c55e" : ch ? ch.color : "#888";
      mctx.fillRect((ev.beat / total) * w, 4, Math.max(2, (ev.dur / total) * w), h - 8);
    });
    mctx.fillStyle = "#fff";
    mctx.fillRect((state.beat / total) * w, 0, 2, h);
    mctx.restore();
  }

  function syncPlayBtn() {
    const btn = document.getElementById("btnPlay");
    const iconP = document.getElementById("iconPlay");
    const iconZ = document.getElementById("iconPause");
    if (!btn) return;
    btn.style.background = state.playing ? theme.pause : theme.accent;
    btn.style.color = state.playing ? "#fff" : "#052e1c";
    if (iconP) iconP.classList.toggle("hidden", state.playing);
    if (iconZ) iconZ.classList.toggle("hidden", !state.playing);
    document.body.classList.toggle("is-playing", state.playing);
  }

  function start() {
    ensureAudio();
    if (state.beat >= state.total - 0.2) {
      state.beat = 0;
      state.events.forEach((e) => (e.status = "pending"));
    }
    state.playing = true;
    state.lastT = performance.now();
    syncPlayBtn();
  }

  function pause() {
    state.playing = false;
    syncPlayBtn();
  }

  function tap() {
    ensureAudio();
    if (!state.playing) {
      start();
      return;
    }
    const bps = (125 * (state.speed / 100)) / 60;
    const win = 0.22 * bps;
    let best = null;
    let bestDiff = 99;
    state.events.forEach((ev) => {
      if (ev.status !== "pending") return;
      const d = state.beat - ev.beat;
      if (Math.abs(d) <= win && Math.abs(d) < Math.abs(bestDiff)) {
        best = ev;
        bestDiff = d;
      }
    });
    if (best) {
      best.status = "perfect";
      state.floats.push({ text: "Perfeito!", color: "#fff", beat: best.beat, t: performance.now() });
      strum(best.chord, best.dir);
    } else {
      let cur = "Am";
      for (const seg of PROG) {
        /* fallback */
      }
      const phraseBeat = state.beat;
      let acc = 0;
      for (const seg of PROG) {
        if (phraseBeat >= acc && phraseBeat < acc + seg.beats && seg.chord) cur = seg.chord;
        acc += seg.beats;
      }
      strum(cur, "D");
    }
  }

  function tick(now) {
    if (!state.lastT) state.lastT = now;
    const dt = Math.min(0.08, (now - state.lastT) / 1000);
    state.lastT = now;
    if (state.playing) {
      const bps = (125 * (state.speed / 100)) / 60;
      const prev = state.beat;
      state.beat += dt * bps;
      state.events.forEach((ev) => {
        if (ev.status === "pending" && prev <= ev.beat && state.beat >= ev.beat) {
          ev.status = "perfect";
          strum(ev.chord, ev.dir);
          state.floats.push({ text: "Perfeito!", color: "#fff", beat: ev.beat, t: performance.now() });
        }
      });
      if (state.beat >= state.total) {
        pause();
        state.beat = 0;
        state.events.forEach((e) => (e.status = "pending"));
      }
    }
    drawHighway();
    requestAnimationFrame(tick);
  }

  function setSpeed(v) {
    state.speed = Math.max(50, Math.min(125, Math.round(v / 5) * 5));
    const labels = document.querySelectorAll("[data-speed]");
    labels.forEach((el) => (el.textContent = state.speed + "%"));
    const slider = document.getElementById("speedSlider");
    if (slider) slider.value = String(state.speed);
  }

  function bind() {
    document.getElementById("btnPlay")?.addEventListener("click", () => (state.playing ? pause() : start()));
    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      if ((e.clientY - rect.top) / rect.height < 0.32) return;
      tap();
    });
    document.getElementById("btnSpeed")?.addEventListener("click", () => {
      document.getElementById("speedPanel")?.classList.toggle("open");
    });
    document.getElementById("speedDown")?.addEventListener("click", () => setSpeed(state.speed - 5));
    document.getElementById("speedUp")?.addEventListener("click", () => setSpeed(state.speed + 5));
    document.getElementById("speedSlider")?.addEventListener("input", (e) => setSpeed(Number(e.target.value)));
    document.getElementById("btnBack")?.addEventListener("click", () => {
      location.href = "../index.html";
    });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        tap();
      }
    });
    window.addEventListener("resize", drawHighway);
  }

  window.CD = { start, pause, tap, setSpeed, CHORDS, state };

  window.addEventListener("load", () => {
    compile();
    bind();
    syncPlayBtn();
    setSpeed(100);
    requestAnimationFrame(tick);
  });
})();
