# WiSim

An electrical sandbox and system designer under active redesign. The current entry point is `src/workbench-entry.tsx`; the new implementation lives in `src/workbench`. Legacy code remains for reference and migration.

## Preview

Double-click `Preview.cmd`, or run `Preview.cmd` from CMD in this folder. It reopens an existing WiSim preview, or installs missing dependencies and starts Vite with automatic browser opening at http://127.0.0.1:5173. Node.js and npm are required. Keep the server window open; Ctrl+C stops it. If the preview is already running, open that address directly.

## Current implementation

- ngspice/WASM simulation in a worker, terminal networks, conductor resistance, generic equipment models, voltage probes and scope.
- Schematic editing, settings, undo/redo, automatic saving, named project library, saved versions/copies and JSON import/export.
- System generation with single-, split- and three-phase inverter outputs, individual panel and battery quantities, and optional grid / shore or portable-generator input through a separate protected battery charger.
- Floor-plan editing, automatic equipment placement and supported cable routing, randomized demo houses, and guided build and repair exercises.
- Terminal and cable schedules in CSV, plus multi-sheet PDF wiring drawings.
- Linked schematic, 3D and terminal views; terminal detail shares workbench geometry, switches components and supports live probes. Physical route lengths can affect electrical calculations.

In **Auto design → AC input**, choose no input, grid / shore power, or a portable generator. Random demo houses can randomize that setting or reuse your selection. Generated AC feeds a 10 A DC charger while the inverter continues to supply the loads. The portable generator is also available under **Equipment library → Components → Sources**.

Equipment models and regional sizing are simulation equivalents and provisional design estimates. Generator leads in generated homes use illustrative flexible runs. Physical phones and broader accessibility remain outside the automated checks.

## Development and checks

```sh
npm ci
npm run dev
npm run verify
```

Verification runs typechecking, tests, catalogue validation, production build and the workbench browser suite. The browser suite uses installed Microsoft Edge.

The browser suite includes general workbench flows, 3D controls, phone gestures and named-project saving/retrieval. Use `npm run ui:projects` to rerun the project versions, backups and storage-failure checks on their own.

`npm run ui:touch` checks phone-size touch gestures and panel controls. After a build, `npm run ui:performance` measures camera pan and wired equipment dragging on 7, 84 and 196-device fixtures while simulation runs. It writes renderer-specific timing and idle-draw evidence to `artifacts/interaction-performance.json`; results describe this host rather than a universal frame-rate guarantee.

## Status and work plan

The [product audit](docs/redesign/AUDIT.md) records current verification, known gaps and proposed improvements. The [ordered implementation plan](docs/redesign/ORDERED-PLAN.md) records the redesign milestones.

Core application and electrical behaviour come first, followed by smooth schematic interactions, then 3D movement/routing, visual polish and detailed manufacturer models.

- [Completed work, evidence and remaining tasks](docs/redesign/IMPLEMENTATION.md)
- [Current status and remaining scope](docs/redesign/STATUS.md)
- [Expanded foundation requirements and work order](docs/redesign/FOUNDATION-PLAN.md)
- [Movement, equipment settings, roofs and solar controls](docs/redesign/CONTROLS.md)
- [Saving projects and restoring older versions](docs/redesign/SAVING.md)
- [Fault callouts, diagnostics and optional fixes](docs/redesign/DIAGNOSTICS.md)
- [Running larger systems and calculation recovery](docs/redesign/RUNNING.md)
- [Electrical model assumptions and power balance](docs/redesign/ELECTRICAL-MODELS.md)
- [Interaction measurements and limits](docs/redesign/PERFORMANCE.md)
- [Preview and review instructions](docs/redesign/REVIEW.md)
- [Upstream solver sources and licenses](docs/redesign/UPSTREAM.md)
- [Catalogue sourcing](docs/CATALOG_SOURCES.md)

Older planning and simulation-limit documents describe the legacy implementation unless stated otherwise. No public deployment has been performed.


Compact array/bank controls and their limits are described in [Groups](docs/redesign/GROUPS.md). Run `npm run ui:groups` for the dedicated desktop workflow checks.

## Design review tools

- **Electrical engineering → Hourly weather and outage replay** imports CSV with the header `local_hour,poa_w_m2,ac_input_available`. Use consecutive local standard-time hours such as `2026-01-01T12:00`, mean hourly irradiance on the panel plane in W/m², and 0 or 1 for charger input availability. Download the example in the panel. Set battery reserve and PV delivery percentage, then inspect an hour or export the full result. The replay uses ideal storage and shares missing energy across active loads in proportion to demand. Use the live circuit for surge, protection and connection behavior.
- **Projects → Previous versions → Compare saved versions** shows changes in equipment, ratings, connections, cable lengths, assumptions and static findings. Under **Portable project archive**, select projects to download together with their retained versions. Importing previews name and identity conflicts. Matching identities restore as independent copies.
- **System diagnostics → Add review note** records an advisory or intentional open terminal. Electrical edits reopen the review. Export the diagnostic review for its findings, assumptions and notes.
- **Export → Field labels** produces an A4 cut sheet with a label for each conductor end and its destination terminal. **Connect terminals** on the schematic toolbar lets you select both endpoints using the keyboard. On a narrow screen, open the multimeter and choose **Place probes on schematic** to expose the terminals. Use **Choose probe terminals** to measure in the docked panel with the keyboard or without tapping the schematic.

The sidebar starts collapsed. Click a rail icon to open its panel and click it again to close it. Switching views, inspecting equipment, applying fixes and opening a separate dialog preserve the selected sidebar panel. Diagnostics opens on the schematic with **Faults** selected. Use **Explain issue** for the cause and next steps, **Inspect** to locate the equipment or conductor, and **Auto-fix** to preview supported repairs. Dashed locator lines connect visible fault entries to visible schematic targets. On narrow screens, diagnostics docks below the workspace so the schematic remains visible.

Open **Learn → Guided commissioning replay** to follow a baseline reading, a staged load start and protection trip, repair and reset, source isolation, and source restoration. Replay uses a separate training circuit. The JSON export includes per-step terminal voltage, branch current, trip cause and the sequence of actions.
