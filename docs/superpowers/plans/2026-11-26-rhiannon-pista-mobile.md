# Rhiannon · Pista mobile (v1)

## Goal
Mobile-first Yousician-style track for one full song (**Rhiannon**) so Isabel can feel chords, strumming, fingerpicking and melody on the same engine. Portrait default; landscape supported.

## Out of scope (v1)
Home/library, mic listening, Path/stars, desktop-only layout, song editor UI.

## Files
- `ui-lab/guitar/rhiannon/index.html` — player (canvas track + controls)
- `ui-lab/guitar/index.html` — link into Guitar Lab
- `ui-lab/index.html` — lab index link if needed

## Song model
- Grid: 8 slots per bar (eighth notes)
- Sections: Intro (melody) → Verse (chords+strum) → Dedilhado → Figuração → Bridge melody → Outro
- Chords: Am / F (same palette as her celular prototype)
- Modes share one playhead, ball arc, and scroll camera

## Acceptance
1. Opens on phone portrait; rotating to landscape reflows the board
2. Play scrolls smoothly; white ball arcs between hits
3. Chord blocks show ↓/↑; melody shows fret pills on 6 strings
4. Speed 50–125%; section chips jump/loop
5. Served via local tunnel for mobile check
