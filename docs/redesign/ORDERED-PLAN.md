# Ordered implementation plan

Updated 17 November 2026. This plan records the redesign scope and its original implementation order. See the [current audit](AUDIT.md) for checkout verification and proposed follow-up.

## Working agreement

- Before each section, update its scope and progress here and in affected feature documentation. At completion, record implemented behaviour, focused verification and remaining limits. Refresh status, continuation notes and work log before finishing.
- Keep changes within these sections. Fix a broken dependency when it prevents requested work. Preserve existing uncommitted Learn-mode changes in App.tsx, model.ts, workbench.css, learn.ts and workbench-learn.test.mjs.
- Reuse project, solver, spatial, catalogue, saving and Undo operations. Preserve older saved projects with optional fields and validated migration where needed.
- Use focused checks at section boundaries. Run the broad automated, catalogue, production and browser checks after all sections are implemented. Diagnose failures before changing commands and record results to avoid repeating unchanged failures.
- Use official manufacturer and standards sources for new electrical claims. Track changes in Git's working tree without committing unrelated work.
- The user clarified that implementation and working outcomes take priority over cleanup. Keep documentation checkpoints concise and defer optional cleanup.

## Planning decisions

The user confirmed curved walls in this goal, all three regions (ZA, GB and US), completing existing catalogue records first, and the instrument/schedule scope below. No standards edition or reference files were supplied. Research the applicable official editions and record the implemented table/rule boundaries in section 5. The building editor includes editable curve controls in addition to snapped straight walls.

The repository supports rectangular structural surfaces, mounts, source-frequency-aware voltage measurements, generic protection and 32 verified catalogue records. The 2D building editor is new. Preserve existing Learn work and give the building model an integration point for later random learning rooms.

## 1. Diagnostics and meters

Status — implemented with focused verification, 17 November 2026. Ten selectable meter modes, static short/bypass/parallel-source/PV-rating findings, solved capacitor/load voltage findings, source-isolation/direct-bridge fixes and pre-solve open-terminal findings are integrated. Resistance uses a sparse linear DC solve and checks source isolation/retained energy. Corrected an existing isolated-reactive-state loss discovered by the new check. Feature limits and evidence are in DIAGNOSTICS.md and ELECTRICAL-MODELS.md. Broad/browser verification remains scheduled for the end.

Focused commands ran the instrument, measurement and connection files (24 unique cases), the named retained-energy real-solver regression (one case), and `npm run typecheck`. After correcting the shared window field, all 25 cases passed. The targeted real-solver regression was rerun after correcting isolated storage retention and passed. No full suite or production build was run.

- Extend identifiable short/open-circuit, polarity, source-conflict, charging and rating findings. Static findings stay available during solver failures, with sandbox editing preserved.
- Add previewable one-change fixes where a correction can be established. Validate proposals and retain Apply, Cancel and Undo.
- Expose DC/AC voltage and current, frequency and power from actual samples using correct RMS/average windows. Define probe and selected-conductor semantics.
- Add de-energised resistance/continuity with active-source and retained-energy handling and explicit supported-network limits.
- Focused acceptance covers meter math, isolation/retained energy, findings and fixes through existing entry points.

## 2. System designer

Status — implemented with focused verification, 17 November 2026. Ranked sourced panel/controller alternatives replace hardcoded arrays. Independent MPPT branches, daily scheduled appliances/startup, phase allocation and generic coordinated single/split/three-phase inverter outputs are integrated through the designer. The default is six 550 W panels, three two-module strings, one 250/85 controller, two generic packs, 23 devices and 29 conductors, presented as eight schematic items. High-solar proposals create multiple actual controllers. Optional fields preserve older projects. See DESIGNER-SOURCE-NOTES.md for assumptions.

Focused verification passed eight designer cases, eight grouping cases, three export cases, three real-solver designer cases and TypeScript. The solver checks include all three regions, measured split/three-phase line voltages, scheduled load switching, balanced high-power discharge and high-solar charging. Existing browser expectations were updated for changed generated quantities. Broad/browser execution remains deferred.

- Replace 400 W/two-panel/one-controller assumptions with ranked sourced module/string alternatives constrained by cold Voc, hot operating voltage, input current/power, battery class and space.
- Partition real strings among independent controllers with separate collector/output protection and wiring. Preserve unit counts, groups, measured lengths and exports.
- Add appliance schedules/startup demand and automatic single/split/three-phase topology with coherent phase assignments and voltage/frequency.
- Explain ranking assumptions and infeasible proposals. Use sourced prices where applicable. Share requirements with section 3.5's optional building editor.
- Check alternative selection, independent controllers, schedule/startup sizing, phases and saved requirements.

## 3. Supported 3D cable routing

Status — implemented with focused verification, 17 November 2026. Surface graph routing, support identities, automatic recomputation, preview/apply/cancel, manual override and invalid-route diagnostics/exports are integrated. Seven new routing cases, four geometry cases and TypeScript passed. See ROUTING.md for the implemented terminal/junction constraints and remaining mechanical geometry limits. Broad/browser verification remains deferred.

- Require a wall. Route on valid wall/roof/support surfaces using local orthogonal bends, connected-surface transitions and supported terminal approaches.
- Report unsupported spans and unreachable endpoints explicitly.
- Provide preview/apply/cancel/one-step Undo. Persist support relationships and update bends when surfaces move/rotate.
- Feed route lengths into simulation and exports. Check flat/angled surfaces, transitions, impossible routes and moving supports.

## 3.5. Home and compartment design

Status — implemented with focused verification, 17 November 2026. Shared straight/curved wall editor, rooms/floors, clipped roof shapes, independent apply/refit, actual-dimension fitting, supported routes, route-based conductor resizing and staged 3D construction are integrated. Learn runs offer generated rooms. Twelve building cases, seven routing cases, six mounting cases, one real-solver building case and TypeScript passed. Visual review follows in section 4. See BUILDINGS.md for controls and model boundaries.

- Add a collapsed optional Design home/compartment section to the system designer, usable on mobile, and an independent editor in the 3D workbench.
- Provide a snapped top-down grid, connected editable walls, floor layouts, roof shape/pitch, room names and equipment-room/panel-roof choices. Support moving/removing walls and irregular footprints.
- Generate persistent surfaces. Fit actual equipment dimensions into the chosen room/compartment and panels onto the chosen roof. Report fit failures and prefer suitable real products.
- Applying a building independently preserves electrical topology. Offer explicit equipment refitting. System design applies both when requested.
- Open 3D with an origin-centred orbit and slow zoom-out. Reveal walls, upper floors, indoor equipment, roofs and roof panels in order. Respect reduced motion and interrupt on camera interaction.
- Keep the layout representation reusable for later random Learn rooms. Doors/windows are optional unless straightforward within the agreed scope.
- Check junction editing, multi-floor/room/roof selection, persistence, fit, independent apply/refit and animation lifecycle.

## 4. UI polish

Status — implemented with focused browser verification, 17 November 2026. Six isolated Edge scenarios passed with no page errors, covering connected/curved plan gestures, construction, fitted home, route preview/apply/Cancel/Undo, independent building application, phone layout and meter modes. Corrected the native dialog Escape conflict, expanded focus navigation to summaries/the plan, placed readable room labels away from walls, adjusted surface appearance and polished route/fit feedback. Construction and phone screenshots were rechecked after the visual edits. TypeScript passes. Existing broad control/group suites remain scheduled for final verification.

Visual-review checkpoint — Vite's default bundled config loader failed on sandbox parent-directory access. The documented `--configLoader runner` option worked, serving on http://127.0.0.1:5173 in exec session 69135. Browser-provider inventory reported its access host unavailable. The Windows computer-use fallback then stopped the turn because it could not determine the current browser URL confidently enough to enforce its policy. No visual outcome was verified. Stop Windows app input for this turn. Resume section 4 from this checkpoint. Sections 5–6 and final broad verification remain pending. The tracked goal remains active.

Review resumed through the repository's isolated Playwright test harness. The existing Vite session was confirmed live. Targeted checks will open only the known localhost app in a test-owned Edge profile, covering plan gestures, construction, route preview/Undo, independent building application, mobile layout and meter controls. This is the repository's application-testing workflow.

- Review desktop/mobile layouts, panel hierarchy, scrolling, compact groups, terminal navigation and route/fit feedback.
- Make actions, preview state and errors clear. Preserve keyboard/touch interaction and reachable controls at normal zoom.
- Review changed workflows in the browser and retain relevant visual evidence.

## 5. Electrical completeness

Status — reference profiles and bounded checks implemented, 17 November 2026. ZA/GB/US ampacity and conditions feed designer, diagnostics and exports. Engineering controls cover protection/earthing data, real optional PE ports, source bonds, exact selected lugs/PV contacts and directional BMS limits. Six focused cases, one real-solver BMS regression and three Edge scenarios passed. ENGINEERING.md lists exact source editions and unresolved conditions; this is not a claim of full regional compliance or manufacturer firmware coverage.

- Implement the agreed region/edition scope with sourced ampacity, installation/derating inputs, coordination checks and earthing assumptions.
- Add sourced terminal hardware/lug/connector compatibility and export quantities. Identify unresolved exact matches.
- Add battery/BMS charging/protection limits and selected source-backed manufacturer behaviours, shared by diagnostics, designer and simulation as applicable.
- Document sources, required inputs and supported rules/models. Check the new engineering rules and behaviours.

## 6. Products and models

Status — in progress, 17 November 2026. Audit current partially verified records for complete source-backed simulation profiles, separate readiness from research/geometry status, then update insertion/replacement and bank-aware product selection. Prioritise completing existing records.

- Complete sourced specs for agreed existing/new popular-brand products. Add dimensions and terminal/model geometry supported by evidence.
- Separate simulation readiness from appearance/research verification. Allow partially verified products with complete simulation specs and labelled placeholder geometry. Hide unusable entries from the sidebar picker.
- Make replacement bank/array-aware while preserving identities, branches, groups, wiring and Undo. Check product/bank limits.
- Refresh counts/source dates. Check readiness filters, partial-profile insertion, bank replacement and dimensions.

## Final verification and handoff

Status — queued after section 6.

Run broad checks once, then rerun failures affected by corrections. Review requested outcomes through normal UI entry points, reload, Undo and exports. Record commands/results, unverified boundaries and final goal status. Complete a section only after its agreed outcomes are implemented and checked.


## Run closeout, 18 November 2026

The user cleared the goal and requested this run finish after cleanup/docs and final checks. All ordered sections have implementation, with bounded electrical coverage as documented in ENGINEERING.md. Section 6 currently has 63 simulation-ready profiles among 131 records, including 41 partially verified profiles, readiness-filtered sidebar insertion, sourced dimensions/specifications, and whole-bank/array replacement preserving collector connections. Existing source records were prioritised. No claim of full regional compliance or exact manufacturer firmware is made.

Final catalogue validation and production build passed. The full automated test run reported 10 failures (artifacts/final-tests.log): stale catalogue/status/revision assertions, external-BMS solver fixtures, a malformed-terminal validation crash and a diagram-routing regression. The validation crash was corrected and its focused regressions pass. Remaining failures have not been resolved; final acceptance is incomplete. Three engineering browser scenarios passed earlier; the final rerun is recorded in artifacts/engineering-ui-check.json. Broad UI suites were not all rerun. No commit was made. The goal is cleared and must not be recreated without a new user request.


### Electrical and routing follow-up, 18 November 2026

User prioritised electrical operation and automatic routing over catalogue cleanup. Corrected BMS nonlinear startup with a numerical nodeset estimate (directional limits remain active), connected external BMS explicitly in operational solver fixtures, and expanded generated diagram columns for longer PV strings. All 77 combined real-solver, engineering, designer, building, supported-route and drawing-routing tests pass (artifacts/electrical-routing-final.log). Two malformed-import regressions also pass. Final designer UI results are in artifacts/designer-ui-check.json; engineering UI passed three scenarios without page errors. Catalogue-only stale assertions remain outside this follow-up. The goal remains cleared.
