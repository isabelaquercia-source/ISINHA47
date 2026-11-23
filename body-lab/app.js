const PROTOS = [
  {
    id: "forma",
    name: "Forma",
    mode: "treino",
    figure: "masculino · silhueta",
    blurb: "Agachamento em loop — motion nível máximo.",
    tone: "#0c0f0a",
  },
  {
    id: "atlas",
    name: "Atlas",
    mode: "anatomia",
    figure: "feminino · sombreado",
    blurb: "Consulta muscular com mapa clicável.",
    tone: "#2c2824",
    light: true,
  },
  {
    id: "link",
    name: "Link",
    mode: "teleconsulta",
    figure: "neutro · referência",
    blurb: "Sessão ao vivo com corpo-guia ao lado.",
    tone: "#101820",
  },
  {
    id: "acervo",
    name: "Acervo",
    mode: "catálogo",
    figure: "misto · miniaturas",
    blurb: "Biblioteca de movimentos pra escolher.",
    tone: "#1c1915",
  },
  {
    id: "estudio",
    name: "Estúdio",
    mode: "treino",
    figure: "masculino · editorial",
    blurb: "Spread de revista: um exercício, uma página.",
    tone: "#0b1c2c",
  },
  {
    id: "rolo",
    name: "Rolo",
    mode: "catálogo",
    figure: "feminino · vertical",
    blurb: "Feed vertical de execuções.",
    tone: "#090909",
  },
  {
    id: "traco",
    name: "Traço",
    mode: "anatomia",
    figure: "neutro · blueprint",
    blurb: "Planta técnica do movimento.",
    tone: "#041018",
  },
  {
    id: "espelho",
    name: "Espelho",
    mode: "treino",
    figure: "feminino · correção",
    blurb: "Forma certa vs forma a ajustar.",
    tone: "#141210",
  },
  {
    id: "orbita",
    name: "Órbita",
    mode: "anatomia",
    figure: "neutro · radial",
    blurb: "Seletor circular de grupos musculares.",
    tone: "#0e0e12",
  },
  {
    id: "giz",
    name: "Giz",
    mode: "teleconsulta",
    figure: "masculino · anotações",
    blurb: "Quadro do personal com corpo e notas.",
    tone: "#1a2330",
  },
];

const state = {
  view: "hub",
  proto: null,
  atlasFocus: "gluteo",
  orbita: "posterior",
  acervoFilter: "todos",
};

const app = document.getElementById("app");
const B = window.Bodies;

function mot(html, kind, extra = "") {
  return html.replace(/<svg\b/, `<svg data-motion="${kind}"${extra ? ` ${extra}` : ""}`);
}

function goHub() {
  state.view = "hub";
  state.proto = null;
  render();
}

function openProto(id) {
  state.view = "proto";
  state.proto = id;
  render();
}

function shiftProto(dir) {
  const i = PROTOS.findIndex((p) => p.id === state.proto);
  const next = PROTOS[(i + dir + PROTOS.length) % PROTOS.length];
  state.proto = next.id;
  render();
}

function modeLabel(m) {
  return (
    {
      treino: "Treino",
      anatomia: "Anatomia",
      teleconsulta: "Teleconsulta",
      catálogo: "Catálogo",
    }[m] || m
  );
}

function renderHub() {
  return `
  <div class="hub">
    <header class="hub-head">
      <div class="hub-brand">
        <span class="hub-mark">B</span>
        <div>
          <strong>Body Lab</strong>
          <p>10 protótipos · consulta de exercício</p>
        </div>
      </div>
      <p class="hub-hint">Agora com GSAP: agacha, afunda, terra, press, prancha · ← → no teclado</p>
    </header>
    <div class="hub-grid">
      ${PROTOS.map(
        (p, i) => `
        <button type="button" class="hub-card${p.light ? " hub-card-light" : ""}" data-open="${p.id}" style="--tone:${p.tone}">
          <span class="hub-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="hub-mode">${modeLabel(p.mode)}</span>
          <h2>${p.name}</h2>
          <p>${p.blurb}</p>
          <span class="hub-fig">${p.figure}</span>
        </button>`,
      ).join("")}
    </div>
  </div>`;
}

function shell(id, inner) {
  const p = PROTOS.find((x) => x.id === id);
  const idx = PROTOS.findIndex((x) => x.id === id);
  return `
  <div class="proto-shell proto-${id}">
    <header class="proto-bar">
      <button type="button" class="bar-btn" data-hub>← Hub</button>
      <div class="bar-mid">
        <strong>${p.name}</strong>
        <span>${modeLabel(p.mode)} · ${idx + 1}/10</span>
      </div>
      <div class="bar-nav">
        <button type="button" class="bar-btn" data-prev aria-label="Anterior">‹</button>
        <button type="button" class="bar-btn" data-next aria-label="Próximo">›</button>
      </div>
    </header>
    <div class="proto-stage">${inner}</div>
  </div>`;
}

/* ——— 01 FORMA ——— */
function renderForma() {
  return shell(
    "forma",
    `
    <section class="forma">
      <div class="forma-bg" aria-hidden="true"></div>
      <div class="forma-copy">
        <p class="forma-brand">FORMA</p>
        <h1>Agachamento<br/>livre</h1>
        <p class="forma-sub">Controle a descida. Joelhos no rastro dos pés. Peito aberto.</p>
        <div class="forma-cta">
          <button type="button" class="forma-go">Iniciar set</button>
          <span>4 × 8 · descanso 90s</span>
        </div>
      </div>
      <div class="forma-body">
        ${mot(B.maleSquat({ mode: "silhouette", accent: "#c8f542", ink: "#e7e2d6" }), "squat")}
        <div class="forma-meter"><span></span></div>
      </div>
    </section>`,
  );
}

/* ——— 02 ATLAS ——— */
function renderAtlas() {
  const zones = [
    { id: "gluteo", label: "Glúteo máximo", note: "Motor principal da extensão de quadril no avanço." },
    { id: "quad", label: "Quadríceps", note: "Estabiliza o joelho da perna da frente." },
    { id: "core", label: "Core", note: "Trava a coluna e evita colapso lombar." },
  ];
  const active = zones.find((z) => z.id === state.atlasFocus) || zones[0];
  return shell(
    "atlas",
    `
    <section class="atlas">
      <aside class="atlas-side">
        <p class="atlas-kicker">Consulta anatômica</p>
        <h1>Afundo<br/>reverso</h1>
        <ul class="atlas-list">
          ${zones
            .map(
              (z) => `
            <li>
              <button type="button" class="${z.id === state.atlasFocus ? "on" : ""}" data-atlas="${z.id}">
                ${z.label}
              </button>
            </li>`,
            )
            .join("")}
        </ul>
        <article class="atlas-note">
          <h3>${active.label}</h3>
          <p>${active.note}</p>
        </article>
      </aside>
      <div class="atlas-stage">
        ${mot(B.femaleLunge({ mode: "shaded", accent: "#c45c3e", ink: "#1c1917" }), "lunge")}
        <div class="atlas-tags">
          <span class="${state.atlasFocus === "gluteo" ? "on" : ""}" style="--x:58%;--y:52%">glúteo</span>
          <span class="${state.atlasFocus === "quad" ? "on" : ""}" style="--x:42%;--y:66%">quad</span>
          <span class="${state.atlasFocus === "core" ? "on" : ""}" style="--x:52%;--y:38%">core</span>
        </div>
      </div>
    </section>`,
  );
}

/* ——— 03 LINK ——— */
function renderLink() {
  return shell(
    "link",
    `
    <section class="link">
      <div class="link-live">
        <div class="link-cam">
          <span class="link-dot"></span>
          <p>Você · ao vivo</p>
          <div class="link-cam-body">${mot(B.neutralDeadlift({ mode: "silhouette", accent: "#5ec8ff", ink: "#d9e2ea" }), "deadlift")}</div>
        </div>
        <div class="link-coach">
          <p>Marina · personal</p>
          <div class="link-coach-face" aria-hidden="true"></div>
        </div>
      </div>
      <aside class="link-panel">
        <p class="link-brand">LINK</p>
        <h1>Levantamento terra</h1>
        <p>Referência neutra pra alinhar quadril e barra. Personal anota em tempo real.</p>
        <div class="link-ref">${mot(B.neutralDeadlift({ mode: "shaded", accent: "#5ec8ff", ink: "#9fb4c5" }), "deadlift", 'data-delay="0.35"')}</div>
        <ul class="link-notes">
          <li class="ok">Barra rente à canela</li>
          <li class="ok">Ombros à frente da barra</li>
          <li class="warn">Evitar arredondar lombar</li>
        </ul>
        <button type="button" class="link-btn">Marcar rep limpa</button>
      </aside>
    </section>`,
  );
}

/* ——— 04 ACERVO ——— */
function renderAcervo() {
  const items = [
    { id: "squat", title: "Agachamento", tag: "pernas", kind: "squat" },
    { id: "lunge", title: "Afundo", tag: "pernas", kind: "lunge" },
    { id: "deadlift", title: "Terra", tag: "posterior", kind: "deadlift" },
    { id: "press", title: "Desenvolvimento", tag: "ombro", kind: "press" },
    { id: "plank", title: "Prancha", tag: "core", kind: "plank" },
    { id: "squat2", title: "Goblet", tag: "pernas", kind: "squat" },
  ];
  const filters = ["todos", "pernas", "posterior", "ombro", "core"];
  const filtered =
    state.acervoFilter === "todos"
      ? items
      : items.filter((i) => i.tag === state.acervoFilter);
  return shell(
    "acervo",
    `
    <section class="acervo">
      <header class="acervo-head">
        <div>
          <p>Catálogo</p>
          <h1>Acervo de movimentos</h1>
        </div>
        <div class="acervo-filters">
          ${filters
            .map(
              (f) => `
            <button type="button" class="${state.acervoFilter === f ? "on" : ""}" data-acervo="${f}">${f}</button>`,
            )
            .join("")}
        </div>
      </header>
      <div class="acervo-grid">
        ${filtered
          .map(
            (it) => `
          <article class="acervo-item">
            <div class="acervo-thumb">${mot(B.miniPose(it.kind, "#d4a574", "#f0e6d8"), it.kind === "plank" ? "plank" : it.kind, `data-delay="${0.05 * filtered.indexOf(it)}" data-intensity="0.85"`)}</div>
            <h3>${it.title}</h3>
            <p>${it.tag}</p>
          </article>`,
          )
          .join("")}
      </div>
    </section>`,
  );
}

/* ——— 05 ESTÚDIO ——— */
function renderEstudio() {
  return shell(
    "estudio",
    `
    <section class="estudio">
      <div class="estudio-left">
        <p class="estudio-issue">Vol. 03 · Sessão de força</p>
        <h1>Desenvolvimento<br/><em>militar</em></h1>
        <p class="estudio-lead">Empurre o teto sem perder o chão. Escápulas estáveis, costelas fechadas, caminho vertical.</p>
        <dl class="estudio-meta">
          <div><dt>Séries</dt><dd>5</dd></div>
          <div><dt>Reps</dt><dd>5</dd></div>
          <div><dt>Tempo</dt><dd>2–0–1</dd></div>
        </dl>
      </div>
      <div class="estudio-right">
        ${mot(B.malePress({ accent: "#e2b857", ink: "#f3efe6" }), "press")}
        <p class="estudio-cap">Figura masculina · press em loop</p>
      </div>
    </section>`,
  );
}

/* ——— 06 ROLO ——— */
function renderRolo() {
  return shell(
    "rolo",
    `
    <section class="rolo">
      <div class="rolo-phone">
        <article class="rolo-slide on">
          ${mot(B.femaleLunge({ mode: "silhouette", accent: "#ff7a59", ink: "#f5f5f5" }), "lunge")}
          <div class="rolo-meta">
            <h2>Afundo reverso</h2>
            <p>3 × 10 · cada lado</p>
            <button type="button">Salvar no treino</button>
          </div>
        </article>
        <div class="rolo-rail" aria-hidden="true">
          <span class="on"></span><span></span><span></span>
        </div>
      </div>
      <aside class="rolo-aside">
        <p class="rolo-brand">ROLO</p>
        <h1>Catálogo em reel</h1>
        <p>Uma execução por tela. Desliza, salva, monta a sessão.</p>
      </aside>
    </section>`,
  );
}

/* ——— 07 TRAÇO ——— */
function renderTraco() {
  return shell(
    "traco",
    `
    <section class="traco">
      <header class="traco-head">
        <p>DRW-07 · MOVIMENTO</p>
        <h1>Terra · vistas ortográficas</h1>
      </header>
      <div class="traco-board">
        <div class="traco-panel">
          <span>FRONT</span>
          ${mot(B.neutralDeadlift({ mode: "shaded", accent: "#3dd6ff", ink: "#7fdfff" }), "deadlift")}
        </div>
        <div class="traco-panel">
          <span>SIDE</span>
          ${mot(B.neutralDeadlift({ mode: "silhouette", accent: "#3dd6ff", ink: "#5ad0f0" }), "deadlift", 'data-delay="0.4"')}
        </div>
        <aside class="traco-spec">
          <h3>Spec</h3>
          <ul>
            <li>Ângulo de quadril · 15–25°</li>
            <li>Barra no meio do pé</li>
            <li>Cervical neutra</li>
            <li>Pegada pronada · ombro width</li>
          </ul>
          <p class="traco-code">REF · NTR-DL-01</p>
        </aside>
      </div>
    </section>`,
  );
}

/* ——— 08 ESPELHO ——— */
function renderEspelho() {
  return shell(
    "espelho",
    `
    <section class="espelho">
      <h1 class="espelho-title">Checagem de forma</h1>
      <div class="espelho-pair">
        <article class="espelho-pane bad">
          <p>Ajustar</p>
          ${mot(B.femaleLunge({ mode: "silhouette", accent: "#e85d4c", ink: "#c4b8a8" }), "lunge", 'data-intensity="1.15"')}
          <ul>
            <li>Joelho passa demais da ponta</li>
            <li>Tronco cai pra frente</li>
          </ul>
        </article>
        <article class="espelho-pane good">
          <p>Alvo</p>
          ${mot(B.femaleLunge({ mode: "silhouette", accent: "#5dcf8a", ink: "#e8dfd4" }), "lunge", 'data-delay="0.25" data-intensity="0.9"')}
          <ul>
            <li>Tíbia mais vertical</li>
            <li>Peito alto · core travado</li>
          </ul>
        </article>
      </div>
      <button type="button" class="espelho-btn">Entendi · próxima rep</button>
    </section>`,
  );
}

/* ——— 09 ÓRBITA ——— */
function renderOrbita() {
  const nodes = [
    { id: "posterior", label: "Posterior", a: "-90" },
    { id: "core", label: "Core", a: "0" },
    { id: "pernas", label: "Pernas", a: "90" },
    { id: "ombros", label: "Ombros", a: "180" },
  ];
  return shell(
    "orbita",
    `
    <section class="orbita">
      <div class="orbita-ring">
        ${nodes
          .map(
            (n) => `
          <button type="button" class="orbita-node ${state.orbita === n.id ? "on" : ""}" style="--a:${n.a}deg" data-orbita="${n.id}">
            ${n.label}
          </button>`,
          )
          .join("")}
        <div class="orbita-core">
          ${mot(B.neutralDeadlift({ mode: "silhouette", accent: "#a78bfa", ink: "#eceaf5" }), "deadlift")}
        </div>
      </div>
      <aside class="orbita-info">
        <p>Anatomia radial</p>
        <h1>${nodes.find((n) => n.id === state.orbita).label}</h1>
        <p>Gire o foco pelo anel. O corpo neutro fica no centro como âncora visual da consulta.</p>
      </aside>
    </section>`,
  );
}

/* ——— 10 GIZ ——— */
function renderGiz() {
  return shell(
    "giz",
    `
    <section class="giz">
      <div class="giz-board">
        <header>
          <p>Sessão · 23 nov</p>
          <h1>Agachamento — cues</h1>
        </header>
        <div class="giz-body">
          ${mot(B.maleSquat({ mode: "shaded", accent: "#f5e6c8", ink: "#f5e6c8" }), "squat")}
          <svg class="giz-marks" viewBox="0 0 200 320" aria-hidden="true">
            <path d="M130 100c20-10 40-8 50 4" fill="none" stroke="#f5e6c8" stroke-width="1.5" stroke-dasharray="4 3"/>
            <text x="150" y="88" fill="#f5e6c8" font-size="11" font-family="IBM Plex Mono, monospace">peito ↑</text>
            <path d="M70 200c-24 10-36 28-34 46" fill="none" stroke="#f5e6c8" stroke-width="1.5" stroke-dasharray="4 3"/>
            <text x="18" y="250" fill="#f5e6c8" font-size="11" font-family="IBM Plex Mono, monospace">joelho</text>
          </svg>
        </div>
        <ul class="giz-notes">
          <li>1. Empurra o chão</li>
          <li>2. Respiração brace</li>
          <li>3. Profundidade paralela</li>
        </ul>
      </div>
      <aside class="giz-side">
        <p class="giz-brand">GIZ</p>
        <h2>Teleconsulta no quadro</h2>
        <p>Personal desenha em cima do corpo. Você leva as cues pra casa.</p>
        <button type="button">Exportar quadro</button>
      </aside>
    </section>`,
  );
}

const RENDERERS = {
  forma: renderForma,
  atlas: renderAtlas,
  link: renderLink,
  acervo: renderAcervo,
  estudio: renderEstudio,
  rolo: renderRolo,
  traco: renderTraco,
  espelho: renderEspelho,
  orbita: renderOrbita,
  giz: renderGiz,
};

function render() {
  if (window.BodyMotion) BodyMotion.killAll();
  app.innerHTML = state.view === "hub" ? renderHub() : RENDERERS[state.proto]();
  wire();
  requestAnimationFrame(() => {
    if (window.BodyMotion) BodyMotion.bootStage(app);
  });
}

function wire() {
  app.querySelectorAll("[data-open]").forEach((el) =>
    el.addEventListener("click", () => openProto(el.dataset.open)),
  );
  app.querySelectorAll("[data-hub]").forEach((el) => el.addEventListener("click", goHub));
  app.querySelectorAll("[data-prev]").forEach((el) =>
    el.addEventListener("click", () => shiftProto(-1)),
  );
  app.querySelectorAll("[data-next]").forEach((el) =>
    el.addEventListener("click", () => shiftProto(1)),
  );
  app.querySelectorAll("[data-atlas]").forEach((el) =>
    el.addEventListener("click", () => {
      state.atlasFocus = el.dataset.atlas;
      render();
    }),
  );
  app.querySelectorAll("[data-acervo]").forEach((el) =>
    el.addEventListener("click", () => {
      state.acervoFilter = el.dataset.acervo;
      render();
    }),
  );
  app.querySelectorAll("[data-orbita]").forEach((el) =>
    el.addEventListener("click", () => {
      state.orbita = el.dataset.orbita;
      render();
    }),
  );
}

document.addEventListener("keydown", (e) => {
  if (state.view !== "proto") return;
  if (e.key === "ArrowLeft") shiftProto(-1);
  if (e.key === "ArrowRight") shiftProto(1);
  if (e.key === "Escape") goHub();
});

render();
