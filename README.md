# WireSim Sandbox

WireSim is an educational electrical workbench centered on one always-live canvas. Place devices, connect labeled terminals with sized conductors, change a setting, and read evidence from the same bounded model.

## Run locally

```bash
npm install
npm run dev
```

Release checks:

```bash
npm run typecheck
npm test
npm run catalog:check
npm run ui:check
npm run build
```

The Sandbox supports terminal-aware DC/AC/data/earth connections, orthogonal labeled wires with draggable persisted bends, terminal-accurate endpoints and gauge-scaled conductor strokes, a focusable canvas with grid-snapped keyboard movement and additive multi-selection, device duplication, mobile-width action wrapping, Grid/Shore sources, open/closed transfer paths, four explicit AC profiles, live terminal diagnostics and device-state indicators, persisted meter probes, isolated fault challenges, measurable design requirements, local autosave, v1 migration, JSON export/import with custom catalogue definitions, and contextual source-linked model references. A small verified model core is separated from partially verified references. Faults, lessons, model references and projects are entry flows around the same workbench rather than separate dashboard products.

The solver is deterministic and educational. It reports boundaries and unsupported/invalid connections; it is not SPICE, a telemetry tool, wiring approval, or a substitute for current manufacturer documentation and applicable standards. See [docs/SIMULATION_LIMITS.md](docs/SIMULATION_LIMITS.md), [docs/RESEARCH_GATE.md](docs/RESEARCH_GATE.md), and [goal.md](goal.md) for the current handoff state.

The active product direction is defined by [SANDBOX_REFOCUS_PLAN.md](SANDBOX_REFOCUS_PLAN.md); superseded dashboard plans are not part of the release contract. The remaining manual browser gate is documented in [docs/BROWSER_QA_CHECKLIST.md](docs/BROWSER_QA_CHECKLIST.md).

Verification status: typecheck, 54 tests, catalogue validation, a dependency-free responsive/accessibility UI audit, and the production Vite build pass. Catalogue validation reports 105 records, 84 source-linked Victron records, and three verified models. Diagnostic signature changes are retained as bounded evidence history in the project, and live device states are rendered on the canvas. Wire labels include gauge, length, material, parallel count, and colour metadata. The local server returns HTTP 200 for `/` and `/src/main.tsx`. The remaining release-gate item is browser interaction QA across responsive widths; browser-control and Windows-control tools were unavailable during the last verification pass.
