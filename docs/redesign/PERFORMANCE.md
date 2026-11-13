# Interaction measurements — 13 November 2026

Run `npm run build` followed by `npm run ui:performance`. The script owns a local preview and uses headless Microsoft Edge. Fixtures contain repeated, electrically separate solar/storage systems, with simulation running during camera pan and selected-equipment dragging. It checks wiring identity, unchanged saved data while dragging, successful movement and one-step Undo.

Latest renderer: ANGLE / Intel UHD Graphics 730 / Direct3D11. These results describe this host, viewport and fixture; they do not establish performance on all devices or every 500-device project.

| Devices / conductors | Pan frame cadence, p95 | Drag frame cadence, p95 | Pointer-to-frame delay, p95 (pan / drag) | Idle WebGL draw calls over 1.2 s |
| --- | --- | --- | --- | --- |
| 7 / 11 | 16.8 ms | 16.8 ms | 14.1 / 14.5 ms | 0 |
| 84 / 132 | 16.8 ms | 16.8 ms | 14.3 / 14.1 ms | 0 |
| 196 / 308 | 33.3 ms | 16.8 ms | 10.4 / 11.5 ms | 0 |

No measured long tasks occurred in those pan/drag windows. The latest run includes named project persistence and the charger power correction. Maximum animation-frame intervals were approximately 34.0 ms (seven-device drag), 17.5 ms (84-device drag) and 33.4 ms (196-device pan). Large-scene pan still drops some frames on this host; pointer-to-frame delay remains below 16 ms at p95. Raw evidence is in `artifacts/interaction-performance.json`; the earlier controls-only run is retained as `artifacts/interaction-performance-controls.json`.

Before render-on-demand, memoized physical-view props and cached contact shadows, the 196-device idle interval issued 125,798 draw calls. Baseline pan p95 was 33.6 ms, with a 133.3 ms maximum frame interval and two long tasks. The baseline is retained in `artifacts/interaction-render-baseline.json`.

The benchmark also exposed camera focus drifting under leftover pan inertia. Explicit camera commands now consume existing control deltas before setting the new target. A generic upright panel's displayed tilt was corrected from 0 to 90 degrees to agree with its actual geometry.

Frame cadence is measured with requestAnimationFrame; pointer delay runs from event timestamp to the next animation frame. These are browser responsiveness indicators, not GPU completion or input-to-photon measurements. Physical-phone GPU performance, maximum-size projects, long-session memory, screen-reader coverage and broader accessibility still require work. Emulated phone touch checks cover selection-preserving panel hiding, movement/Undo, cancellation, orbit and two-finger zoom.

## Real large-network solves and supplied-project recovery

After the native PV convergence, controller power-balance, observation-window and persistent conductor-rendering corrections, `npm run ui:large` passes all four production-worker fixtures. Current raw evidence is in `artifacts/large-system-check.json`; the check now verifies every conductor is actually drawn. These are observed timings on this host, not a performance guarantee or the earlier physical-render benchmark.

| Network | Devices / conductors | First solve | Subsequent solve | Browser navigation to two live frames |
| --- | --- | --- | --- | --- |
| DC distribution | 100 / 198 | 531 ms | 42 ms | 3.07 s |
| DC distribution | 250 / 498 | 690 ms | 131 ms | 4.45 s |
| DC distribution | 500 / 998 | 1,138 ms | 441 ms | 7.66 s |
| Coupled PV/storage/inverter/AC/DC | 500 / 894 | 1,940 ms | 1,500 ms | 8.60 s |

Browser timings include module loading and rendering. DC fixtures use 15 transient samples rather than 511 redundant samples. Dynamic networks retain 511 samples. Typed arrays transfer sample buffers to the UI. DC power balance and advancing simulation time pass; the coupled fixture produces approximately 31.9 kW PV, charges the battery and supplies 11.7 kW of AC loads. Pause remains usable. Current schema limits remain 500 devices/2,000 wires; these particular fixtures do not certify all topologies, maximum wire count or 500-device physical-view performance.

The reported blank-reading project was an eight-device network, not a capacity problem. An unconnected illuminated PV panel made the old clipped-exponential stamp fail to converge. The native diode stamp retains the generic I/V assumption and solves open circuit; a separate bridge patch ensures genuine failed output rejects instead of waiting indefinitely. The unchanged supplied project passes import, continuing per-device readings, inspector display, open-panel voltage, wiring/settings preservation and reload checks in development and production. Evidence: `artifacts/project-simulation-check.json` and `artifacts/qa-user-project-live.png`. It retains the 14.4 V controller target/54.5 V battery warning. No fixed wall-clock termination was reintroduced.

An earlier concurrent single-case run during group testing measured 3.10 s first solve, 2.20 s subsequent solve and 11.36 s navigation to two live frames. The final four-case run above supersedes that single-case artifact and includes explicit rendered-conductor assertions. Initial application JS is approximately 792 kB, the shared physical chunk approximately 1.065 MB and the WASM worker approximately 20.24 MB. Maximum-size physical rendering remains unverified.
