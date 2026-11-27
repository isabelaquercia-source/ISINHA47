import { searchDysfunctions } from "./search.js";

const TABS = [
  { id: "oque", label: "O que é" },
  { id: "causas", label: "Causas e relações" },
  { id: "movimento", label: "Movimento" },
  { id: "mexe", label: "O que se mexe" },
  { id: "exercicios", label: "Exercícios" },
];

const DISCLAIMER =
  "Conteúdo educativo. Não substitui avaliação de fisioterapeuta ou médico. Use como mapa para conversar com um profissional.";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function topbar(store, { backLabel = "Voltar", backAction = "home" } = {}) {
  return `
    <div class="topbar">
      <button type="button" class="back" data-nav="${esc(backAction)}">← ${esc(backLabel)}</button>
      <div class="brand-mini">Atlas do Movimento</div>
    </div>`;
}

function bodyMapSvg(regions, activeId) {
  const hotspots = regions
    .map((r) => {
      const { cx, cy, r: rad } = r.hotspot;
      const selected = r.id === activeId ? ' stroke-width="3"' : "";
      return `
        <circle class="hotspot" data-region="${esc(r.id)}" tabindex="0" role="button"
          aria-label="${esc(r.label)}" cx="${cx}" cy="${cy}" r="${rad}"${selected}></circle>
        <text class="hotspot-label" x="${cx}" y="${cy + rad + 12}" text-anchor="middle">${esc(r.label)}</text>`;
    })
    .join("");

  return `
  <svg class="body-svg" viewBox="0 0 200 360" role="img" aria-label="Mapa do corpo">
    <defs>
      <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#cfe3d8"/>
        <stop offset="100%" stop-color="#8fad9c"/>
      </linearGradient>
    </defs>
    <ellipse cx="100" cy="348" rx="42" ry="6" fill="#000" opacity=".2"/>
    <g fill="url(#skin)" stroke="#dceee4" stroke-width="1.2" stroke-linejoin="round">
      <circle cx="100" cy="36" r="22"/>
      <path d="M100 58v18"/>
      <path d="M78 78c8-8 14-10 22-10s14 2 22 10l18 14c6 4 10 12 8 20l-10 48c-2 8-8 12-16 10l-8-2v52c0 22 2 44 4 66l4 36c1 6-3 10-8 9l-16-4-6-48-6 48-16 4c-5 1-9-3-8-9l4-36c2-22 4-44 4-66v-52l-8 2c-8 2-14-2-16-10L52 112c-2-8 2-16 8-20z" fill="url(#skin)" stroke="none"/>
      <path d="M78 78c-18 8-30 22-34 40l-8 40c-2 8 2 12 8 11l12-2 6-36c2-10 8-18 16-22z" opacity=".95"/>
      <path d="M122 78c18 8 30 22 34 40l8 40c2 8-2 12-8 11l-12-2-6-36c-2-10-8-18-16-22z" opacity=".95"/>
      <path d="M86 248c-2 28-4 52-6 74l-2 28h20l4-40 4-62z"/>
      <path d="M114 248c2 28 4 52 6 74l2 28h-20l-4-40-4-62z"/>
    </g>
    <g fill="none" stroke="#e8f0eb" stroke-opacity=".25" stroke-width="1">
      <path d="M100 76v110"/>
      <path d="M84 198h32"/>
    </g>
    ${hotspots}
  </svg>`;
}

function listItems(dysfunctions, regionLabelFn) {
  if (!dysfunctions.length) {
    return `<p class="empty">Em breve para esta região.</p>`;
  }
  return `<div class="list">${dysfunctions
    .map(
      (d) => `
      <button type="button" class="list-item" data-open-dys="${esc(d.id)}">
        ${regionLabelFn ? `<span class="chip">${esc(regionLabelFn(d))}</span>` : ""}
        <strong>${esc(d.namePopular)}</strong>
        <span>${esc(d.summary)}</span>
      </button>`,
    )
    .join("")}</div>`;
}

export function renderHome() {
  return `
  <section class="home">
    <h1 class="home-brand">Atlas do<br/>Movimento</h1>
    <p class="home-lead">Explore disfunções corporais, causas relacionadas, como o movimento deveria ser — e o que treinar.</p>
    <div class="cta-row">
      <button type="button" class="cta cta-primary" data-nav="map">Explorar pelo mapa</button>
      <button type="button" class="cta cta-ghost" data-nav="search">Buscar por sintoma</button>
    </div>
    <p class="disclaimer">${esc(DISCLAIMER)}</p>
  </section>`;
}

export function renderMap(store) {
  const { regions, route } = store;
  const active = route.regionId || null;
  const region = active ? regions.find((r) => r.id === active) : null;

  return `
  <div class="shell">
    ${topbar(store, { backLabel: "Início", backAction: "home" })}
    <div class="map-layout">
      <div>
        <div class="map-title">
          <h1>Mapa do corpo</h1>
          <p>Toque numa região para ver as disfunções dali.</p>
        </div>
        <div class="body-stage">${bodyMapSvg(regions, active)}</div>
      </div>
      <aside class="region-hint">
        ${
          region
            ? `<h2 style="font-family:var(--font-display);margin:0 0 .35rem">${esc(region.label)}</h2>
               <p class="muted">Disfunções nesta região:</p>
               ${listItems(store.dysfunctions.filter((d) => d.regionId === region.id))}`
            : `<p class="muted">Escolha um ponto no corpo. Cada região tem duas disfunções para começar a explorar.</p>
               <ul>${regions.map((r) => `<li><button type="button" class="back" data-region="${esc(r.id)}">${esc(r.label)}</button></li>`).join("")}</ul>`
        }
      </aside>
    </div>
  </div>`;
}

export function renderRegion(store) {
  const region = store.regions.find((r) => r.id === store.route.regionId);
  const items = store.dysfunctions.filter((d) => d.regionId === store.route.regionId);
  return `
  <div class="shell">
    ${topbar(store, { backLabel: "Mapa", backAction: "map" })}
    <div class="view-title">
      <h1>${esc(region?.label || "Região")}</h1>
      <p>Escolha uma disfunção para ver causas, movimento e exercícios.</p>
    </div>
    ${listItems(items)}
  </div>`;
}

export function renderSearch(store) {
  const q = store.route.query || "";
  const results = q
    ? searchDysfunctions(q, store)
    : [];
  const regionLabel = (d) => store.regions.find((r) => r.id === d.regionId)?.label || "";

  return `
  <div class="shell">
    ${topbar(store, { backLabel: "Início", backAction: "home" })}
    <div class="view-title">
      <h1>Buscar</h1>
      <p>Digite o que você sente ou vê — “ombro alto”, “escápula pra frente”, “rigidez”.</p>
    </div>
    <div class="search-box">
      <input type="search" id="search-input" placeholder="Ex.: ombro alto, escápula, joelho pra dentro"
        value="${esc(q)}" autocomplete="off" />
    </div>
    ${
      !q
        ? `<p class="empty">Sugestões: <button type="button" class="back" data-fill="ombro alto">ombro alto</button> ·
           <button type="button" class="back" data-fill="escápula pra frente">escápula pra frente</button> ·
           <button type="button" class="back" data-fill="joelho pra dentro">joelho pra dentro</button></p>
           <p class="empty"><button type="button" class="cta cta-ghost" data-nav="map">Ou explorar pelo mapa</button></p>`
        : results.length
          ? listItems(results, regionLabel)
          : `<p class="empty">Nada encontrado. Tente outro termo ou
             <button type="button" class="back" data-nav="map">abra o mapa</button>.</p>`
    }
  </div>`;
}

function relationsFor(store, dysId) {
  const causes = [];
  const consequences = [];
  const related = [];

  for (const rel of store.relations) {
    if (rel.kind === "may_cause" && rel.toId === dysId) {
      causes.push(rel);
    } else if (rel.kind === "may_cause" && rel.fromId === dysId) {
      consequences.push(rel);
    } else if (rel.kind === "often_related" && (rel.fromId === dysId || rel.toId === dysId)) {
      related.push(rel);
    }
  }
  return { causes, consequences, related };
}

function relButtons(store, rels, pickOther) {
  if (!rels.length) return `<p class="muted">Nenhuma relação mapeada nesta direção ainda.</p>`;
  return `<div class="rel-list">${rels
    .map((rel) => {
      const otherId = pickOther(rel);
      const other = store.dysfunctions.find((d) => d.id === otherId);
      if (!other) {
        console.warn("Relação órfã:", rel);
        return "";
      }
      return `<button type="button" class="rel-btn" data-open-dys="${esc(other.id)}">
        <strong>${esc(other.namePopular)}</strong>
        <small>${esc(rel.note || "")}</small>
      </button>`;
    })
    .join("")}</div>`;
}

function tabPanel(store, dys, tab) {
  const movement = store.movements.find((m) => m.id === dys.movementId);
  const exercises = (dys.exerciseIds || [])
    .map((id) => store.exercises.find((e) => e.id === id))
    .filter(Boolean);
  const { causes, consequences, related } = relationsFor(store, dys.id);
  const region = store.regions.find((r) => r.id === dys.regionId);

  if (tab === "oque") {
    return `
      <div class="panel">
        <h2>O que é</h2>
        <p><span class="chip">${esc(region?.label || "")}</span></p>
        <p>${esc(dys.summary)}</p>
        <p class="muted">${esc(dys.nameTechnical)}</p>
        <h2>Sinais comuns</h2>
        <ul>${(dys.signs || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      </div>`;
  }

  if (tab === "causas") {
    return `
      <div class="panel">
        <h2>Pode ser causado por</h2>
        ${relButtons(store, causes, (r) => r.fromId)}
        <h2>Pode contribuir para</h2>
        ${relButtons(store, consequences, (r) => r.toId)}
        <h2>Frequentemente relacionado</h2>
        ${relButtons(store, related, (r) => (r.fromId === dys.id ? r.toId : r.fromId))}
      </div>`;
  }

  if (tab === "movimento") {
    if (!movement) return `<div class="panel"><p class="muted">Movimento não encontrado.</p></div>`;
    return `
      <div class="panel">
        <h2>${esc(movement.title)}</h2>
        <div class="split">
          <div class="side ideal">
            <h3>Como deveria ser</h3>
            <p>${esc(movement.ideal)}</p>
          </div>
          <div class="side altered">
            <h3>O que a disfunção altera</h3>
            <p>${esc(movement.altered)}</p>
          </div>
        </div>
      </div>`;
  }

  if (tab === "mexe") {
    if (!movement) return `<div class="panel"><p class="muted">Movimento não encontrado.</p></div>`;
    const m = movement.muscles || {};
    return `
      <div class="panel">
        <h2>Articulações</h2>
        <ul>${(movement.joints || []).map((j) => `<li>${esc(j)}</li>`).join("")}</ul>
        <h2>Músculos</h2>
        <div class="muscle-grid">
          <div class="side"><h3>Agonistas</h3><ul>${(m.agonists || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
          <div class="side"><h3>Estabilizadores</h3><ul>${(m.stabilizers || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
          <div class="side"><h3>Compensadores</h3><ul>${(m.compensators || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        </div>
      </div>`;
  }

  return `
    <div class="panel">
      <h2>Exercícios que podem ajudar</h2>
      ${
        exercises.length
          ? exercises
              .map(
                (e) => `
            <article class="exercise">
              <h3>${esc(e.title)}</h3>
              <p class="goal">${esc(e.goal)}</p>
              <p><strong>Como fazer</strong></p>
              <ul>${(e.steps || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
              <p class="tag-avoid"><strong>Evite:</strong> ${(e.avoid || []).map(esc).join(" · ")}</p>
              <p class="muted"><strong>Progressão:</strong> ${esc(e.progression)}</p>
            </article>`,
              )
              .join("")
          : `<p class="muted">Nenhum exercício linkado.</p>`
      }
    </div>`;
}

export function renderCard(store) {
  const dys = store.dysfunctions.find((d) => d.id === store.route.dysId);
  if (!dys) {
    return `<div class="shell"><p class="error-box">Disfunção não encontrada.</p>
      <button type="button" class="cta cta-ghost" data-nav="home">Início</button></div>`;
  }
  const tab = store.route.tab || "oque";
  const back =
    store.route.from === "search"
      ? { backLabel: "Busca", backAction: "search" }
      : store.route.from === "region"
        ? { backLabel: "Região", backAction: "region-back" }
        : { backLabel: "Mapa", backAction: "map" };

  return `
  <div class="shell">
    ${topbar(store, back)}
    <header class="card-head">
      <h1>${esc(dys.namePopular)}</h1>
      <p class="tech">${esc(dys.nameTechnical)}</p>
    </header>
    <div class="tabs" role="tablist">
      ${TABS.map(
        (t) =>
          `<button type="button" class="tab" role="tab" data-tab="${t.id}" aria-selected="${t.id === tab}">${t.label}</button>`,
      ).join("")}
    </div>
    ${tabPanel(store, dys, tab)}
    <p class="disclaimer-strip">${esc(DISCLAIMER)}</p>
  </div>`;
}

export function render(store) {
  switch (store.route.view) {
    case "map":
      return renderMap(store);
    case "region":
      return renderRegion(store);
    case "search":
      return renderSearch(store);
    case "card":
      return renderCard(store);
    case "home":
    default:
      return renderHome();
  }
}
