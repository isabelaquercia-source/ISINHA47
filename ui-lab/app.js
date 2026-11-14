const SCREENS = [
  { id: "hub", label: "Hub" },
  { id: "torre", label: "Torre" },
  { id: "estudo", label: "Estudo" },
  { id: "jogo", label: "Jogo" },
  { id: "foco", label: "Foco" },
  { id: "veredito", label: "Veredito" },
];

const INGREDIENTS = [
  { id: "jogo", label: "Joguinho no browser" },
  { id: "estudo", label: "Lab / simulado" },
  { id: "site", label: "Site pessoal" },
  { id: "motion", label: "Animação caprichada" },
  { id: "plan", label: "Começar pelo plano" },
];

const CARDS = [
  {
    q: "O que é UI de verdade?",
    a: "Não é decoração. É resposta: você toca, algo acontece, e fica claro o próximo passo.",
  },
  {
    q: "Por que motion importa?",
    a: "Movimento bom guia o olhar. Movimento ruim só cansa. Hierarquia > efeito.",
  },
  {
    q: "Quando pedir Plan pra Queen?",
    a: "Quando a ideia é grande demais pra chutar. Compara caminhos, aí implementa.",
  },
];

const state = {
  screen: "hub",
  picks: new Set(["jogo", "motion"]),
  projectName: "Meu lab",
  card: 0,
  flipped: false,
  known: 0,
  score: 0,
  best: Number(localStorage.getItem("queen-ui-best") || 0),
  running: false,
  timeLeft: 10,
  target: { x: 40, y: 40 },
  focusMin: 25,
  focusLeft: 25 * 60,
  focusOn: false,
  verdict: localStorage.getItem("queen-ui-verdict") || "",
};

const stage = document.getElementById("stage");
const tabs = document.getElementById("tabs");
const hint = document.getElementById("verdict-hint");

let gameTimer = null;
let focusTimer = null;
let wired = false;

function go(id) {
  state.screen = id;
  stopGameLoop(false);
  render();
}

function renderTabs() {
  tabs.innerHTML = SCREENS.map(
    (s) =>
      `<button type="button" class="${s.id === state.screen ? "active" : ""}" data-go="${s.id}">${s.label}</button>`,
  ).join("");
}

function layerLabel(id) {
  return (
    {
      plan: "plano escrito",
      estudo: "quiz / flashcards",
      jogo: "loop de jogo",
      site: "UI + rotas",
      motion: "motion layer",
    }[id] || id
  );
}

function towerLayers() {
  const order = ["plan", "estudo", "jogo", "site", "motion"];
  return order.filter((id) => state.picks.has(id)).map(layerLabel);
}

function renderHub() {
  return `
    <section class="hero">
      <div class="orb" aria-hidden="true"></div>
      <span class="eyebrow">UI Lab · round 1</span>
      <h1>Testa se eu sou sua salvadora de interface.</h1>
      <p>Seis telas. Estilo próprio. Interação de verdade. Sem trava, sem missão obrigatória — só julgamento.</p>
      <div class="hero-actions">
        <button class="btn btn-lime" data-go="torre">Começar pela Torre</button>
        <button class="btn btn-soft" data-go="jogo">Pular pro jogo</button>
      </div>
      <div class="chip-row">
        <span class="chip">Instrument Serif + Outfit</span>
        <span class="chip">teal / lima / coral</span>
        <span class="chip">motion leve</span>
      </div>
    </section>
  `;
}

function renderTorre() {
  const layers = towerLayers();
  return `
    <section class="panel">
      <div class="panel-head">
        <h1>Torre do projeto</h1>
        <p>Aquela UI que você gostou — agora em versão “produto”. Liga ingredientes e a torre sobe.</p>
      </div>
      <div class="panel-body grid-2">
        <div>
          <label class="muted" for="pname">Nome</label>
          <input id="pname" class="field mt-12" value="${escapeHtml(state.projectName)}" maxlength="40" />
          <div class="toggle-list mt-18">
            ${INGREDIENTS.map(
              (ing) => `
              <div class="toggle-row">
                <span>${ing.label}</span>
                <button type="button" class="switch ${state.picks.has(ing.id) ? "on" : ""}" data-toggle="${ing.id}" aria-pressed="${state.picks.has(ing.id)}">
                  <span></span>
                </button>
              </div>`,
            ).join("")}
          </div>
        </div>
        <div>
          <div class="tower-wrap">
            ${
              layers.length
                ? layers
                    .map(
                      (l, i) =>
                        `<div class="tower-layer" style="animation-delay:${i * 40}ms">${l}</div>`,
                    )
                    .join("")
                : `<p class="muted">Marque algo pra torre nascer.</p>`
            }
          </div>
          <p class="muted mt-18">Pedido gerado:</p>
          <p class="mt-12"><strong>${escapeHtml(state.projectName || "meu projeto")}</strong> · ${
            layers.join(" + ") || "vazio"
          }</p>
        </div>
      </div>
    </section>
  `;
}

function renderEstudo() {
  const card = CARDS[state.card % CARDS.length];
  const pct = Math.round((state.known / CARDS.length) * 100);
  return `
    <section class="panel">
      <div class="panel-head">
        <h1>Lab de estudo</h1>
        <p>Flashcard com revelação. Bom pra prova, revisão, ou só pra sentir o ritmo da UI.</p>
      </div>
      <div class="panel-body grid-2">
        <div>
          <button type="button" class="flip-card ${state.flipped ? "back" : ""}" id="flip">
            <span class="meta">${state.flipped ? "resposta" : "pergunta"} · clique</span>
            <h3>${state.flipped ? card.a : card.q}</h3>
          </button>
          <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
          <div class="row mt-18">
            <button class="btn btn-soft" id="skip">Próxima</button>
            <button class="btn btn-accent" id="know">Já sei</button>
          </div>
        </div>
        <div>
          <div class="hud">
            <div class="stat"><span class="muted">carta</span><b>${(state.card % CARDS.length) + 1}/${CARDS.length}</b></div>
            <div class="stat"><span class="muted">já sei</span><b>${state.known}</b></div>
            <div class="stat"><span class="muted">foco</span><b>${pct}%</b></div>
          </div>
          <p class="muted mt-18">Dá pra virar um simulado com timer, ranking de temas fracos e animação de acerto.</p>
        </div>
      </div>
    </section>
  `;
}

function renderJogo() {
  return `
    <section class="panel">
      <div class="panel-head">
        <h1>Alvo relâmpago</h1>
        <p>UI de jogo limpa: HUD, arena escura, alvo com pulso. 10 segundos.</p>
      </div>
      <div class="panel-body grid-2">
        <div>
          <div class="hud">
            <div class="stat"><span class="muted">agora</span><b>${state.score}</b></div>
            <div class="stat"><span class="muted">recorde</span><b>${state.best}</b></div>
            <div class="stat"><span class="muted">tempo</span><b>${state.timeLeft}s</b></div>
          </div>
          <div class="row mt-18">
            <button class="btn btn-primary" id="play">${state.running ? "Reiniciar" : "Jogar"}</button>
            <button class="btn btn-soft" data-go="veredito">Já vi o suficiente</button>
          </div>
        </div>
        <div class="arena" id="arena">
          <button
            type="button"
            class="target"
            id="target"
            ${state.running ? "" : "disabled"}
            style="left:${state.target.x}%; top:${state.target.y}%"
            aria-label="alvo"
          ></button>
        </div>
      </div>
    </section>
  `;
}

function renderFoco() {
  const m = Math.floor(state.focusLeft / 60);
  const s = String(state.focusLeft % 60).padStart(2, "0");
  const p = Math.max(8, Math.round(((state.focusMin * 60 - state.focusLeft) / (state.focusMin * 60)) * 100));
  return `
    <section class="panel">
      <div class="panel-head">
        <h1>Modo foco</h1>
        <p>UI calma pra estudar/programar. Anel vivo, tipografia grande, zero bagunça.</p>
      </div>
      <div class="panel-body">
        <div class="focus-ring" style="--p:${p}%">
          <div>
            <strong>${m}:${s}</strong>
            <div class="muted">${state.focusOn ? "em sessão" : "pronto"}</div>
          </div>
        </div>
        <div class="row" style="justify-content:center; margin-top:8px">
          <button class="btn btn-soft" data-focus="15">15 min</button>
          <button class="btn btn-soft" data-focus="25">25 min</button>
          <button class="btn btn-soft" data-focus="45">45 min</button>
          <button class="btn btn-accent" id="focus-toggle">${state.focusOn ? "Pausar" : "Iniciar"}</button>
        </div>
      </div>
    </section>
  `;
}

function renderVeredito() {
  const options = [
    { id: "salvador", title: "Salvador(a)", desc: "Fecha. Quero que você construa meu próximo projeto." },
    { id: "quase", title: "Quase", desc: "Gostei da direção, mas quero outra vibe visual." },
    { id: "mais", title: "Me mostra mais", desc: "Manda mais 3 UIs em estilos bem diferentes." },
  ];
  return `
    <section class="panel">
      <div class="panel-head">
        <h1>Então… salvadora?</h1>
        <p>Sem enrolação. Escolhe um veredito. Eu leio isso e sigo no ritmo certo.</p>
      </div>
      <div class="panel-body">
        <div class="verdict-grid">
          ${options
            .map(
              (o) => `
            <button type="button" class="vote ${state.verdict === o.id ? "picked" : ""}" data-verdict="${o.id}">
              <h4>${o.title}</h4>
              <p>${o.desc}</p>
            </button>`,
            )
            .join("")}
        </div>
        <p class="muted mt-18" id="verdict-msg">
          ${
            state.verdict
              ? `Registrado: <strong>${state.verdict}</strong>. Volta no chat e confirma — eu continuo de lá.`
              : "Ainda sem veredito."
          }
        </p>
      </div>
    </section>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  renderTabs();
  const map = {
    hub: renderHub,
    torre: renderTorre,
    estudo: renderEstudo,
    jogo: renderJogo,
    foco: renderFoco,
    veredito: renderVeredito,
  };
  stage.innerHTML = map[state.screen]();
  hint.textContent = state.verdict
    ? `Veredito: ${state.verdict}`
    : "No final você me diz: salvador ou quase?";
}

function scramble() {
  state.target = {
    x: 8 + Math.random() * 75,
    y: 12 + Math.random() * 60,
  };
}

function stopGameLoop(saveBest) {
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
  if (saveBest && state.score > state.best) {
    state.best = state.score;
    localStorage.setItem("queen-ui-best", String(state.best));
  }
  state.running = false;
}

function startGame() {
  stopGameLoop(false);
  state.score = 0;
  state.timeLeft = 10;
  state.running = true;
  scramble();
  render();
  gameTimer = setInterval(() => {
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      stopGameLoop(true);
      render();
      return;
    }
    const t = document.getElementById("target");
    const stats = stage.querySelectorAll(".hud b");
    if (stats[2]) stats[2].textContent = `${state.timeLeft}s`;
    if (!t) render();
  }, 1000);
}

function wireOnce() {
  if (wired) return;
  wired = true;

  document.addEventListener("click", (e) => {
    const goEl = e.target.closest("[data-go]");
    if (goEl) {
      go(goEl.getAttribute("data-go"));
      return;
    }

    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const id = toggle.getAttribute("data-toggle");
      if (state.picks.has(id)) state.picks.delete(id);
      else state.picks.add(id);
      render();
      return;
    }

    if (e.target.closest("#flip")) {
      state.flipped = !state.flipped;
      render();
      return;
    }
    if (e.target.closest("#skip")) {
      state.card += 1;
      state.flipped = false;
      render();
      return;
    }
    if (e.target.closest("#know")) {
      state.known = Math.min(CARDS.length, state.known + 1);
      state.card += 1;
      state.flipped = false;
      render();
      return;
    }
    if (e.target.closest("#play")) {
      startGame();
      return;
    }
    if (e.target.closest("#target")) {
      if (!state.running) return;
      state.score += 1;
      scramble();
      const target = document.getElementById("target");
      const stats = stage.querySelectorAll(".hud b");
      if (stats[0]) stats[0].textContent = String(state.score);
      if (target) {
        target.style.left = `${state.target.x}%`;
        target.style.top = `${state.target.y}%`;
      }
      return;
    }

    const focusBtn = e.target.closest("[data-focus]");
    if (focusBtn) {
      const mins = Number(focusBtn.getAttribute("data-focus"));
      state.focusMin = mins;
      state.focusLeft = mins * 60;
      state.focusOn = false;
      if (focusTimer) clearInterval(focusTimer);
      render();
      return;
    }
    if (e.target.closest("#focus-toggle")) {
      state.focusOn = !state.focusOn;
      if (focusTimer) clearInterval(focusTimer);
      if (state.focusOn) {
        focusTimer = setInterval(() => {
          if (state.focusLeft <= 0) {
            state.focusOn = false;
            clearInterval(focusTimer);
            render();
            return;
          }
          state.focusLeft -= 1;
          if (state.screen === "foco") render();
        }, 1000);
      }
      render();
      return;
    }

    const verdict = e.target.closest("[data-verdict]");
    if (verdict) {
      state.verdict = verdict.getAttribute("data-verdict");
      localStorage.setItem("queen-ui-verdict", state.verdict);
      render();
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "pname") {
      state.projectName = e.target.value.slice(0, 40);
    }
  });
}

wireOnce();
render();
