# Wi-Sim: narrow-change product plan

This replaces the previous broad sandbox-rebuild plan. It is a product plan, not authorization to implement all of these changes at once. Make future work in small, reviewable slices that fit the existing app. Do not replace the editor, simulation engine, or persistence architecture unless a specific change proves that necessary.

## Product goal

Wi-Sim is an educational solar and electrical wiring sandbox. Learners should be able to assemble a system, understand what each terminal and cable does, observe modeled electrical behavior, make a mistake safely, and learn from a clear explanation of what happened.

**Learning comes before visual effects or feature breadth.** Favor a clean, efficient interface: readable device shapes, restrained colors, clear electrical symbols, concise labels, and direct controls. Avoid visual clutter, oversized iconography, glow effects, and decoration that competes with the wiring.

## Existing app: starting point

The current project is a React/TypeScript/Vite app with a custom SVG workbench and a bounded educational simulation. Keep this foundation and extend it incrementally.

Already present:

- A shared workbench with terminal-aware DC, AC, data, and earth connections.
- Wire properties including gauge, material, length, color/label-related metadata, and persisted orthogonal bend points. A selected bend can be moved.
- Live, simplified PV, battery, inverter, load, protection, bus, and AC-source behavior, plus project-level solar irradiance and diagnostic evidence.
- A component catalogue with PV, MPPT, batteries, inverter/chargers, grid/shore sources, transfer switches, loads, fuses/breakers, and buses. Some records are references rather than verified behavioral models.
- Local autosave and project import/export, plus fault and design-learning flows.
- Accessible controls and responsive styling, with manual browser interaction QA still identified as an outstanding gate in `docs/BROWSER_QA_CHECKLIST.md`.

Important gaps visible in the current implementation:

- A new project starts with a populated example system and a device preselected. Reset restores that starter system rather than an empty canvas, and the reset action currently has no confirmation.
- The header advertises a “LIVE” mode even though the simulation already updates continuously.
- Diagnostics are shown in the selected device's inspector; there is no single warning control that lists only currently active issues and navigates to them.
- The canvas uses a fixed SVG viewBox and scale-based zoom. The requested larger, smoother workspace and controls anchored outside the work area need a focused UX pass, not an infinite-canvas rewrite.
- Cable specifications and draggable bends exist, but the requested direct cable editing and easy add/remove/move corner controls need verification and completion.
- Terminal-aware connections exist, but user-adjustable terminal positions and their interaction with routing need a small, explicit design.
- Component names/labels and status content can overwhelm the device shapes. Add common electrical equipment only when its terminals, behavior, and educational purpose can be represented clearly.

These observations describe the code and project documentation inspected for this plan; they do not claim that the outstanding browser QA has been completed.

## Prioritized implementation plan

### 1. Make the default workflow empty, clear, and saveable

- Rename the user-facing product to **Wi-Sim** consistently in the app title, visible branding, and relevant UI copy. Keep internal package identifiers unchanged unless a separate need is established.
- Start a new, unsaved sandbox empty and with no device selected. Continue loading a user's saved project normally.
- Make Reset ask for confirmation, then clear the current sandbox to an empty state. Keep challenge/lesson reset behavior distinct so it continues to restore that challenge rather than erase the normal project.
- Keep autosave, but make the save state and an explicit way to save/export a named wiring easy to find. Make it clear whether changes are saved locally and how to keep a portable backup.
- Remove the misleading “LIVE” mode banner; retain a concise explanation that model readings update as the learner edits.

**Acceptance:** first-time use opens an empty canvas; a saved project still reloads; reset cannot silently erase work; challenge reset remains isolated; users can identify saved state and export a wiring.

### 2. Improve cable editing and the work area

- Put zoom and direction/pan controls in a compact, fixed workbench footer or equivalent area outside the drawable canvas. They must not cover wiring or consume canvas space.
- Improve drag/pan responsiveness and enlarge the bounded work area without requiring an infinite canvas. Preserve keyboard operation, focus, and small-screen usability.
- Let a learner edit a cable's available properties where it is created or selected: conductor size, material, length, color/label, and supported parallel/insulation details. Keep units and model limits visible; do not imply that a cable's drawn width is an ampacity guarantee.
- Complete direct bend editing: add, move, and remove 90-degree route corners. Keep the orthogonal route attached to the correct terminals after devices move.
- Prefer routes that go around device bodies. Make unavoidable route conflicts visible rather than drawing a wire deceptively behind a device.
- Verify whether selection-scoped terminal position editing can build on the current terminal model. If so, expose a simple position control with a live preview and update connected routes; keep sensible per-device defaults.

**Acceptance:** learners can specify a cable, move its route around equipment, add/remove/move corners, and adjust supported terminal positions without disconnecting wires. Controls remain outside the usable canvas and work at the checklist's target screen sizes.

### 3. Make solar conditions and modeled results understandable

- Expose sunlight/irradiance as an obvious percentage setting on the selected PV array. If multiple arrays are supported, make the scope of the setting explicit rather than silently changing every array.
- Show relevant modeled output/current at the array and connected equipment, and update it as irradiance, wiring, or device settings change.
- Explain why a reading changes and mark unsupported calculations honestly. Keep the simulation's documented boundaries; do not present a simplified result as a measured or certified real-world prediction.

**Acceptance:** changing sunlight percentage produces a visible, explainable change in the model where the connected topology supports one; disconnected or unsupported paths do not show fabricated current.

### 4. Replace inspector-only diagnostics with active, navigable warnings

- Add one compact warning button in the sidebar with a severity-based color and an active-warning count. Clicking it expands/collapses the warning list.
- Show current actionable warnings, not old diagnostic history as if it were still active. Preserve history only as a clearly separate learning/evidence feature if useful.
- Selecting a warning should pan/scroll to the relevant device, terminal, or wire and highlight it on the canvas. Provide a clear way back to the normal view.
- Move the primary diagnostic experience out of the selected-component inspector. Keep component-specific settings there; show relevant warning context consistently regardless of selection.
- Add a small, restrained visual cue (for example, a brief spark token) only when the modeled event justifies it, with a nearby warning. Motion must respect reduced-motion settings and never substitute for the explanation.
- Research warning rules before implementing them. Use current, credible electrical references and manufacturer documentation for the relevant equipment; distinguish well-supported checks from simplified teaching heuristics. Warnings should explain the condition, evidence, consequence, and a safe learning-oriented next step. Account for topology, polarity, domains/roles, ratings, protection, and cable data only where the model has sufficient inputs. Explicitly label unknown or unsupported cases instead of guessing.

**Acceptance:** only active issues appear in the active list; each warning points to its source and explains why it matters; selecting it locates and highlights that source; visual alerts are restrained and accessible.

### 5. Improve component clarity and add equipment selectively

- Use recognizable, clean electrical symbols in the component palette and as compact identifiers on the canvas. Pair symbols with short readable names; do not rely on icon recognition alone.
- Simplify canvas device facades so terminals, polarity/phase, and connections remain legible at ordinary zoom. Prevent labels and status text from overlapping the device or one another.
- Prioritize commonly used solar/electrical equipment that fills a real learning gap, such as fused distribution/fuse holders, DC-DC chargers, disconnects, and busbars. Check existing catalogue entries first.
- For each addition, define its actual terminal layout, editable/relevant ratings, supported behavior, and source quality before adding it. A multi-branch fuse holder must model its branches and protection meaningfully; do not approximate it as a generic fuse or bus without making the limitation explicit.
- Clearly distinguish verified device models from illustrative/reference-only catalogue entries. Expand in small batches, preferring a few understandable and source-backed devices over a large unverified catalogue.

**Acceptance:** a learner can identify equipment and connection points without reading overlapping text; new equipment has a distinct purpose, intelligible terminals, and honest behavior/source status.

## Research and safety boundaries

Research is part of the implementation of warning rules and new equipment, not a reason to replace the app architecture. Trace each rule or model claim to credible, current references (including manufacturer documentation where applicable). Record what the simulation can and cannot establish. Do not invent universal wiring rules from incomplete context, imply that a spark animation is a physical prediction, or claim code/standard compliance, installation approval, or certification.

The solver remains an educational bounded model. Unsupported electrical behavior must remain visibly unsupported. The learning experience should explain mistakes without encouraging users to apply an unverified sandbox design to real installations.

## Delivery sequence and verification

Work in this order, one narrow slice at a time:

1. Brand, empty-new-project behavior, confirmed empty reset, and save/export clarity.
2. Canvas controls and the specific cable/route/terminal editing gaps confirmed in browser testing.
3. PV irradiance and understandable live readings.
4. Source-backed active warning list and canvas navigation.
5. Legibility improvements and individually researched catalogue additions.

For each slice, inspect the existing behavior first, update only directly related code/docs, add focused regression coverage, and verify the affected flow. Before calling the UX complete, perform the interaction checks in `docs/BROWSER_QA_CHECKLIST.md` at laptop, tablet, and phone widths, including keyboard/focus and reduced-motion behavior. Keep `docs/SIMULATION_LIMITS.md` accurate as modeled behavior changes.

## Explicit non-goals

- No broad dashboard rebuild, canvas-library migration, or simulation-engine replacement as part of this refocus.
- No infinite canvas or wholesale visual redesign.
- No large catalogue expansion for its own sake, photorealistic product artwork, heavy iconography, or glowy effects.
- No claim that WireSim is a general-purpose circuit solver, installation tool, or substitute for manufacturer instructions and applicable standards.
- No implementation of this whole plan in one change. Each future change should have a narrow scope and its own verification.
