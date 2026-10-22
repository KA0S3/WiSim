# Wi-Sim refocus goals and progress

## Active product goal

Improve the sandbox in two connected areas: make wires route cleanly around realistically sized equipment, and make the electrical system respond with live, device-specific behavior when learners change connections or settings. Learners should be free to experiment, see modeled consequences instead of only generic warnings, understand what each device is doing, and recover from supported equipment damage without rebuilding its configuration.

The complete structured requirements, delivery sequence, and acceptance criteria are in [SANDBOX_REFOCUS_PLAN.md](SANDBOX_REFOCUS_PLAN.md). This file is the concise active-goal and progress tracker. Update both files together as stages are planned, implemented, and verified.

## Previous goals — OUT OF SESSION

The goals below are retired from the active session and are not additional work items. Any overlapping concerns are active only where they have been explicitly restated as requirement IDs in the new refocus plan.

- **OUT OF SESSION — Shared catalogue/equipment/terminal validation workstream.** Earlier goal: unify product identity, sourced ratings, editable settings, terminal metadata, and project validation.
- **OUT OF SESSION — General device configuration and terminal presentation workstream.** Earlier goal: broaden per-device inspectors, terminal placement/reordering, and layout presentation.
- **OUT OF SESSION — Deliberate wire-properties connection flow.** Earlier goal: wire endpoint selection, conductor-properties dialog, cable-palette removal, and legacy cable handling.
- **OUT OF SESSION — Earlier route-editor completion scope.** Earlier goal: direct route editing, crossings, and clear cable rendering. The new route requirements replace that scope and specifically add separate lanes, self-loop prevention, smooth corner movement, obstacle avoidance, and device-size-aware routing.
- **OUT OF SESSION — Earlier warning-panel and digital-multimeter redesign.** Earlier goal: top-level warnings and generic multimeter access. The new telemetry/fault goals replace that direction with causal live behavior and device-specific readings; any measurement UI retained must serve those new requirements.
- **OUT OF SESSION — Previous broad integration sequence and acceptance list.** Earlier goal: verify the former catalogue, inspector, connection, warning, and meter workflow. The new plan's seven stages and acceptance checks are authoritative.
- **OUT OF SESSION — Previously closed adjacent goals:** product-name consistency, reset/save/export clarity, separate irradiance controls, general zoom/pan redesign, unrelated catalogue expansion, and broad symbol/decorative-alert redesign.

“Out of session” means these are not active goals for this request; it does not assert that the historical work was implemented, re-tested, or removed from the application.

## New active goals

All goals below are **Planned**. The repeated emphasis in the request is represented explicitly: routing separation/obstacle avoidance/corner behavior and live readings/current flow/device-specific telemetry are tracked as distinct but related goals, then verified together in the integration stage. Multimeter correctness, actual continuity, and clearing its output are explicit requirements; current-flow animation is optional.

| Goal ID | Active goal | Requirement coverage | Status |
| --- | --- | --- | --- |
| G1 | Make wires independently readable: route around equipment, occupy separate lanes, avoid self-loops and indistinguishable shared paths, and keep crossings clear. | WR-1, WR-2, WR-3 | Planned |
| G2 | Make routing respond to equipment size and movement; make corner edits smooth, orthogonal, stable, and persistent. | WR-4, WR-5, WR-6 | Planned |
| G3 | Make live readings and visible current flow respond to the current electrical model, with clear units, direction/magnitude, and non-animated clarity. Current-flow animation is optional and appreciated, not required. | LS-1, LS-2, LS-5 | Planned |
| G4 | Let learners make arbitrary terminal connections and see specific, evidence-based modeled consequences rather than compatibility blocking or warnings alone. | LS-3, LS-4, LS-5 | Planned |
| G5 | Define and model supported fault progression, including wrong cable sizing, missing protection, and incorrect battery connections; make damage stateful where justified. | FC-1, FC-2, FC-3, FC-5 | Planned |
| G6 | Let learners replace/restore damaged equipment while preserving appropriate settings and handling connections predictably. | FC-4 | Planned |
| G7 | Give each device kind meaningful live readings and explain operating state, especially battery SOC, MPPT PV input versus battery output, and inverter modes such as bulk/absorption when supported. | DR-1, DR-2, DR-3, DR-4, DR-5 | Planned |
| G8 | Verify all of the above as one accessible, persistent workflow and keep documentation honest about model capabilities. | Stage 7 | Planned |
| G9 | Make the multimeter genuinely functional: show live measurements, determine actual modeled continuity, report open/unavailable states honestly, and provide a clear-output action that does not change the circuit. | MM-1, MM-2, MM-3, MM-4, MM-5 | Planned |

## Stage tracker

The plan and these goals were created on 2026-10-22. **No implementation is claimed complete.** Change a status only when work has actually begun or the linked acceptance checks have been satisfied; record concrete evidence and remaining work in the plan's progress tracker.

| Stage | Goal IDs | Status | Next planning/delivery checkpoint |
| --- | --- | --- | --- |
| 1. Define live model and evidence contract | G3, G4, G5, G7, G9 | Planned | Specify supported quantities, meter/continuity semantics, clear-output behavior, fault scenarios, assumptions, expected effects, and unsupported cases. |
| 2. Collision-aware routes and corner editing | G1, G2 | Planned | Establish and test route geometry, separate lanes, self-loop rules, device clearances, and stable edit behavior. |
| 3. Live readings, multimeter, and current flow | G3, G7, G9 | Planned | Validate live meter readings and actual continuity against controlled topology/state changes; verify clear-output does not alter the circuit. Static flow cues are sufficient; animation is optional. |
| 4. Incorrect connections and modeled effects | G4, G5 | Planned | Permit incompatible connection experiments and implement the consequences defined in Stage 1. |
| 5. Stateful damage and replacement | G5, G6 | Planned | Implement only supported damage states and an undoable, settings-preserving recovery action. |
| 6. Device-specific telemetry and states | G3, G7 | Planned | Deliver battery, MPPT, inverter, and other supported device telemetry with explanations. |
| 7. Integrated verification and documentation | G1–G9 | Planned | Verify end-to-end scenarios, meter/continuity/clear-output behavior, persistence, accessibility, reduced motion, browser layouts, and model-limit documentation. |

## Progress update rules

- Track progress by requirement ID and stage in [SANDBOX_REFOCUS_PLAN.md](SANDBOX_REFOCUS_PLAN.md); keep the summaries in this file synchronized.
- “Planned” means not started. Use “In progress” only when implementation work begins. Use “Blocked” only with the concrete blocker recorded.
- Mark a stage or goal complete only after its acceptance criteria pass; link or name the relevant tests/manual QA evidence in the plan.
- If a requirement changes, update both files and preserve a concise history of the change rather than silently dropping it.
- Until the user requests implementation, keep this session limited to planning and progress tracking in these Markdown files.
