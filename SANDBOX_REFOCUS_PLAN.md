# Wi-Sim: physical wire routing and live solar-system behavior

This is the active refocus plan for Wi-Sim. It turns the requested concerns into requirements, staged implementation work, and acceptance checks. This is planning only: no runtime behavior is claimed to be implemented by this document.

## Product outcome

Make the sandbox feel like an understandable, continuously responding model of a solar electrical system. Learners should be able to connect devices freely, see current and device operating states respond to their choices, and observe modeled consequences when a system is configured badly. Wires should remain distinct, readable paths around equipment. Damaged equipment should have a clear recovery path that does not erase its configuration.

The aim is a progressively more physically grounded educational simulation, not a claim to be a complete real-world physics solver, installation guide, or design-approval tool. Every modeled behavior must state its assumptions and limits. Unsupported phenomena must be identified rather than represented by fabricated precision.

## Scope and principles

- Prioritize wire routing and live, causal system behavior; these are the primary user problems.
- Treat every connection as an experiment the learner may make. Compatibility issues should be represented as system behavior and consequences, not used to prevent connection.
- Distinguish an observed symptom, a modeled cause, a teaching explanation, and an implementation limit. Do not substitute an arbitrary warning for a modeled effect.
- Base damage and thresholds on explicit, documented model rules. Where a physical effect is not yet supported, show the limitation instead of inventing a result.
- Show equipment-specific live readings, units, operating states, and where values are measured.
- If motion/animation is used, derive it from current model state, respect reduced-motion preferences, and never rely on it as the sole carrier of information.
- Preserve project data, device settings, wire identity, undo/redo, and existing project compatibility when changing the model.
- Keep the experience educational. The simulation does not certify wiring, select real installation cable sizes, or replace manufacturer instructions and applicable standards.

## Requirement register

All requirements begin as **Planned**. Progress is recorded in both this file's stage tracker and [goal.md](goal.md); do not mark a requirement complete until its acceptance checks are met.

### Routing and wire layout

**WR-1 — Obstacle-aware routes.** Every wire path must route visibly around equipment bodies and terminals. Moving, resizing, adding, or removing a component must update available clearances and route geometry; a path must not be hidden behind equipment.

**WR-2 — Separate lanes.** Distinct wires must use distinguishable paths and spacing levels rather than sharing an indistinguishable line. Resolve conflicts deterministically and consistently, including when components move or routes are edited. Crossings must not look like electrical junctions.

**WR-3 — No wire self-loops.** A route must not double back through itself or create avoidable loops. A route that cannot be made unambiguous must be exposed as a conflict that the learner can correct, not silently rendered as a valid-looking path.

**WR-4 — Stable corner editing.** Corners must move smoothly as a user drags them or an adjacent route changes. Maintain orthogonal segments without introducing loops, flips, or unexpected jumps. Preserve directly edited corners when possible and make route recovery understandable.

**WR-5 — Geometry responds to component size.** Device dimensions must participate in obstacle clearance, routing, and spacing. Resizing or changing a device layout must not leave wires inside the enlarged body or cause route collisions.

**WR-6 — Route identity and persistence.** Routes remain attached to their intended terminal IDs through component movement, resize, editing, undo/redo, save, reload, and import. A reroute must not silently change electrical endpoints.

### Live electrical behavior and current flow

**LS-1 — Causal, live updates.** Changes to connections, device settings/states, and environmental inputs supported by the model must promptly update affected electrical values and device states. Readings must come from the current project state, not static labels or stale snapshots.

**LS-2 — Visible current flow.** Make the direction and relative magnitude of modeled current understandable on energized wires. Static visual cues are sufficient; animation is optional and appreciated when it adds clarity. Any flow cue must update when modeled direction or magnitude changes, stop when a path is inactive, and remain understandable with animation disabled or reduced.

**LS-3 — Freely create connections.** Allow learners to connect any available terminals, including combinations that are mismatched, reversed, unsupported, or hazardous in the model. Connection creation must not be blocked solely by compatibility checks. Structural editor errors (for example, a missing endpoint record) may still be prevented and explained.

**LS-4 — Effects before generic warnings.** When a connection or setting produces a modeled problem, show the resulting observable behavior—such as changed readings, limited output, an opened protection path, heating progression, or equipment damage where supported—alongside a concise explanation. Warnings supplement evidence; they do not replace it.

**LS-5 — Explicit model confidence.** For each effect, distinguish calculated values, simplified estimates, qualitative effects, and unsupported conditions. No unexplained arbitrary warning, success-shaped fallback, or false measurement may be presented as a physical result.

### Faults, consequences, and recovery

**FC-1 — Model meaningful failure scenarios.** Plan explicit behavior for at least wrong conductor sizing, missing/incorrect protection, reversed or otherwise incorrect battery connections, and device operation outside supported limits. Each scenario needs defined inputs, causal progression, observable symptoms, affected devices, and reset/recovery behavior.

**FC-2 — Evidence-based fault rules.** Define the model assumptions and thresholds for each scenario before implementing it. Use exact-model documentation when a rule is product-specific; label generic educational assumptions as such. Do not imply standards compliance or prescribe real-world installation choices.

**FC-3 — Consequences are stateful.** Where the supported model predicts damage, equipment transitions into a visibly damaged or dead state and its subsequent behavior/readings reflect that state. Do not report damage where the model only supports a warning or estimate.

**FC-4 — Replace damaged equipment.** Provide a clear replace/restore action for a dead or damaged component. It should create a working replacement while carrying forward appropriate configuration (for example, model, ratings, and user-entered settings) without carrying over damage. Define how existing connections are handled and make the outcome undoable and explicit.

**FC-5 — Damage applies per capability.** Identify which component classes can meaningfully become damaged and what observable state changes for each. Avoid a universal, unsupported damage behavior; components without a modeled failure mode should explain that limitation.

### Device-specific readings and state communication

**DR-1 — Battery telemetry.** Show state of charge (SOC) as a live value, with charge/discharge direction and relevant modeled battery measurements. Clarify estimates and capacity/chemistry assumptions.

**DR-2 — MPPT telemetry.** Show PV-side input (including supported voltage/current/power readings) separately from battery-side output (including supported charge voltage/current/power). Values on each side must respond to the same live operating point and expose conversion/limit behavior rather than conflating input and output.

**DR-3 — Inverter telemetry and modes.** Show live DC input and supported AC output readings, plus an explicit operating/charging state. Model and communicate transitions such as bulk and absorption only when the required conditions and state transitions are defined; explain idle, limited, faulted, or unsupported states.

**DR-4 — Per-device measurement contract.** Define relevant live readings and units for each modeled component kind. Present values at the device and side/terminal they describe. Do not force all devices into a battery-SOC-only or generic status display.

**DR-5 — Explain system operation.** Provide a discoverable way to inspect what each device is doing and why: current operating state, inputs/outputs, active limits or faults, and the model evidence behind the displayed status.

### Multimeter and measurement output

**MM-1 — Functional live multimeter.** The multimeter must take measurements from the current simulation state and update when relevant connections, settings, or device states change. It must not display stale, hard-coded, or fabricated readings.

**MM-2 — Actual continuity result.** Continuity must evaluate whether the selected leads have a continuous modeled electrical path under the current topology and device/protection states. Report a clear continuous, open, or unavailable/unsupported result; do not treat mere proximity, a shared device, or an unmodeled path as continuity. Explain the endpoints/path context.

**MM-3 — Measurement context and validity.** Show selected leads/endpoints, measurement mode, units, and a clear status for valid, open, unavailable, or unsupported measurements. A measurement must update when its path or state changes.

**MM-4 — Clear measurement output.** Provide an explicit, discoverable way to clear displayed/saved multimeter output or reading history. Clearing output must not alter the simulated circuit, device settings, or wires; confirm or undo only if the product's established interaction conventions require it.

**MM-5 — Animation is optional.** A working multimeter and truthful live readings are required independently of any current-flow animation. Animation is optional and appreciated, but it must never substitute for a numeric/status reading or continuity result.

## Staged delivery and acceptance

Stages are ordered to avoid implementing visuals ahead of the behavior they represent. Each stage may be delivered in small, reviewed implementation slices. Shared requirements are cross-referenced rather than duplicated as separate features.

### Stage 1 — Define the live model and evidence contract

1. Inventory existing project, solver, route, device-state, and telemetry foundations before changing them.
2. Specify the supported electrical quantities, update lifecycle, terminal/sign conventions, measurement/continuity semantics, output-clear behavior, and reading provenance.
3. Define initial operating scenarios and acceptance fixtures, including normal operation, wrong cable sizing, missing protection, reversed battery connection, and device-specific MPPT/inverter states.
4. For each fault scenario, record assumptions, causal rules, expected readings/state changes, damage eligibility, recovery, and unsupported cases.
5. Separate sourced product constraints from generic teaching assumptions and record what the model does not calculate.

**Acceptance:** every proposed live reading, meter measurement/continuity result, and fault behavior has a defined source/assumption, units, expected observable result, and explicit boundary. Output clearing is defined as display/history-only, with no circuit side effect. No numerical threshold is invented or treated as universal.

### Stage 2 — Make routes collision-aware, separated, and stable

1. Establish route geometry based on actual component bounds, terminal locations, and wire clearance.
2. Allocate distinct lanes/levels to wires and define deterministic handling for crossings, constrained spaces, and route priority.
3. Detect and prevent self-intersections, avoidable loops, overlapping centerlines, and routes concealed by equipment.
4. Improve corner and segment editing so neighboring corners move smoothly while preserving right angles and avoiding loop creation.
5. Recompute affected routes when components move or resize, while retaining user edits when they remain valid.
6. Keep route changes attached to stable endpoints and preserve history/persistence behavior.

**Acceptance:** representative dense layouts have no wire hidden by device geometry, no avoidable self-loops, and no indistinguishable shared wire paths; corner edits remain smooth and orthogonal; device resize/movement, undo/redo, save/reload, and import preserve the expected endpoints and route intent.

### Stage 3 — Make readings, multimeter, and flow reflect the live model

1. Establish one authoritative live calculation/update path for the readings in scope, including multimeter measurements.
2. Update dependent device telemetry when topology, supported settings, source conditions, or operating state changes.
3. Make the multimeter produce correct live readings for supported modes and actual continuity results from the modeled path/state; explicitly distinguish open from unavailable or unsupported.
4. Provide a clear-output action for the meter's displayed/saved output, without changing simulation state.
5. Show current direction and relative magnitude on active routes from calculated results; static cues satisfy this requirement. Optional animation may enhance the display but is not required.
6. Ensure route styling and any flow cues remain distinct from connection status, faults, and non-power links.

**Acceptance:** a controlled change to an input produces the expected, timely change to all affected readings and meter results; continuity changes correctly when a modeled path opens/closes; inactive/unsupported paths do not appear energized; readings include units and measurement context; clearing output leaves the circuit unchanged. Animation may be absent without failing acceptance.

### Stage 4 — Let incorrect connections produce modeled behavior

1. Remove compatibility-based blocking from the learner connection workflow while preserving validation of malformed project structure.
2. Represent reversed, mismatched, unprotected, undersized, or otherwise out-of-limit conditions in the model according to Stage 1 rules.
3. Calculate observable electrical changes and supported progression (for example, limits, protection response, thermal effects, or damage) before or alongside explanatory diagnostics.
4. Keep the cause, evidence, and confidence/assumption visible and specific to the affected wire/device/system.
5. Resolve active issues when their causal conditions are corrected without erasing useful historical evidence.

**Acceptance:** learners can create the planned incorrect connections without an arbitrary compatibility blocker; each tested scenario produces its specified reading/state/effect; explanation corresponds to observed model evidence; unsupported outcomes are labeled, not fabricated.

### Stage 5 — Add stateful damage and replacement

1. Implement damaged/dead states only for component types and failure modes defined in Stage 1.
2. Ensure damaged components stop, limit, or alter operation and telemetry as specified by the model.
3. Add a discoverable replace/restore action with an explicit preview or confirmation of preserved settings and connection handling.
4. Keep replacement undoable and compatible with project persistence/import; do not duplicate IDs or silently rewire unrelated terminals.

**Acceptance:** a supported destructive scenario visibly leaves the affected component in the defined dead/damaged state; replacement restores a usable component with the agreed settings, handles connections predictably, and survives undo/redo and save/reload.

### Stage 6 — Deliver device-specific telemetry and operating states

1. Define and display relevant per-kind input, output, state, and limit readings.
2. Implement battery SOC behavior and charge/discharge telemetry.
3. Separate MPPT PV input from battery output and represent supported conversion/limit behavior.
4. Define inverter readings and state transitions, including bulk/absorption only when fully specified by the model.
5. Make device behavior inspectable through a consistent, discoverable interaction that explains state and evidence without hiding system-wide effects.

**Acceptance:** each supported device shows appropriate live readings, clear units and measurement locations, and an explanatory state; changes propagate consistently across connected devices; unsupported values/modes are not implied.

### Stage 7 — Integrated regression, usability, and documentation gate

1. Verify end-to-end normal and fault scenarios from connection creation through readings, flow, explanation, damage/replacement, and recovery.
2. Add focused automated coverage for routing/lane/self-loop invariants, resize/movement, live update propagation, meter calculations and continuity, clear-output behavior, fault progression, damage/replacement, telemetry calculations, and persistence.
3. Verify keyboard, pointer, touch, narrow layouts, accessible status announcements, reduced motion, and undo/redo for changed interactions.
4. Keep [docs/SIMULATION_LIMITS.md](docs/SIMULATION_LIMITS.md), [docs/EQUIPMENT_FIELDS.md](docs/EQUIPMENT_FIELDS.md), and any applicable source guidance aligned with actual model capabilities.
5. Run relevant typecheck, tests, UI/catalogue checks, build, and browser scenarios before treating a stage as complete.

**Acceptance:** the integrated workflow passes targeted automated checks and documented browser QA; project data remains intact; all claims and reading precision match the implemented model.

## Progress tracker

Planning baseline: 2026-10-22. The user has requested a plan only; no implementation work has started under this refocus. Keep this table synchronized with [goal.md](goal.md).

| Stage | Status | Completion evidence / next step |
| --- | --- | --- |
| 1. Live model and evidence contract | Planned | Define readings, scenarios, assumptions, thresholds, damage eligibility, and model limits before implementation. |
| 2. Collision-aware wire routing | Planned | Specify/test route lanes, obstacle clearances, loop prevention, resize behavior, corner editing, and route persistence. |
| 3. Live readings, multimeter, and current flow | Planned | Establish authoritative updates, live meter modes and actual continuity, clear-output behavior, device telemetry contract, and static/optional animated flow cues. |
| 4. Incorrect connections and modeled effects | Planned | Permit arbitrary terminal pairings and implement the evidence-based behaviors defined in Stage 1. |
| 5. Damage and replacement | Planned | Define per-component failure/recovery behavior and implement settings-preserving, undoable replacement. |
| 6. Device-specific telemetry and states | Planned | Implement battery, MPPT, inverter, and other supported device readings and explain operating states. |
| 7. Integration and verification | Planned | Add regression coverage, perform end-to-end and accessibility/browser QA, and align simulation documentation. |

## Explicit non-goals and boundaries

- This plan does not authorize a wholesale editor rewrite or an unbounded general-purpose physics engine.
- “Connect anything to anything” means do not block learner experiments for electrical incompatibility; it does not mean accepting structurally malformed project data.
- Do not invent damage, thresholds, exact readings, or operating modes when the model lacks support.
- Do not present animation, warnings, or simplified calculations as installation approval, standards compliance, or a substitute for professional/manufacturer guidance.
- Do not expand the catalogue or unrelated editor features unless required by a defined refocus requirement.
- Do not mark an item complete because a control or warning exists; verify the observable behavior and its stated acceptance criteria.
