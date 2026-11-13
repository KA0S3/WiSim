# Included upstream source and runtime

The application uses the pinned npm artifact `eecircuit-engine@1.9.0`. Its real runtime header reports ngspice 45.2. All runtime assets, including the WASM embedded by the upstream package, are bundled into the local production output. No remote solver service is required.

| Source | Local directory | Pinned source revision |
| --- | --- | --- |
| https://github.com/eelab-dev/EEcircuit-engine | `vendor/eecircuit-engine` | `be15b07abaf2c8a77623e4fc700d260004fbfa5a` |
| https://github.com/danchitnis/ngspice-sf-mirror | `vendor/ngspice` | `724dc77b9153dc75eaec474b1f7a44f1fcf5f362` (`ngspice-45.2`) |

The full source checkouts are kept intact locally. Portable source archives (excluding only `.git` metadata) are included as `vendor/eecircuit-engine-source.zip` and `vendor/ngspice-45.2-source.zip` for the public repository; the local nested checkouts are ignored by the root repository to avoid accidental gitlinks. Both archives include upstream license files and build scripts. The ngspice/WASM binary is unchanged. WiSim applies the JavaScript bridge fix described below. Its own worker compiles equipment into netlists and carries reactive state, source phase, state of charge and protection state between transient windows.

### Local JavaScript bridge fix

`scripts/patch-solver.mjs` applies a narrow, version-checked patch to the installed 1.9.0 ESM bridge. The upstream raw-output catch only logs an exception, leaving `runSim()` unresolved. Conflicting ideal voltage sources reproduce this: ngspice reports failed operating point/no writable vectors, while JavaScript waits forever. The patch rejects failed output/startup promises and removes the previous raw output before each run, preventing stale measurements. Valid long calculations have no elapsed-time cutoff. It runs on npm install, before npm dev/build/test, and from Preview.cmd. Unrecognised versions/code fail explicitly rather than being patched speculatively. Upstream source archives and licenses remain intact.

`tests/solver-bridge.test.mjs` verifies a real failed solve after a successful solve, then successful reuse of the same engine. `npm run ui:dev` (with the local development server running) independently verifies the failure/repaired-12-V sequence in a browser worker, continuing visible readings, edited load demand, and saved-project reload. Development optimisation excludes the bridge to prevent Vite retaining an older patched dependency in its persistent cache.

`npm ci` reproduces the application dependency tree from the lockfile. `npm run build` includes the pinned prebuilt engine. Rebuilding the WASM itself uses the upstream Emscripten/Docker workflow and patches in `vendor/eecircuit-engine/Docker`; that workflow selects its toolchain dynamically and is not claimed to be bit-for-bit reproducible. The prebuilt artifact's package integrity is fixed by `package-lock.json`.

## Notices

- EEcircuit-engine: MIT; see `vendor/eecircuit-engine/LICENSE` and its bundled model licenses.
- ngspice: modified BSD and component-specific licenses; see `vendor/ngspice/COPYING` and the source notices. Do not replace these with WiSim's license.
- React / React Flow / Three.js / React Three Fiber / Drei / jsPDF: retain package notices.
- ELK / elkjs: EPL-2.0; retain upstream notices and source availability.
- Lucide icons: ISC.
- SunCalc 2.1.4: BSD-2-Clause. The full published npm package is retained in `vendor/suncalc-2.1.4`, with its license also at `public/licenses/suncalc.txt`. Source: https://github.com/mourner/suncalc . Used for astronomical sun position only; WiSim adds the explicitly stated panel-incidence/diffuse-sky assumption. Version 2 returns angles in degrees with azimuth clockwise from north; no version-1 radians/south conversion is applied.
- DM Sans and Manrope font packages: SIL Open Font License; retained with installed packages.
- Embedded PDF font: Roboto Regular from https://github.com/googlefonts/roboto-2, Apache-2.0; see `public/fonts/LICENSE-Roboto.txt`.

Equipment illustrations in `src/workbench/EquipmentArt.tsx` and generic 3D bodies are original procedural artwork. They are not manufacturer CAD or promises of manufacturer-accurate terminal geometry. Existing catalogue source links and verification status are retained.

3D editing reuses the pinned Drei TransformControls/OrbitControls and three-stdlib implementations already installed through npm, with MIT notices retained. Sources: https://github.com/pmndrs/drei and https://github.com/pmndrs/three-stdlib . No separate scene engine has been introduced. Control coordination reference: https://drei.docs.pmnd.rs/gizmos/transform-controls .

Direct equipment-body gestures reuse Drei DragControls with automatic transforms disabled. WiSim previews shared geometry, commits once on release, constrains mounted body movement to the mounting plane and retains the existing terminal graph. It does not replace the upstream pointer-gesture implementation.
