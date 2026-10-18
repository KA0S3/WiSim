# WireSim refocus goal

Source of truth: [SANDBOX_REFOCUS_PLAN.md](SANDBOX_REFOCUS_PLAN.md). The superseded product plan is not a completion authority.

## Handoff status — 2026-10-18

The app is rebuilt around one always-live Sandbox workbench. Completed work is checked below; remaining items are explicit.

## Stage 1 — research and architecture

- [x] Inventoried the previous dashboard, component-level wire model, persistence envelope, catalogue and behavioural simulation.
- [x] Researched React Flow handles/API (MIT), CircuitJS (GPL), and ngspice (mixed/modified-BSD, native simulator). See [docs/RESEARCH_GATE.md](docs/RESEARCH_GATE.md).
- [x] Decision: keep a focused custom SVG editor for this release; use explicit terminal IDs and a bounded educational solver. No external code or assets copied.

## Stage 2 — terminal-aware live workbench

- [x] Added DC, AC, data and earth terminal domains, roles, direction and default terminal layouts.
- [x] Added distinct inverter DC, AC-in, AC-out, PE and control terminals.
- [x] Added wire gauge/material/length fields and orthogonal labelled wire rendering.
- [x] Added wire parallel-conductor, insulation, colour, label, and lug metadata; parallel conductors now reduce the bounded cable resistance and render in labels.
- [x] Added terminal validation for missing endpoints, illegal domain joins and control/data boundaries.
- [x] Added supported AC profiles: 120 V/60 Hz, 230 V/50 Hz, split 120/240 V/60 Hz, and three-phase 400 V/50 Hz.
- [x] Removed the global Run/Pause control; values update continuously from edits and runtime state.
- [x] Replaced the old dashboard surface with a fixed workbench shell and internal rails/inspector scrolling.
- [x] Removed the unused legacy `Inspector` and `EntryPanel` dashboard implementations; the live workbench now has one active inspector/entry-flow path.
- [x] Added placement, grid-snapped movement, additive Shift/Ctrl multi-selection, safe multi-delete, labeled terminal click-to-wire, keyboard arrow movement with a focusable SVG canvas, Ctrl/Cmd+D duplication without copied wires, undo/redo, delete, export, responsive layout and live inspector evidence.
- [x] Kept additive selection, inspector focus, duplication, reset, and deletion targets synchronized when a modifier-click deselects a device.
- [x] Resetting the starter project now also clears stale multi-selection and wire-selection state.
- [x] Extended the dependency-free UI audit to guard additive selection and starter-reset state synchronization.
- [x] Added a phone-width top-bar wrap and compact canvas-help rule so mobile actions do not rely on a single overflowing row; the UI audit guards the responsive rule.
- [x] Added hover titles to zoom controls alongside their accessible labels, completing the compact icon-control tooltip pass.

## Stage 3 — data, evidence and release gate

- [x] Bumped persistence to schema v2 and preserve v1 wires as visible legacy links without guessing terminals.
- [x] Kept catalogue references contextual and source-linked; model gaps remain needs-verification.
- [x] Updated simulation boundaries and source-trail documentation for the refocused product.
- [x] Removed the superseded `Solar_WireSim_Complete_Project_Plan_v3.md`; `SANDBOX_REFOCUS_PLAN.md` is now the only product-plan source of truth.
- [x] `npm run verify` passes: typecheck, 54 tests, catalogue/source validation, dependency-free UI audit, and production build. The sandbox denied the first Vite build attempt; the same production build passed with approved elevated filesystem access.
- [x] Local Vite server smoke check returns HTTP 200 for `/` and `/src/main.tsx` after the latest UI/solver changes; the server was started and stopped cleanly with elevated filesystem access.
- [x] Added contextual equivalent scoring/application with explicit pass/fail/needs-verification checks and source links.
- [x] Added persisted voltage/current/resistance/continuity meter probes using the same live solution.
- [x] Added bounded diagnostic event history: only diagnostic-signature changes are persisted, recent events retain exact evidence/remedies, and the active inspector surfaces the latest entries.
- [x] Added isolated Fault Lab scenario copies, live objective evidence, reset, and normal-project restore without autosaving challenge state.
- [x] Added terminal network results: active paths, open terminals, terminal readings, device states, and explicit unsupported split/three-phase diagnostics.
- [x] Rendered live device states directly on canvas nodes so charging, inverting, overload, low-voltage, fault, and unsupported evidence is visible at its source as well as in the inspector.
- [x] Added a three-model verified catalogue core: SmartSolar MPPT 75/15, SmartSolar MPPT 100/30, and MultiPlus 12/1200/50, while retaining partially verified reference records.
- [x] Added wire selection/deletion, selected-wire highlighting, terminal focus styling, and visible conductor material/gauge/length labels.
- [x] Aligned rendered wire endpoints with persisted terminal IDs and scaled conductor stroke width from gauge, with SVG evidence titles and static UI-audit coverage.
- [x] Included documented lug termination resistance in the bounded live cable path, with an explicit evidence diagnostic and regression coverage.
- [x] Connected persisted wire bend points to the orthogonal renderer; the selected bend handle can be dragged and remains schema-safe on reload/import.
- [x] Added measurable design requirements for 230 V backup and split-phase inspection, with live completion evidence in the shared canvas.
- [x] Added latched protection state/reset semantics and reverse-polarity role validation.
- [x] Added explicit DC polarity-short and AC conductor-short diagnostics while preserving reverse-polarity validation semantics.
- [x] Added actual A/B/C phase terminals and phase-to-neutral voltage semantics; incomplete multi-phase wiring remains explicitly unsupported.
- [x] Added live-result regression coverage for split-phase 120 V terminal readings and three-phase 400 V line-to-neutral readings (230.9 V modeled phase value).
- [x] Restored portable custom-catalogue export/import and safe malformed-import feedback.
- [x] Added reduced-motion, visible focus styling, explicit accessible labels for icon controls, keyboard-operable labeled SVG terminals, and polite live-region feedback for transient status messages.
- [x] Added first-class Grid/Shore AC source and transfer-path templates; open/closed path state now changes reachability and diagnostics.
- [ ] Complete click-by-click browser interaction QA at laptop/tablet/mobile widths, including keyboard/focus and reduced-motion checks; follow [docs/BROWSER_QA_CHECKLIST.md](docs/BROWSER_QA_CHECKLIST.md). Local Vite smoke and the static UI audit are verified, but browser-control tooling was not exposed in this session.
- [x] Reverse-polarity validation, latched breaker state/reset semantics, and A/B/C phase terminal semantics are covered by code/tests.
- [x] Expanded the bounded solver with explicit bus current sharing: each bus branch reports downstream current and the bus reports the summed total; regression coverage is included.
- [x] Extended the verified catalogue core with SmartSolar MPPT 75/15 only after recording exact official ratings, four labeled power terminals, source URL, and verification date.
- [x] Added explicit runtime and energy requirements to the design-lesson evaluator; completion remains evidence-driven and time-based.

## Next pickup

The remaining release gate is click-by-click browser interaction QA at laptop/tablet/mobile widths, including keyboard/focus and reduced-motion checks. Browser-control and Windows-control execution tools were not exposed in this session, so this is not claimed complete. The latest current-runtime smoke on 2026-10-18 returned HTTP 200 for `/` and `/src/main.tsx` after the interaction/cleanup changes, and the local server stopped cleanly; the dependency-free static UI audit and production build are also complete. Do not restore the old dashboard or claim SPICE/certification fidelity. Use `SANDBOX_REFOCUS_PLAN.md` to prioritize any further work.
