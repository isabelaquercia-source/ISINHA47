import { render } from "./render.js";

const appEl = document.getElementById("app");

const store = {
  regions: [],
  dysfunctions: [],
  relations: [],
  movements: [],
  exercises: [],
  route: { view: "home" },
  history: [],
};

async function loadData() {
  const files = ["regions", "dysfunctions", "relations", "movements", "exercises"];
  const results = await Promise.all(
    files.map(async (name) => {
      const res = await fetch(`./data/${name}.json`);
      if (!res.ok) throw new Error(`Falha ao carregar ${name}.json`);
      return [name, await res.json()];
    }),
  );
  for (const [name, data] of results) store[name] = data;
}

function paint() {
  appEl.innerHTML = render(store);
  bind();
}

function go(route, { push = true } = {}) {
  if (push) store.history.push({ ...store.route });
  store.route = route;
  paint();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function back() {
  const prev = store.history.pop();
  store.route = prev || { view: "home" };
  paint();
}

function openDys(id, from) {
  go({
    view: "card",
    dysId: id,
    tab: "oque",
    from,
    regionId: store.route.regionId,
    query: store.route.query,
  });
}

function bind() {
  appEl.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => {
      const nav = el.getAttribute("data-nav");
      if (nav === "home") {
        store.history = [];
        go({ view: "home" }, { push: false });
      } else if (nav === "map") go({ view: "map" });
      else if (nav === "search") go({ view: "search", query: store.route.query || "" });
      else if (nav === "region-back") {
        const regionId = store.route.regionId;
        go({ view: "region", regionId });
      } else if (nav === "back") back();
    });
  });

  appEl.querySelectorAll("[data-region]").forEach((el) => {
    const open = () => {
      const regionId = el.getAttribute("data-region");
      go({ view: "region", regionId });
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });

  // On map view, also show side panel when clicking hotspot without leaving — use region list view per spec
  // Spec: selecting region opens region list. Hotspots already go to region view via data-region.

  appEl.querySelectorAll("[data-open-dys]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-open-dys");
      const from =
        store.route.view === "search"
          ? "search"
          : store.route.view === "region" || store.route.view === "map"
            ? "region"
            : store.route.from || "map";
      openDys(id, from);
    });
  });

  appEl.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      store.route = { ...store.route, tab: el.getAttribute("data-tab") };
      paint();
    });
  });

  appEl.querySelectorAll("[data-fill]").forEach((el) => {
    el.addEventListener("click", () => {
      go({ view: "search", query: el.getAttribute("data-fill") });
    });
  });

  const input = appEl.querySelector("#search-input");
  if (input) {
    let t;
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        store.route = { ...store.route, view: "search", query: input.value };
        paint();
        const again = appEl.querySelector("#search-input");
        if (again) {
          again.focus();
          const len = again.value.length;
          again.setSelectionRange(len, len);
        }
      }, 120);
    });
  }
}

function validateData() {
  const dysIds = new Set(store.dysfunctions.map((d) => d.id));
  const movIds = new Set(store.movements.map((m) => m.id));
  const exIds = new Set(store.exercises.map((e) => e.id));
  const regIds = new Set(store.regions.map((r) => r.id));

  for (const d of store.dysfunctions) {
    if (!regIds.has(d.regionId)) console.warn("regionId inválido", d.id, d.regionId);
    if (!movIds.has(d.movementId)) console.warn("movementId inválido", d.id, d.movementId);
    for (const eid of d.exerciseIds || []) {
      if (!exIds.has(eid)) console.warn("exerciseId inválido", d.id, eid);
    }
  }
  for (const rel of store.relations) {
    if (!dysIds.has(rel.fromId) || !dysIds.has(rel.toId)) {
      console.warn("relação órfã", rel);
    }
  }
  for (const r of store.regions) {
    const n = store.dysfunctions.filter((d) => d.regionId === r.id).length;
    if (n < 2) console.warn("região com menos de 2 disfunções", r.id, n);
  }
}

async function main() {
  try {
    await loadData();
    validateData();
    paint();
  } catch (err) {
    console.error(err);
    appEl.innerHTML = `
      <div class="error-box">
        <p>Não foi possível carregar o atlas.</p>
        <p>${String(err.message || err)}</p>
        <button type="button" class="cta cta-primary" id="retry">Tentar de novo</button>
      </div>`;
    appEl.querySelector("#retry")?.addEventListener("click", () => location.reload());
  }
}

main();
