# WiSim

An electrical sandbox and system designer under active redesign. The current entry point is `src/workbench-entry.tsx`; the new implementation lives in `src/workbench`. Legacy code remains for reference and migration.

## Preview

Double-click `Preview.cmd`, or run `Preview.cmd` from CMD in this folder. It reopens an existing WiSim preview, or installs missing dependencies and starts Vite with automatic browser opening at http://127.0.0.1:5173. Node.js and npm are required. Keep the server window open; Ctrl+C stops it. If the preview is already running, open that address directly.

## Current implementation

- ngspice/WASM simulation in a worker, terminal networks, conductor resistance, generic equipment models, voltage probes and scope.
- Schematic editing, settings, undo/redo, automatic saving, named project library, saved versions/copies and JSON import/export.
- Provisional single-phase system generation with individual panel/pack/protection quantities, terminal/end CSV schedules and readable multi-sheet PDF drawings.
- Linked schematic, 3D and terminal views; terminal detail shares workbench geometry, switches components and supports live probes. Physical route lengths can affect electrical calculations.

The full platform is unfinished. Catalogue records are not all validated simulation models, and regional selection does not establish installation compliance. Equipment movement, separate camera controls, wiring preservation, mounting, emulated phone gestures and saved-project recovery have dedicated browser checks. Measured interaction evidence covers three project sizes; maximum-size projects, physical phones and broader accessibility remain open.

## Development and checks

```sh
npm ci
npm run dev
npm run verify
```

Verification runs typechecking, tests, catalogue validation, production build and the workbench browser suite. The browser suite uses installed Microsoft Edge.

The browser suite includes general workbench flows, 3D controls, phone gestures and named-project saving/retrieval. Run `npm run ui:projects` separately for project versions, backups and storage-failure recovery.

`npm run ui:touch` checks phone-size touch gestures and panel controls. After a build, `npm run ui:performance` measures camera pan and wired equipment dragging on 7, 84 and 196-device fixtures while simulation runs. It writes renderer-specific timing and idle-draw evidence to `artifacts/interaction-performance.json`; results describe this host rather than a universal frame-rate guarantee.

## Work plan

The current requested order and section acceptance criteria are tracked in [Ordered implementation plan](docs/redesign/ORDERED-PLAN.md).

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
