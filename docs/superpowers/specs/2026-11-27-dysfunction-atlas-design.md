# Dysfunction Atlas — Design Spec

**Date:** 2026-11-27  
**Status:** Draft for user review  
**App folder:** `dysfunction-atlas/`  
**Product name (UI):** Atlas do Movimento  
**Language:** Portuguese (pt-BR)

## 1. Problem

People notice posture and movement issues (forward scapula, elevated shoulder/trapezius, stiffness, compensations) but lack a clear, trustworthy way to explore: what it is, what causes it, what it relates to, how movement should look vs how the dysfunction changes it, which joints/muscles move, and which exercises may help.

## 2. Goals (v1)

- Interactive **catalog** of body dysfunctions (not camera diagnosis, not guided clinical assessment).
- **Full-body map** with few dysfunctions per region (broad coverage, shallower depth first).
- Tone: **layperson-friendly language** with **clinical physiotherapy depth** underneath.
- Two entry modes on **separate screens**: body **map** and **search**.
- Each dysfunction has a rich detail card: definition, causes/relations, ideal vs altered movement, joints/muscles, exercises.
- Educational disclaimer: does not replace professional evaluation.

## 3. Non-goals (v1)

- Camera / pose estimation / automatic identification.
- 3D skeletal animation.
- User accounts, saved progress, or personal training plans.
- Extending Body Lab hub as the product shell (Body Lab remains a UI lab; this is a standalone app).
- Exhaustive clinical encyclopedia of every dysfunction.

## 4. Architecture

Static web app (HTML + CSS + vanilla JS), same operational style as existing labs in the repo.

```
dysfunction-atlas/
  index.html
  styles.css
  js/
    app.js          # routing + view state
    render.js       # view renderers
    search.js       # search indexing / filter
  data/
    regions.json
    dysfunctions.json
    relations.json
    movements.json
    exercises.json
  assets/           # SVG body map + simple movement diagrams
```

**Serve locally:**

```bash
python3 -m http.server 8768 --bind 127.0.0.1 --directory dysfunction-atlas
```

No build step in v1. Data is plain JSON loaded at runtime.

## 5. Screens and navigation

### 5.1 Home

- Brand-forward first viewport (product name as hero signal).
- Two clear CTAs only: **Explorar pelo mapa** | **Buscar por sintoma**.
- Short supporting sentence + persistent educational disclaimer.

### 5.2 Map (separate screen)

- Full-body SVG silhouette, **front view only** in v1 (no back/side toggle).
- Clickable hotspots for regions (exact list in §7).
- Selecting a region opens a **region list** view: 2–3 dysfunctions (popular name + one-line summary).
- Back from region list → map; from map → home. Opening a dysfunction pushes the card; back from card → the view that opened it (region list or search).

### 5.3 Search (separate screen)

- Text field with placeholder examples (“ombro alto”, “escápula pra frente”, “rigidez”).
- Results match: popular name, technical name, aliases/symptoms, region label.
- Empty state with suggestions; no results state with “try region map” link.
- Selecting a result opens the dysfunction card.

### 5.4 Dysfunction card (core)

Tabbed detail (mobile: sticky tab bar; desktop: same tabs):

| Tab | Content |
|-----|---------|
| **O que é** | Popular name, technical name, region, plain-language description, common signs |
| **Causas e relações** | Drivers (what may cause this), consequences (what this may cause), related dysfunctions as clickable links |
| **Movimento** | Side-by-side: ideal pattern vs how the dysfunction alters it; short captions |
| **O que se mexe** | Joints involved; muscles (agonists / stabilizers / common compensators) |
| **Exercícios** | 3–5 exercises: goal, short steps, what to avoid, simple progression |

Global on card: back to previous list (region or search), disclaimer strip.

## 6. Data model

IDs are stable kebab-case strings.

### Region

```json
{
  "id": "ombro-escapula",
  "label": "Ombro e escápula",
  "hotspot": { "cx": 120, "cy": 90, "r": 28 }
}
```

### Dysfunction

```json
{
  "id": "escapula-protraida",
  "regionId": "ombro-escapula",
  "namePopular": "Escápula pra frente",
  "nameTechnical": "Protração escapular / scapular dyskinesis (protração)",
  "aliases": ["ombro arredondado", "escápula afastada"],
  "summary": "A escápula fica mais afastada da coluna e menos ‘grudada’ no tórax.",
  "signs": ["ombros caídos pra frente", "dificuldade de manter a escápula estável ao elevar o braço"],
  "movementId": "elevacao-braco-escapula",
  "exerciseIds": ["serratil-punch", "retratacao-escapular", "along-peitoral"]
}
```

### Relation

```json
{
  "fromId": "ombro-elevado",
  "toId": "escapula-protraida",
  "kind": "may_cause",
  "note": "Domínio do trapézio superior pode alterar o ritmo escapular e favorecer padrões de protrusão."
}
```

`kind` is only:

- `may_cause` — directed: `fromId` may contribute to `toId`. UI shows under **causas** on `toId` and under **consequências** on `fromId`.
- `often_related` — undirected association; shown as “relacionado” on both ends.

Do **not** use a separate `may_result_from` kind (that would duplicate the reverse of `may_cause`). Every `fromId` / `toId` must be an existing dysfunction id in `dysfunctions.json` (no orphan “factor-only” nodes in v1).

### Movement

```json
{
  "id": "elevacao-braco-escapula",
  "title": "Elevação do braço",
  "ideal": "Escápula estável no tórax no início; giro gradual (rotação superior) conforme o braço sobe.",
  "altered": "Escápula sobe cedo (encaixe no trapézio superior) ou se afasta do tórax; o ombro ‘busca’ amplitude.",
  "joints": ["glenoumeral", "escapulotorácica", "acromioclavicular"],
  "muscles": {
    "agonists": ["deltóide", "supraespinhal"],
    "stabilizers": ["serrátil anterior", "trapézio médio/inferior"],
    "compensators": ["trapézio superior", "levantador da escápula"]
  },
  "diagramIdeal": "assets/move-elevacao-ideal.svg",
  "diagramAltered": "assets/move-elevacao-altered.svg"
}
```

### Exercise

```json
{
  "id": "retratacao-escapular",
  "title": "Retração escapular na parede",
  "goal": "Ensinar a escápula a aproximar-se da coluna sem encolher o ombro para as orelhas.",
  "steps": ["Costas na parede", "Deslizar omoplatas para trás e levemente para baixo", "Segurar 5 s, relaxar"],
  "avoid": ["Elevar os ombros", "Arquear a lombar"],
  "progression": "De isometria curta → mais tempo → com faixa elástica leve"
}
```

## 7. v1 content scope

**Regions (exactly 9):**

1. `pescoco-cabeca` — Pescoço e cabeça  
2. `ombro-escapula` — Ombro e escápula  
3. `toracica` — Coluna torácica  
4. `lombar` — Coluna lombar  
5. `pelve` — Pelve  
6. `quadril` — Quadril  
7. `joelho` — Joelho  
8. `tornozelo-pe` — Tornozelo e pé  
9. `cotovelo-punho` — Cotovelo e punho  

**Dysfunctions:** exactly **2 per region** in the first seed (**18 total**), so every hotspot has content. Must include:

- Escápula pra frente (protração)  
- Ombro elevado / trapézio superior dominante  

Other regions get one clear pair each (e.g. forward head + stiffness; hyperkyphosis + rounded shoulders pattern; anterior pelvic tilt + related lumbar pattern; knee valgus + related hip control; etc.). Depth can grow later without changing the schema.

Content quality bar: accurate enough for education; always framed as possibilities (“pode estar relacionado”), never as diagnosis.

## 8. UI / visual direction

- One composition per screen; brand name is a hero-level signal on Home.
- Expressive typography (not Inter/Roboto/system default stack); reuse or pair fonts consistent with Body Lab where it helps, without copying purple/cream AI-default looks.
- Atmosphere via subtle gradient/pattern; body silhouette is the real visual anchor on Map.
- No cards in the hero. Lists and the dysfunction card use interaction containers only where needed.
- Motion: 2–3 intentional transitions (home → map/search; hotspot feedback; tab cross-fade). Respect `prefers-reduced-motion`.
- Responsive: usable on mobile and desktop.

## 9. Error handling and empty states

- Missing JSON / load failure: clear message + retry.
- Region with no dysfunctions (shouldn’t happen in v1 seed): “Em breve”.
- Search with no hits: suggestions + link to map.
- Broken relation/exercise id: skip silently in UI; log in console for authors.

## 10. Testing

- Manual: open all screens; click every region; open every dysfunction; follow at least one relation link; run search for popular names and aliases.
- Data check script (optional small Node or Python): every `regionId`, `movementId`, `exerciseIds`, and relation endpoints resolve.
- Visual check: home, map, search, and one full card on mobile width and desktop width.

## 11. Success criteria

- User can go Home → Map → region → dysfunction → all five tabs without dead ends.
- User can go Home → Search → type an alias → open the same dysfunction.
- Related dysfunctions are navigable.
- Ideal vs altered movement and exercises are present for every seeded dysfunction.
- Disclaimer visible on Home and Card.

## 12. Decisions locked in discovery

| Topic | Decision |
|-------|----------|
| Identification | Catalog (user selects), not camera/quiz |
| Coverage | Full body, few dysfunctions per region |
| Audience | Layperson language + clinical depth |
| Entry | Map and search both exist, **separate screens** |
| Approach | Standalone static atlas app (not Body Lab proto, not graph-first home) |
