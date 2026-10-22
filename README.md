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

The Sandbox supports terminal-aware DC/AC/data/earth connections, orthogonal labeled wires with draggable persisted bends, terminal-accurate endpoints and gauge-scaled conductor strokes, a focusable canvas with grid-snapped keyboard movement and additive multi-selection, device duplication, mobile-width action wrapping, Grid/Shore sources, open/closed transfer paths, four explicit AC profiles, live terminal diagnostics and device-state indicators, persisted meter probes, isolated fault challenges, measurable design requirements, local autosave, v1 migration, JSON export/import with custom catalogue definitions, and contextual source-linked model references. The manufacturer product catalogue is kept in the single editable [src/catalog-data.json](src/catalog-data.json) database and is grouped by component category and brand. Verified records can be applied to the bounded simulation; partially verified accessories and product variants remain research references with sourced claims and explicit missing-data checklists. The catalogue includes inverters/inverter-chargers, MPPT controllers, battery chargers, monitoring and communication interfaces, battery management, DC distribution, batteries, PV modules, and protection devices. See [docs/CATALOG_SOURCES.md](docs/CATALOG_SOURCES.md) for sourcing and quality rules.

The solver is deterministic and educational. It reports boundaries and unsupported/invalid connections; it is not SPICE, a telemetry tool, wiring approval, or a substitute for current manufacturer documentation and applicable standards. See [docs/SIMULATION_LIMITS.md](docs/SIMULATION_LIMITS.md), [docs/RESEARCH_GATE.md](docs/RESEARCH_GATE.md), and [goal.md](goal.md) for the current handoff state.

The active product direction is defined by [SANDBOX_REFOCUS_PLAN.md](SANDBOX_REFOCUS_PLAN.md); superseded dashboard plans are not part of the release contract. The remaining manual browser gate is documented in [docs/BROWSER_QA_CHECKLIST.md](docs/BROWSER_QA_CHECKLIST.md).

Catalogue records and sourcing were updated for this work; run the repository checks before treating the updated database or application build as verified. The remaining manual release-gate item is browser interaction QA across responsive widths.
