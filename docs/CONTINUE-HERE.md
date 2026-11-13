# Continue here — 13 November 2026

The app runs through `Preview.cmd` or `npm run dev`. Main app: `src/workbench/App.tsx`. Full scope: `docs/redesign/FOUNDATION-PLAN.md`.

## Working foundation

Live ngspice worker simulation, saved project library/versions, schematic and 3D controls, diagnostics with optional fixes, closest catalogue alternatives, terminal-detail model/probes, individual-unit designer and CSV/PDF exports are implemented. Compact PV/battery groups preserve actual equipment and wiring. A reproduced disappearing-wire rendering bug and 60 Hz measurement-window mismatch were fixed.

## Latest work, where to resume

Panel alternatives and multiple MPPTs are **not finished**. The shipped designer still builds generic 400 W two-panel strings and one controller. Start with `templates.ts`, `design-topology.ts`, and `DESIGNER-SOURCE-NOTES.md` under `docs/redesign`.

The latest source research added a Canadian Solar CS6W-550MS panel and four exact Victron Tr VE.Can controller variants: catalogue now has 32 verified / 131 total entries. Five dimensional profiles were added; bodies and terminal positions remain procedural approximations. PV source parameters now include sourced Imp and temperature coefficients. The new real-solver test checks the 550 W operating point and cold Voc. `pv-ratings.ts` and `pv-network.ts` supply the new math; connection checks now include controller input current, nameplate power and operating/startup voltage limits.

Next: test the new array-level checks directly, expose suitable editable limits/temperature settings, implement ranked panel/string alternatives and independently wired multiple-controller proposals, and verify exports and real solver behaviour. Then implement supported wall/roof cable routing with proper surface-plane bends, preview/Undo and support relationships. More meters, regional engineering rules, hardware compatibility and accurate manufacturer models remain open. Do not treat the current generic designer as installation certification.

## Verification checkpoint

Latest automated run: **206 tests passed**; typecheck and catalogue validation passed. The newest catalogue/PV changes have not yet had a production build/browser regression. Prior build passed 18 general browser scenarios, seven grouping scenarios and real 100/250/500-device plus coupled 500-device networks, including actual rendered wire counts. Desktop controls and terminal viewer have separate earlier browser coverage. Run `npm run verify` for the full suite; `npm run ui:groups` checks grouped equipment. Python is unavailable on this host; local PDF QA dependencies live in ignored `.cache`.

`STATUS.md` and `IMPLEMENTATION.md` retain older checkpoint counts; this file describes the latest interrupted work. Temporary research scripts/data in ignored `.cache` and `artifacts` are not required to run the app. Original user project files remain untouched outside the repository.
