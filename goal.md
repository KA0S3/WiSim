# Wi-Sim goal and current handoff

## Product goal

Wi-Sim is an educational solar and electrical wiring sandbox. Help people understand connections and modeled behavior by letting them build safely, see what happens, and learn from mistakes. Clear, efficient, readable interaction matters more than decorative effects or feature count.

## Current scope

**Implementation is in progress.** The latest slices remove cable from the normal palette, add a validated conductor-properties step, allow deliberately incompatible terminal pairs for learning with a brief visual warning while excluding them from modeled power paths, move warnings and meter controls to the workbench level, add terminal side/order controls, clarify per-kind settings and source provenance, migrate legacy fuse amp limits, and apply verified MPPT power/current limits by battery class. Custom catalogue records now pass field validation on save/load/import, and import reports skipped invalid entries. MPPT behavior was checked against current official manufacturer specifications and its limits are documented. See the progress tracker in [SANDBOX_REFOCUS_PLAN.md](SANDBOX_REFOCUS_PLAN.md) for remaining acceptance work. The plan is grounded in the existing React/TypeScript/SVG editor, terminal-aware simulation model, persistence, and catalogue.

The active goals are:

1. Establish one well-validated equipment/terminal model that can represent terminal side/order, product identity, user-editable settings, sourced ratings, and honest verification status.
2. Improve device configuration and terminal presentation so real device layouts are legible, editable, non-overlapping, and connection-stable.
3. Make wires properties of terminal-to-terminal connections, with an endpoint-completion popup for conductor size, color, and supported cable details; remove cable from the normal component palette.
4. Complete direct 90-degree cable route editing and ensure wires remain visible around equipment and distinguishable at crossings.
5. Replace scattered diagnostics with active, concise-and-detailed warnings that locate their source, and provide a top-level live digital multimeter.
6. Verify the integrated workflow, persistence, accessibility, responsive behavior, and source/model boundaries in small implementation slices.

Follow the sequence and acceptance checks in [SANDBOX_REFOCUS_PLAN.md](SANDBOX_REFOCUS_PLAN.md). The sourced manufacturer catalogue is now in [src/catalog-data.json](src/catalog-data.json), with types and exports in [src/catalog.ts](src/catalog.ts). Custom learner records remain separate in [src/customCatalogue.ts](src/customCatalogue.ts) and are not manufacturer-verified. Each product entry must be backed by exact model specifications, a terminal diagram, a product appearance reference, and applicable manufacturer installation guidance.

## Dealt with / closed from the previous handoff

The following items from the superseded plan are closed as current planning goals and are not part of this requested work:

- Product-name consistency, empty-project/reset behavior, and save/export clarity.
- The separate irradiance-control workstream.
- General workspace zoom/pan redesign and unrelated component/catalogue expansion.
- Earlier broad symbol-redesign and decorative-alert ideas.
- The previous plan’s overall scope and ordering.

“Dealt with” here means retired from the active goal list for this handoff; it is not a claim that every related runtime behavior has been independently re-tested or implemented. Any later change to these areas should be tracked as a separate request.

## Essential product rule

**This is first and foremost an educational experience.** Keep it safe to experiment, make mistakes understandable, show the evidence and limits behind warnings/readings, and do not imply that a simplified simulation approves real-world wiring.

## Handoff notes

- Existing foundations include terminal-aware connections, editable wire metadata and persisted orthogonal route points, live bounded simulation, diagnostic events, a multimeter measurement function/probe state, catalogue validation, and local project persistence. The verified manufacturer records are maintained as one dataset in [src/catalog-data.json](src/catalog-data.json); incomplete generated catalogue rows were removed rather than carried forward as verified.
- The catalogue source trail and model-verification rules remain in [docs/CATALOG_SOURCES.md](docs/CATALOG_SOURCES.md); simulation boundaries remain in [docs/SIMULATION_LIMITS.md](docs/SIMULATION_LIMITS.md).
- Responsive browser interaction QA remains a verification requirement for implementation work in [docs/BROWSER_QA_CHECKLIST.md](docs/BROWSER_QA_CHECKLIST.md); it was not run as part of this planning-only handoff.
- The implementation is not complete. `npm run verify` now passes locally, including typecheck, all 93 tests, catalogue validation, UI audit, and production build. Browser smoke covered valid and intentionally mismatched connections, warning focus, delete/undo, and reset; the full laptop/tablet/phone accessibility and persistence gate in [docs/BROWSER_QA_CHECKLIST.md](docs/BROWSER_QA_CHECKLIST.md) remains outstanding.
