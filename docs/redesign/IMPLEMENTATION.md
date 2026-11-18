> Current authoritative summary: [STATUS.md](STATUS.md). Older entries below record evidence for earlier revisions.

## Ordered goal, 17 November 2026

Section 5 integrates regional reference ampacity, designer up-sizing, engineering controls, input-based coordination/earthing checks, exact selected termination parts, optional real chassis PE/source bonds and directional battery limits. Six focused engineering cases, one real-solver BMS case and three isolated Edge scenarios passed. A BMS cold-start zero-voltage fixed point was corrected by retaining directional voltage-inhibit latches between segments. Exact source editions and unresolved conditions are documented in ENGINEERING.md. Section 6 is now active.

Section 4 completed through the repository's isolated Edge harness. Six focused scenarios passed with no page errors. The checks cover actual connected/curved plan editing, floor switching, construction progression, fitted routes, preview/cancel/apply/Undo, independent building updates, phone scrolling/layout and meter controls. Fixed the dialog's native Escape handler closing the plan, expanded focus navigation and improved room-label placement/size, surface appearance and route/fit controls. Construction and phone views were rechecked after these edits. TypeScript passes. The harness is available as `npm run ui:designer` and is included in final `verify`.

The first isolated browser attempt exposed a second Vite sandbox dependency-bundling failure. Restarting the local server with approved access resolved it. The working server is exec session 13676 at port 5173. Browser CLI tests use the known localhost URL and their own profile. The Windows Computer Use failure remains historical evidence, with UI verification now obtained independently through the test harness.

Section 4 review checkpoint — the default Vite config bundler failed on sandbox ancestor access. Vite's advertised `--configLoader runner` started successfully at port 5173. The browser access host was unavailable. The Windows computer-use fallback then stopped the turn because it could not determine the browser's current URL confidently enough to enforce policy. No browser/visual result was verified. The remaining work is section 4 review/polish, section 5 electrical rules/models, section 6 catalogue/models and final broad verification. The tracked goal remains active.

Section 3.5 integrates a connected straight/curved wall plan editor, automatic room loops, independent floor layouts, exact-dimension compartments, clipped flat/gable/hip/shed roofs, explicit room/roof targets and building-only/refit workflows. Generated geometry/mounts/routes persist. The 3D view has staged construction, origin-centred orbit/zoom-out, reduced-motion/interrupt handling and roof cutaway. Generated Learn rooms use the shared model through an optional UI setting. Twelve building tests passed after correcting optional-field round-trip equality, plus seven routing, six mounting and one real-solver fitted-design case. TypeScript passes. Section 4 handles the pending visual/browser review.

Section 3 adds a finite-plane support graph, local orthogonal legs, terminal approaches, touching-volume junction checks, route preview/apply/cancel and support-aware recomputation. Invalid supported routes are hidden and retain an explicitly marked last validated electrical length. Copies remap supports and manual edits clear tracking. Seven routing and four geometry cases passed with TypeScript. One pitched-junction failure was diagnosed geometrically, corrected and rerun. Broad/browser verification remains scheduled for the end.

Section 2 replaces fixed panel/controller sizing with sourced alternatives, actual independent MPPT branches, appliance schedules/startup and phase-aware topology. The default has 23 devices / 29 conductors and eight visible schematic items. Focused evidence passed 19 designer/group/export cases, three real-ngspice designer cases and TypeScript. The solver checks cover all regions, split/three-phase line voltages, schedule switching and high-power/high-solar battery limits. Official Victron and Canadian Solar sources were revisited and the two existing BlueSolar records gained sourced temperature coefficients. UI/browser expectations were updated for new default quantities, with browser execution deferred to final verification.

The user requested seven ordered sections, tracked in ORDERED-PLAN.md. Confirmed curved walls, ZA/GB/US electrical scope, existing catalogue completion first, and selectable instruments/daily appliance schedules. Existing uncommitted Learn changes are preserved.

Section 1 adds ten meter modes through the workbench entry point, a sparse de-energised DC resistance solve, stored-energy frame data, pre-solve open-terminal findings, source shorts, equipment/protection bypasses, parallel AC conflicts, inconsistent PV ratings, capacitor/load voltage checks and additional optional repairs. A newly exposed existing bug cleared reactive storage when switched off. Interpretation now preserves that state. Focused evidence comprises 24 measurement/connection/instrument cases and one real-ngspice isolated-capacitor case. All passed after the specific failures were corrected. TypeScript passed. Broad/browser regression is deferred as requested.

﻿# WiSim redesign work log

## User checkpoint

### Resumed scope â€” 12 November 2026

The user has resumed implementation beyond the first review checkpoint. Complete the outstanding core/engineering work, then deliver interactive three-dimensional placement and routing, sourced equipment dimensions and appearance, synchronized electrical values, and smooth schematic interactions. The previous stop-at-first-success instruction is superseded by this resumed goal.

Current resumed progress:
- Added shared physical terminal coordinates, 3D polyline length, slack allowance and explicit manual/physical conductor-length modes.
- Added a pure equipment-movement operation that recalculates physical conductor length without changing schematic positions.
- Added import checks for route coordinates and corrected component-kind validation to require an own definition.
- Shared geometry is integrated with project commits, rendering, solver and export paths. Three geometry tests pass.
- Updated `ui:check` to run the actual workbench browser suite and reordered `verify` to build before browser testing.
- Read the requested plugin-management and skill-installer instructions. Existing local/browser/web capabilities suffice for current work; no additional plugin or skill has been installed.

Latest integration:
- Shared geometry now drives rendered terminal positions and cable polylines; vertical placement is included throughout.
- Project commits and solver/export entry points recompute physical cable lengths. Manual lengths remain explicit and unchanged.
- The conductor inspector exposes manual versus physical route length and slack. Physical placement exposes X, Y and Z.
- Selected equipment has a Three.js translation gizmo; orbit permits viewing underneath equipment. Interactive controls are implemented but not yet browser-verified.
- TypeScript and all 15 workbench geometry/electrical tests pass, including the solver-backed stale-length regression.

Next: establish the core application and electrical behaviour gate below before further 3D, aesthetic or detailed product-model work.

The first review checkpoint has been reached. Implementation remains in progress; the current user priority below supersedes the earlier checkpoint order.

## Checkpoint acceptance

- A real ngspice/WASM browser simulation, electrically complete terminal networks, and independently checked numerical results.
- A clean, usable schematic editor with editable equipment and conductors, persistence, undo/redo, and instruments reading the solved network.
- Linked physical 3D and terminal views, with working camera and selection controls.
- A requirements-driven design flow that generates a wired project and downloads a parts list, drawing, and editable project.
- A coherent visual pass and browser interaction verification at desktop and narrow widths.
- Local build, source provenance, reproducible dependencies, and explicit remaining model/rule coverage.

## Architecture

Keep the existing catalogue and legacy code isolated for migration/reference. Introduce the new workbench under `src/workbench`, with a versioned project independent of renderer and solver. ngspice supplies circuit numerics through a worker. Equipment models compile into equivalent circuits. Display and physics clocks are independent. Physical route length is distinct from schematic coordinates.

## Progress

- Inspected current source, confirmed 130 catalogue records and previous 98 passing tests.
- Integrated the pinned EEcircuit-engine/ngspice WASM runtime in a browser worker. Full upstream source archives and provenance are included in `vendor` and `UPSTREAM.md`.
- Implemented a v4 project model, per-conductor resistance and current measurement, DC/AC/three-phase sources, passive components, generic battery/PV/controller/inverter/load models, retained capacitor/inductor state, motor startup events and generic timed protection.
- Rebuilt the interface with React Flow, local fonts, procedural equipment illustrations, component/product libraries, conductor and equipment inspectors, save/import/export, undo/redo, live scope and two-probe voltmeter.
- Added linked dimensioned 3D and terminal-detail views, camera presets, generic terminal geometry and editable physical placement.
- Added a single-phase requirements designer, generic system generation, JSON project export, CSV schedule and PDF schematic/assumptions export.
- Added Vercel static-build configuration and `Preview.cmd` for local startup and automatic browser opening.

## Verification evidence and limits (12 November 2026)

- Fresh typecheck and all 118 tests pass: 98 legacy tests and 20 workbench electrical, geometry, import and session tests.
- Catalogue validation passes: 27 verified records out of 130. This does not validate every record as a new-engine equipment model.
- Fresh production build passes. Large bundle warnings remain, including the approximately 20 MB simulation worker.
- All twelve workbench browser checks pass with no reported browser errors: WASM, changed settings, undo, probes, linked views, connections, designer, downloads, persistence and mobile controls. See `artifacts/browser-check.json`.
- These checks confirm 3D mounting/view switching, not smooth gizmo dragging or keyboard/camera separation.
- PDF download and two-page rendering pass. Visual inspection confirms readable text/minus signs and routes outside equipment, but overlapping conductor segments can imply false junctions. Separate route lanes and unambiguous crossings remain required.
- `npm run verify` now builds before running the actual workbench browser suite.
- Local preview responds with HTTP 200. Requested opening through the default browser succeeded; the embedded browser host was unavailable.

## Current user priority and acceptance gates

1. Core first: verify electrical behaviour, invalid network handling, simulation lifecycle, project persistence/import, undo/redo, generated design assumptions and exports. Fix failures before expanding visuals or detailed manufacturer models.
2. Establish smooth schematic dragging and dependable wiring/editing without unnecessary simulation resets or history entries.
3. Then finish 3D interaction: separate equipment movement from camera orbit/pan; show keyboard shortcuts in the UI. Proposed mapping: W selects translate, X/Y/Z constrains an axis, Escape cancels, F focuses selection, Home fits the system, Shift+middle-drag pans and middle-drag orbits. Validate collisions and accessibility before finalizing. Shortcuts must not fire inside text inputs.
4. A 3D drag must keep attached wires visually synchronized, update measured cable lengths and electrical values on commit, create one undo step and avoid camera movement. Test cancellation, axis locks and sustained drag responsiveness. Existing gizmos do not yet meet a verified acceptance gate.
5. Add editable route bends and terminal-to-terminal 3D connections; then visual polish, accurately sourced dimensions and detailed real-world equipment assets.

## Remaining full-platform work

1. Finish core acceptance and visual PDF verification. Latest build/browser checks and verification-command updates are complete; interaction performance and dedicated drag checks remain.
2. Validate edition-specific South African, UK and US installation rule packs, ampacity/derating, earthing, protection coordination, interrupt ratings and lug/terminal compatibility. Current region selection chooses voltage/frequency; it does not establish regional compliance.
3. Expand automatic design to split-phase/three-phase, appliance schedules, startup constraints, real equipment compatibility and price-based optimization. Current output is a provisional generic single-phase proposal.
4. Add location/weather retrieval through Vercel, solar yield studies, detailed PV string constraints, autonomy/dispatch studies and independent pvlib/PySAM comparisons.
5. Replace generic equipment equivalents progressively with sourced operating envelopes, charging/BMS behavior, manufacturer protection curves and verified physical/terminal geometry. Catalogue presence is not a validated simulation model.
6. Expand instruments beyond voltage/scope/current readings to resistance/continuity tools, battery testing and richer configurable fault injection.
7. Add explicit legacy-project migration, advanced conductor routing/waypoints, stable drawing references across views/exports and complete termination schedules.
8. Benchmark larger systems, improve accessibility and touch interactions, and refine 3D product assets and close-up connection views after user review.

The first working workbench is ready for oversight; the full original platform vision remains in progress. Existing legacy source and saved-project keys have been preserved. No public deployment has been performed.


## Core reliability follow-up

- Schematic pointer movement is now local canvas state until release. Removed the 250 ms history timer and per-pointer project saves; each completed drag commits once without changing electrical revision or physical cable lengths.
- Added a browser regression with two long mid-drag pauses while simulation runs. It checks visible movement, unchanged saved data during drag, physical cable invariance, and one-step undo/redo. Passed against development and production builds.
- Replaced lossy SPICE identifier normalization with injective code-point encoding. Imported device/wire IDs differing by case or punctuation no longer alias. A real-ngspice parallel-branch test proves independent currents and Kirchhoff current balance.
- Latest typecheck, 114 tests, production build and eleven browser scenarios pass. Large bundles remain a performance concern; no broad frame-rate benchmark is claimed.
- Next core checks: empty-project/stale-frame behaviour, runtime state across project replacement and history, designer constraints, and PDF route overlaps. Continue core work before 3D controls/assets.

## Simulation lifecycle and import reliability

- Added a project-owned simulation session. Switching project identity (including history navigation), changing initial SOC, or clearing the network resets time, stored energy and latched protection. Ordinary edits within a project retain runtime state. Undo restores project configuration, not a historical simulation snapshot.
- Empty networks now clear worker state; displayed frames must match the current electrical revision. Late messages from replaced workers and obsolete calculation errors cannot overwrite current results.
- Import validation now requires project identity, globally unambiguous device/wire IDs, valid terminal domains/geometry and positive frequency/capacity. Malformed terminal entries return invalid instead of throwing.
- Added session regression tests and a browser scenario covering blank project, cleared trace/time, paused project Undo and Redo. All 118 tests and typecheck pass. Production build and all twelve production browser scenarios pass.
- Next: designer feasibility (battery current, negative reserves, cable-size exhaustion and all power-path sizing), PDF route ambiguity, then remaining core acceptance. Full multi-phase design, regional rule packs, manufacturer models and 3D interaction work remain in scope.

- Production lifecycle testing exposed a rapid blank/Undo race: the worker could miss an intermediate project and continue old time. Project identity/initial-charge/empty-state transitions now immediately replace the worker, independently of calculation scheduling. Rebuilt successfully; all twelve production browser scenarios, including the rapid blank/Undo regression, pass.



## Designer feasibility follow-up

- Battery count now meets both the autonomy energy calculation and generic continuous charge/discharge current limits. The assumed 100 A per pack is explicitly recorded; manufacturer BMS and surge validation remains outstanding.
- Controller output rating is sized at the 44 V minimum design voltage using its configured efficiency, rather than nominal battery voltage alone.
- All four electrical paths (battery/inverter, inverter/load, PV/controller, controller/battery) are sized with shared sandbox resistance calculations, including outgoing/return lengths, contacts and ambient temperature. AC conductors cover inverter rated output; battery drop is correctly referenced to 44 V.
- Removed silent maximum-size cable fallbacks. If no area up to 240 mm² meets the drop constraint, design fails with an actionable error. Negative/excessive reserve, impossible sun hours, inconsistent daily/peak demand and invalid options are rejected.
- Four sizing tests cover three regional voltage settings and several load levels. An additional real-ngspice test verifies high-power low-energy demand and high-solar charging cases stay within generic battery current ratings. Earlier full suite (122 tests) and the expanded 15-test solver suite pass; typecheck and production build pass. Thirteen browser checks are running.
- Still required: installation ampacity/derating and protection coordination, actual equipment/BMS ratings, startup schedules, cold/hot PV string limits and multi-phase automatic design. Aggregate battery/PV blocks also need expansion into explicit units and accurate BOM quantities. No installation-ready design claim is made.


## Canvas and drawing follow-up

- Fixed lost React Flow dimensions using the established fixed card size. All thirteen production browser checks passed after the fix.
- Added pure diagram routing with separate lanes and a regression preventing unrelated collinear overlaps in the default examples. Crossings use a background gap. Page fitting now includes all routed points.
- Failed routing aborts export with a visible message; async PDF errors are caught in the UI. PDF labels are staggered. Final production build and all thirteen browser checks pass; the exported PDF was rendered and visually inspected.
- All 124 tests, typecheck, catalogue validation and the earlier complete verify pipeline passed. Full requested 3D and broader designer/model scope remains active.


## 3D editing verification

- Replaced the old wrapper transform with an explicit reference to the object being saved. A dedicated Translation component reuses Drei/three-stdlib controls. The original implementation could move a wrapper while saving unchanged child coordinates.
- Camera, Move and Connect have independent modes. W/V/C select modes; X/Y/Z select axes; arrows nudge 1 cm (Shift 10 cm), F focuses, Home fits all equipment/routes and Escape cancels a pointer drag. Shortcuts ignore text fields.
- Pointer edits render local previews, including attached conductors, and commit once on release. Physical measured-length cables update resistance through the shared geometry/solver model. Specified/manual lengths remain explicit.
- Wire bends can be inserted, selected, translated in X/Y/Z, nudged and removed. 3D connections use the same onConnect path as the schematic and default to measured length.
- Selection no longer resets the camera. Repeated fit/focus commands work. Orbit/pan uses Drei default-control coordination; right-drag pans independently of object translation.
- Equipment names live in the selection panel/inspector rather than overlapping sprites. Terminal spheres and readable terminal actions both support connection. Removed floating Html portals after a clean-unmount test exposed a DOM removal error.
- npm run verify passes: 125 tests, typecheck, catalogue validation, production build, 13 workbench browser scenarios and four dedicated physical scenarios. The physical suite verifies actual pointer drag, preview/autosave separation, single-step undo, cancellation, bend length changes, camera pan without hardware edits, and 3D-to-schematic connections. This does not claim a frame-rate benchmark or touch coverage.
- Mounting surfaces/attachment, rotation, exact manufacturer geometry, explicit aggregate-unit expansion and the remaining engineering/designer coverage are still outstanding.


## Mounting workspace and rotation

- Added optional saved structures (wall, roof, rail, enclosure) and equipment mounting relationships to v4 projects without changing old-project defaults. Import checks cover structure identity, positive dimensions, finite transforms and valid mounting references.
- Shared Three.js Euler/quaternion transforms drive rotated terminal coordinates and mounted world placement. Solver, exports and project commits resolve parent transforms before measuring cables. This reuses the installed Three.js math implementation.
- Workspace editor adds, names, sizes, positions and rotates surfaces. Enclosures render as an open-front shell; equipment can mount to the front or inside back plane. Roofs default to a horizontal mounting plane.
- Equipment follows translated/rotated/resized parent surfaces. Moving equipment preserves the attachment by updating local mounting offsets. Detaching or deleting a surface preserves world placement and orientation. Duplicate equipment is detached to avoid snapping the copy onto its source.
- Added degree-based equipment rotation controls; terminals and physical conductor endpoints rotate with the body. The camera includes rotated equipment and surface bounds when fitting the scene.
- Structure geometry is included in project JSON and the CSV schedule. Material quantities, fixings, structural loads and automatic fit/collision checks are not inferred.
- Fixed duplicate undo entries from unchanged numeric fields discovered by the mounting UI regression.
- Typecheck and 132 tests pass, including seven new spatial/solver regressions. Development browser checks pass for surface attachment, movement, rotation, cable changes, undo, all four structure types, enclosure mounting, reload and removal. Production verification passes: 132 tests, typecheck, catalogue validation, production build, 13 general browser checks and six 3D workspace checks.
- Next: finish production/visual checks, then source and apply exact manufacturer profiles; expand remaining designer/model/rule coverage. The full goal remains active.


## Manufacturer profiles and catalogue mapping

- Added 17 source-linked dimensional profiles with variant-specific width/height/depth, procedural styles, checked dates and explicit approximate-terminal status. Catalogue additions apply these profiles; geometry edits retain provenance and show edited-dimension status.
- Shared normalized port anchors place battery terminals on top and PV connectors behind the panel. Schematic terminal faces follow the catalogue layout; unsupported auxiliary connectors are not invented.
- Fixed component-specific rating mapping: PV Vmp, controller PV limits/current/charge target and inverter AC output/DC cutoff are distinct. Added optional chargeVoltage and idleWatts parameters with validation and editable controls.
- Fixed unpowered inverter idle draw creating phantom terminal voltages by gating consumption below cutoff.
- Corrected two BlueSolar entries and a battery terminal insert size against current manufacturer documents; see CATALOG_SOURCES.md. The new catalogue restore action applies corrections to existing devices without changing their identity or connections.
- Partially verified entries now open primary sources rather than entering unsupported model mappings.
- Typecheck and 138 tests pass, including all profile imports, mixed-voltage mapping, real 12 V inverter operation, catalogue solar charging and an isolated inverter. Production checks passed (14 general flows and six 3D flows), including the restore action. The final narrower-import build and all 20 browser scenarios also pass.
- Remaining: charger/inverter-charger models, additional brands/variants, detailed terminal geometry and curves, aggregate PV/battery expansion and all other open designer/rule/migration/performance work.

- Narrowed shared rotation imports to the exported Three.js math modules. The initial application JS bundle fell from 1,433,439 bytes to approximately 702 kB, while the renderer remains loaded with the 3D view. The WASM worker remains large and needs separate performance work.


## AC charger model

- Added a charger device with separate AC line/neutral and DC battery terminals, configurable charge limit, target voltage, efficiency, input resistance, link capacitance and idle loss.
- The ngspice equivalent includes a rectifier bridge and retained DC-link/output capacitance. Charging depends on available link voltage; output current/voltage regulation and conversion power are coupled. Source phase and capacitor energy persist across simulation windows.
- The mains-loss regression exposed an initial low-link power error; input consumption now accounts for actual DC output power once, without applying the enable factor twice. Added a quantitative energy-budget test: outage charging cannot exceed the decrease in capacitor energy after conversion loss.
- Added output capacitance/bleed to stabilize open-output regulation. No-mains, steady charging, open output, mains loss and restoration pass.
- Charger results expose AC input RMS voltage/current and real input power alongside DC output readings. The component is available in schematic, 3D, terminal view, import/export and a new shore-charging example.
- Added an eighteenth physical profile: a geometry-only Blue Smart IP22 230 V one-output enclosure reference (108 W x 235 H x 65 D mm). Generic electrical settings remain explicit; incomplete manufacturer charger catalogue records remain reference-only.
- Full verify passes: 142 tests, typecheck, catalogue validation, production build, 15 general browser flows and six dedicated physical flows. The browser charger test checks live readings, mains loss/restoration and 3D mounting-view compatibility.
- Remaining model work includes named charger SKUs, multi-stage charging/BMS/temperature logic, reverse-polarity/thermal/fault protection, inverter-chargers and detailed device dynamics. Next core work also includes source-frequency inference for AC measurements, explicit designer PV/battery units and accurate termination/BOM schedules.


## Source-frequency measurement accuracy

- Added source-frequency propagation through conductor/passive networks while keeping inverter, charger and MPPT sides separate. Return-wire direction and a component's default frequency no longer choose the averaging window. Passive devices in AC networks report RMS values.
- Shared piecewise-linear integration interpolates the first partial sample exactly; squared integration is exact for each linear interval. The meter now uses the same source metadata and integration as component/wire readings.
- Mixed-frequency connected sources produce a fault finding and readings use the full available observation window rather than claiming one source frequency. Scope identifies the selected AC source frequency.
- Charger input frequency is reported from the connected network; removed its redundant editable frequency field.
- Tests cover partial intervals, known-phase 60 Hz sinusoids, converter boundaries, a real 60 Hz resistive load and return conductor, and mixed 50/60 Hz sources against the expected RMS result. Existing 50 Hz, three-phase and charger-energy checks continue to pass.
- 147 tests/typecheck pass. The final production build and all 22 browser scenarios pass, including the new 60 Hz charger/meter regression.
- The transient observation window remains 100 ms. General long-period/mixed-spectrum metrology and extended instrument controls still require work; this change establishes the ordinary 50/60 Hz power-system path.
- Next core work: explicit designer unit topology/quantities and BOM correctness, then multi-phase design and remaining engineering model coverage.

## Controls and usage priority — 12 November 2026

- Paused further detailed manufacturer modelling and explicit-unit designer integration to address the user's reported movement/insertion problems first. The unused `design-topology.ts` draft is preserved for later work; `designSystem` still uses the verified aggregate topology.
- Reused Drei DragControls for selected equipment-body movement alongside the existing axis gizmo. Preview stays local, release commits once, Escape cancels and Undo restores the movement. Terminal IDs/connections survive body and axis movement. Mounted-body gestures project movement onto the mounting surface; axis arrows retain deliberate clearance adjustment.
- Adding equipment keeps the current view, opens Configuration and focuses additions in 3D. Focus from the inspector also preserves the view. Mode shortcuts cancel outstanding previews before changing modes.
- Added voltage/capacity-aware ranking of verified same-kind catalogue products for PV, MPPT, batteries and inverters. Explicit application uses existing catalogue mapping and preserves identity, wiring and placement. No adequate verified single-device match is reported clearly rather than substituting unsupported equipment.
- Added visible structure-add buttons, attached-cable navigation, plain-language hover hints and a [controls guide](CONTROLS.md). Numeric inputs allow clearing/intermediate negative text while retaining valid committed values.
- Added unscaled schematic hover readings for voltage/current/power, battery SOC and charger input. A browser check changes load settings while hovering and verifies the actual live value changes.
- Added panel roof selection, panel tilt/azimuth, roof pitch/azimuth, mounting-angle reset and one-time sun alignment. Shared rotated-corner clearance prevents tilted panels from intersecting their mounting plane. Parent movement still resolves terminals and measured cable lengths.
- Added optional saved site/time/UTC-offset/diffuse settings and a compass. Pinned and retained SunCalc 2.1.4's published source and BSD notice. Sun position plus explicit beam incidence/diffuse-sky assumptions scales PV current in ngspice; the original sunlight slider remains effective. Default settings preserve existing project behaviour. Night, facing, serialization and real solved PV output have regressions. This is not weather, shading or annual-yield modelling.
- Saved stable D/W/S references and counters now survive deletion/addition without renumbering survivors. Export reference integration remains pending.
- Production verification passes: 153 tests, typecheck, catalogue validation, build, 17 general browser flows and eleven physical flows. Visual review covered the live tooltip and roof/solar view. No browser runtime errors occurred. Initial JS is approximately 713 kB; frame-rate/touch/large-project claims still need benchmarks.
- Remaining work is listed in STATUS.md. The overall goal remains active; current controls verification does not establish that the entire electrical design platform is finished.

## Foundation verification and project library — 13 November 2026

- User resumed a new active goal: verify background math, sandbox, designer, reliable saving/retrieval, closest products, live numbers and clear faults before expanding real-world products or accurate models. No additional detailed device assets were added.
- Finished the interrupted performance audit. On the measured Edge/Intel UHD 730 host, 7/84/196-device fixtures preserve connections and Undo, issue zero idle draw calls, and show p95 pointer-to-frame delay below 16 ms. Camera commands now clear control inertia; upright default panels report 90-degree tilt. Render-on-demand, memoized physical props and cached contact shadows replace continuous unchanged-scene rendering. See PERFORMANCE.md.
- Phone settings/control panels can hide while retaining the selected equipment. The whole 3D surface reserves touch gestures so browser scrolling cannot cancel body movement. Pointer cancellation/window blur discard unfinished drags and release controls. Four emulated-touch browser flows cover moving/Undo, cancellation, separate orbit/pinch and panel reopening.
- Added a native IndexedDB library without an additional storage dependency. Automatic saves update each project; Save/Ctrl+S keeps explicit versions, capped at the newest 20 per project. Copies get a separate project identity. Library UI opens old projects, restores earlier versions and downloads editable JSON backups.
- Switching/restoring archives the current work before replacement; storage failure keeps the current project open. The legacy working-copy cache remains supported. Startup compares cached/library state to recover newer library data after a full/stale cache rather than overwriting it. User edits during startup recovery preserve the previous library copy as a checkpoint.
- Nine dedicated browser flows pass against the final production build: migration/naming, manual and Ctrl+S saves, older/newer restoration, independent copies, opening/reload/wiring, editable backup, retention, stale-cache recovery, explicit failed-storage behaviour and importing an older copy without losing its newer saved target. The suite is included in npm run verify. SAVING.md explains device/browser/address scope and portable backups.
- Found and corrected a charger AC power bug: input RMS readings used connected source frequency but input active power still used the component's default 50 Hz period. A 60 Hz regression failed with approximately 188 W reported against 226 W delivered after cable losses. Input active power now uses the inferred source observation window. The regression balances source, cable and charger power at 50/60 Hz; all 154 tests pass.
- Final npm run verify passes: 154 tests, typecheck, catalogue validation, production build and all 42 browser flows (17 general, 12 physical, four touch, nine project-library), with no reported browser runtime errors. Remaining scope includes complete diagnostics, contextual product compatibility, explicit designer topology/quantities, schedules/terminations and all other open foundation/model/rule work.

## Live readings, diagnostics and large-network failures — 13 November 2026

- Sandbox errors remain permitted. Full searchable/filterable diagnostics, severity-coloured floating cards in a reserved margin/phone strip, equipment/wire markers, obstacle-checked leaders and target navigation replace truncated-only warning access. Optional fix previews apply one change per click with Undo. Contextual catalogue suggestions explain partial compatibility conflicts while retaining sandbox application; generated designs pass the current limited connection preflight. See DIAGNOSTICS.md.
- Removed the 12-second termination. The worker reports loading/preparation/solve/read phases, preserves state through bounded recovery after actual failures, cancels obsolete edits and supports explicit Cancel. No elapsed-time threshold stops a valid solve. Selective signal export, transferable Float64 arrays, algebraic DC sampling, indexed retained-node lookup and pruning reduce large-network work. Real 100/250/500-device DC and coupled 500-device solar/storage/AC fixtures produce continuing frames.
- Reproduced an upstream ESM bridge defect with contradictory ideal sources: ngspice reports no writable output but its promise never settles. A version/shape-checked local patch rejects failed startup/output and removes stale raw files. npm install/dev/build/test and Preview.cmd apply it reproducibly. The WASM binary and archived upstream sources remain unchanged. Missing required exports and malformed sample series are now rejected instead of becoming fabricated zeros. See UPSTREAM.md.
- The user supplied the actual project after fresh-session tests failed to reproduce their blank readings. Its isolated illuminated solar panel triggered the clipped exponential's failed Newton iteration. Replaced that stamp with a native diode plus photocurrent source retaining the same generic curve and benefiting from ngspice voltage limiting. No user wiring, ratings or on/off settings were changed. The controller's 14.4 V target/54.5 V nominal battery mismatch remains diagnosed, with zero controller charging current.
- The supplied project now runs past motor startup: approximately 598 W appliance load, 741 W pump, 1.34 kW inverter output, 54.10 V battery and 64 V open panel at negligible branch current. Five isolated development-browser checks verify continuing finite readings, visible inspector values, unchanged original device settings/wire endpoints, open-circuit behaviour and saved-project reload. Four separate development checks cover changed load demand, continued frames, reload and genuine numerical-failure/repaired-12-V reuse.
- All 183 automated tests pass, including generic PV curve/power balance across irradiance/load cases and continued mixed-network results with a disconnected panel. Typecheck/build and catalogue validation pass. All 52 browser scenarios passed after the solver-bridge patch; the subsequent PV correction additionally passes the supplied-project five checks in development and production, all 17 general electrical flows and four real large-system fixtures, with no reported runtime errors. The coupled 500-device case continues with approximately 31.9 kW PV and 11.7 kW AC load. Current artifacts record those final results. The earlier fresh-engine recovery regression was moved into its own test process because upstream's global prompt hook does not isolate multiple engine instances in one JavaScript realm; production workers already isolate them.
- Remaining platform scope stays in STATUS.md: explicit designer units/terminations, comprehensive manufacturer/region/protection constraints, schedules/three-phase design and broader instruments/models. No accurate product assets were expanded while live readings were the priority.

## Controller conversion balance — 13 November 2026

- Audited the reported project's zero charging current after its blank-reading correction. The original fixed PV input resistor still consumed approximately 87 W even when output charging was zero. Replaced it with coupled input/output expressions: output current limiting and charge taper now curtail solar input as well. Output power equals configured efficiency times measured input power; reverse battery supply, insufficient PV voltage and disabled/full/mismatched charging do not leave a hidden full-power input load.
- Exposed PV input voltage/current/power in Live readings and labelled PV input correctly in the hover popup. The same fields continue to show AC input for chargers. The controller remains a generic buck operating-point model; no actual manufacturer MPPT/BMS firmware is claimed. See ELECTRICAL-MODELS.md for equations and assumptions.
- Independent real-solver regressions verify controller conversion balance, both cable-path balances, current limiting, taper and six zero-output conditions. All 185 tests, typecheck and the production build pass. The 18-flow general browser suite passes, including changing the charge target, observing input curtailment and restoring charging with Undo.
- The supplied eight-device project again passes all five import/continuing-readings/settings-and-wiring/reload checks. With its original 14.4 V charge target retained, the controller now draws zero PV power and the connected panel sits near 96 V open circuit. The independent unconnected panel remains near 64 V. Other readings remain approximately 598 W appliance, 741 W pump, 1.34 kW inverter output and 54.10 V battery. The warning remains visible.
- All four real large-network fixtures pass after the change. The coupled 500-device/894-conductor fixture produces approximately 31.9 kW PV and 11.7 kW AC load; first solve 1.95 s, subsequent solve 1.56 s on this run. The 500-device DC fixture solves initially in 1.22 s and subsequently in 0.52 s. Browser timings and raw results are in PERFORMANCE.md and artifacts/large-system-check.json. These results cover the tested topologies, not all circuits or physical 3D performance.

## Individual-unit designer, exports and expanded controls - 13 November 2026

- Replaced aggregate designer blocks with the tested individual-equipment topology. The default proposal now has 8 panels in 4 two-panel strings, 2 battery packs, 7 generic protection devices, 4 junctions and conversion/load equipment: 24 devices and 31 conductors. Generated parallel battery branches have equal loop length/area. Independent sizing checks cover PV string/collector, battery branch/main, controller and AC paths; real ngspice checks every pack's current and balanced sharing. The high-solar fixture generates 76 devices and 102 conductors.
- Drawing routing no longer expands obstacles without bound with conductor index. It searches reusable clear lanes and checks unrelated collinear overlaps. Both default and high-solar diagrams route without blocked paths in the regression.
- CSV now uses saved references and meaningful type-specific ratings, counts each actual item and cable length, lists both endpoints, and enumerates two conductor ends per cable. Hardware connector/lug/stud selection remains explicitly unspecified. Deletion/reordering preserves exported references.
- PDF export uses a sheet/quantity index, fixed readable branch/detail pages, a complete wire/terminal/destination-sheet schedule and paginated assumptions. Native rendering found name/port-label overlaps; those were corrected and the latest default seven-page document was rendered and visually inspected. `check-export.mjs` confirms all 24 device and 31 conductor references appear exactly once in their appropriate sheets/schedule, with no text outside page bounds. PDF QA uses the existing local pdfjs/native-canvas installation; these are not runtime application dependencies. The export is a concept design, not installation approval.
- User expanded the requirements to compact expandable banks/arrays, alternative panel optimisation, multiple controllers, supported wall/roof cable management, stronger catalogue choices, instruments and normal-zoom/group controls. FOUNDATION-PLAN.md preserves this scope alongside the unfinished prior electrical/design objective.
- Product cards previously filtered out every alternative that differed in voltage/capacity/power/surge. They now retain nearest verified alternatives, prefer candidates meeting the current checked constraints, and explicitly list numeric differences and network warnings. The stricter programmatic matching API remains distinct. Parallel panel/battery alternatives create actual units and measured branch wires, preserve external wire identities and undo in one step. Product voltage stays unchanged; branch cables initially assume 16 mm2 and require protection/ampacity/terminal review. Arbitrary series capability is not assumed.
- The schematic wheel zooms; Ctrl-wheel pans vertically and Shift-wheel horizontally without browser zoom. Added compact layered and screen-shaped organisation. Ctrl-click and rectangle selection support multiple items; group dragging commits once. The sidebar offers copy/download/new system, deletion or retaining only the selection. Deletion confirms equipment/conductor counts and supports cancellation/Undo. Copies preserve internal wiring, exclude boundary connections and paste into another project with independent identities/references. Opening a new system still archives the current project through the existing saved-project flow.
- Short-window settings have independent scrolling, minimum input sizes and no forced page minimum height. The 3D panel has desktop/phone collapse controls and one outer scroll rather than clipped nested panes. A phone regression exposed Drei resetting inline canvas touchAction; a canvas-only CSS override restores gestures while allowing overlay scrolling. Four phone gesture scenarios pass after correction.
- Current verification: 193 automated tests, typecheck and production build pass. Real-solver regressions independently balance current and source/load/cable power for multi-unit catalogue alternatives. Production browser checks pass 18 general flows, 12 physical, four touch, seven diagnostics and five new controls scenarios (46 total), with no reported runtime errors. Controls cover normal-zoom positioning, wheel/modifiers, rectangle selection, group dragging/Undo, cancellable removal, same/cross-project copying, new-system extraction, screen organisation and actual parallel product units. The final subsequent build only clarified deletion counts; the tested behaviour is unchanged. `npm run verify` now includes the new controls suite.
- Remaining foundation work includes compact bank/array display and topology editing, alternative panel sizes, multiple MPPTs, supported surface routing, additional sourced popular-brand ratings, instruments, manufacturer/region/protection constraints and the other STATUS.md items. No detailed manufacturer artwork was expanded during this work.

## Rewritten desktop goal and terminal inspection - 13 November 2026

- The user cancelled the previous tracked goal and explicitly requested a rewritten goal. Created the new active objective with all expanded requirements, prioritising reliable live math, functional desktop designer/3D/controls and sourced models. Touch and small-screen refinements are secondary. FOUNDATION-PLAN.md contains the preserved scope and next engineering gates; the objective is not complete.
- Extracted TerminalDetail into its own component. It now has a component picker and previous/next controls, direct arrows to connected equipment, stable current-component inspection when a wire is selected, live values and proper RMS labels for AC. The component preview reuses the exact existing workbench geometry/terminal anchors through the shared Equipment renderer. It is lazy-loaded and memoised independently of changing live readouts. Appearance/anchors retain the source/approximation notes; there are no newly acquired manufacturer CAD assets.
- Added orbit/pan/zoom, Front view and Frame component. Explicit camera commands consume residual damping before setting the target. Labelled 3D terminals attach real voltmeter probes; the existing strip/list probes remain available. Missing solver readings display a dash rather than fabricated zeros. Live numbers overlay the model so they stay visible in the tested short desktop window.
- Component switching exposed disappearing HTML probe labels and a portal cleanup DOM error. Device-specific label identities and a dedicated stable portal container fixed both. The final production test switches devices, orbits/reframes, measures over 50 V on the running battery, closes the meter, inspects a conductor without losing the component, then follows its connected device. Original equipment settings and wires are unchanged and no runtime errors are reported.
- All six production controls scenarios and all 18 general flows pass after the terminal feature. A subsequent focused production check passes after the live-number overlay placement. Typecheck/build pass; the electrical kernel is unchanged and the existing 193-test result remains applicable. Current screenshots/reports are artifacts/qa-terminal-3d.png, controls-check.json and controls-terminal-check.json. Earlier physical/touch/diagnostics results remain the 47-scenario combined current foundation evidence, with each run's scope stated above.

## Compact groups and common electrical observation windows — 13 November 2026

- Fixed DC/AC averaging consistency for 50/60 Hz converters. Converter coupling propagates observation periods without falsely classifying DC terminals as AC. Independent mixed-frequency outputs share a full observation window and retain their separate source classifications. Stable relative solver tolerance is unchanged after an experimental tightening failed the unloaded-charger regression.
- Added optional validated v4 equipment groups, visible-to-real terminal mapping, source-power totals, per-unit voltage ranges and configured series/parallel descriptions. Underlying equipment, conductors, physical geometry and export quantities remain individual. The default designer presents six nodes over 24 devices/31 conductors.
- Added expansion/collapse, extracting members, grouping compatible multi-selections, adding existing units, copying/remapped paste, safe deletion and complete parallel-branch duplication. New branches retain real collector endpoints and use measured physical wires, with an explicit sizing/sharing/mounting review warning.
- Port-aware ELK layout uses the existing dependency. Group dragging and organisation change only diagram positions. Collapsed internal fault targets map to group markers/leaders while diagnostics and fixes retain original targets. GROUPS.md records scope and remaining richer summaries.
- Current automated suite: 203 passing tests, typecheck and build pass. The 18 general browser scenarios passed with compact design quantities; six desktop control scenarios passed with grouped catalogue additions. Group workflow and fault checks use scripts/groups-browser-check.mjs and artifacts/groups-check.json; final results are recorded below after execution. No full objective completion is claimed.

Final group browser run: seven passing scenarios, no page errors, recorded in artifacts/groups-check.json. Visual review of qa-compact-groups.png and qa-group-fault.png verifies readable controls, retained live numbers and internal fault inspection. The coupled 500-device/894-conductor case was rerun concurrently with group browser checks: first solve 3.10 s, next 2.20 s; two live frames after 11.36 s including page/worker startup. It produced finite continuing PV, storage, AC and cable-loss readings with no errors. These loaded-run timings do not replace the earlier isolated benchmark. The current seven-page PDF still passes 24-device/31-conductor reference and bounds checks; the local development preview responds on port 5173.
Final visual review exposed and reproduced a production-only conductor-rendering failure: reconstructed controlled nodes omitted measured dimensions, causing React Flow to clear cached handle bounds on live updates. Stored wires and solver currents remained present while drawn paths vanished. Fixed all schematic nodes to retain known dimensions and refresh terminal measurements only when port geometry changes. The group browser suite now checks actual conductor paths after advancing beyond one simulated second, dragging, expansion and collapse; artifacts/group-conductor-paths.json records rendered path geometry. Temporary flow inspection instrumentation was removed.
Final post-renderer verification: 203 automated tests; typecheck/build/catalogue check; all 18 general browser scenarios and seven group scenarios pass. The general suite explicitly fits after an auto-panning drag before attaching meter probes. All four large-network production cases pass with actual conductor rendering asserted: 198/498/998/894 drawn paths respectively. Current isolated timings and raw evidence are recorded in PERFORMANCE.md and artifacts/large-system-check.json. Generated positive-leg colours after passives are corrected without changing connectivity. All 24 device references and 31 conductor references remain complete and in bounds in the seven-page PDF. Next designer source research is recorded in DESIGNER-SOURCE-NOTES.md; no new manufacturer records or multi-MPPT implementation are claimed yet.


## Run closeout, 18 November 2026

The user cleared the goal and requested this run finish after cleanup/docs and final checks. All ordered sections have implementation, with bounded electrical coverage as documented in ENGINEERING.md. Section 6 currently has 63 simulation-ready profiles among 131 records, including 41 partially verified profiles, readiness-filtered sidebar insertion, sourced dimensions/specifications, and whole-bank/array replacement preserving collector connections. Existing source records were prioritised. No claim of full regional compliance or exact manufacturer firmware is made.

Final catalogue validation and production build passed. The full automated test run reported 10 failures (artifacts/final-tests.log): stale catalogue/status/revision assertions, external-BMS solver fixtures, a malformed-terminal validation crash and a diagram-routing regression. The validation crash was corrected and its focused regressions pass. Remaining failures have not been resolved; final acceptance is incomplete. Three engineering browser scenarios passed earlier; the final rerun is recorded in artifacts/engineering-ui-check.json. Broad UI suites were not all rerun. No commit was made. The goal is cleared and must not be recreated without a new user request.


### Electrical and routing follow-up, 18 November 2026

User prioritised electrical operation and automatic routing over catalogue cleanup. Corrected BMS nonlinear startup with a numerical nodeset estimate (directional limits remain active), connected external BMS explicitly in operational solver fixtures, and expanded generated diagram columns for longer PV strings. All 77 combined real-solver, engineering, designer, building, supported-route and drawing-routing tests pass (artifacts/electrical-routing-final.log). Two malformed-import regressions also pass. Final designer UI results are in artifacts/designer-ui-check.json; engineering UI passed three scenarios without page errors. Catalogue-only stale assertions remain outside this follow-up. The goal remains cleared.
