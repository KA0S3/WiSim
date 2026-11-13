# First workbench review

Double-click `Preview.cmd` in the project root. It starts the local Vite server and opens the browser. Keep the command window open while reviewing; Ctrl+C stops it.

Try these flows:

1. Open the solar example, select an appliance and change its power. Watch the solved readings.
2. Select a wire and change length, area or contact resistance.
3. Use the voltmeter and click two terminals.
4. Switch between schematic, 3D workbench and terminal detail.
5. Open the circuit and three-phase examples from Projects.
6. Generate a system, then export JSON, CSV and PDF.
7. In 3D, add equipment and confirm the view stays open with Configuration on the right. Edit ratings and inspect Closest catalogue matches.
8. Press W, drag a selected body, then undo. Check Attached cables; press V for camera orbit and right-drag for pan. X/Y/Z constrain movement; Escape cancels a drag.
9. Add a roof, select a panel, choose Panel roof and set tilt/facing. Enable site angles, edit location/time and compare live PV output. Hover schematic equipment for changing readings.

`IMPLEMENTATION.md` records completed work, verification evidence and remaining work. `UPSTREAM.md` records included solver sources and licenses. This is a review checkpoint, not the completed regional engineering platform.

Current checks: 203 automated tests, typecheck and production build pass. Established production evidence covers 18 general, 12 physical, four touch, seven diagnostics and six controls scenarios (47 total), plus seven new compact-group scenarios. General and controls checks were rerun during grouping; the older physical/touch/diagnostic suites remain separate evidence. Controls include real group dragging/Undo, cross-project copying, normal-zoom positioning and the desktop terminal 3D/component/probe workflow. A final focused production check confirms live numbers stay in view on the inspection model, real probes read battery voltage, and component/wire navigation does not change the circuit. The full rewritten objective is active in FOUNDATION-PLAN.md; desktop functionality now takes priority over touch refinements.

The individual-unit designer produces actual panel/pack/protection quantities and now presents compact expandable arrays/banks. Try extracting a unit, adding a complete parallel branch and copying a bank; check the labelled live totals and real member wiring. CSV/PDF use saved references and complete wire/end schedules; the default seven-page PDF has been rendered, checked for complete device/conductor references and visually reviewed. Actual termination hardware and the other manufacturer/region/design constraints remain unfinished. See IMPLEMENTATION.md, [Model assumptions](ELECTRICAL-MODELS.md), [Running calculations](RUNNING.md) and [Diagnostics](DIAGNOSTICS.md).

Saving/retrieval covers older projects, retained versions, copies, backups, importing older files and storage-failure recovery. 50/60 Hz charger input power balances source power minus cable losses. Earlier interaction measurements cover 7/84/196-device fixtures; real solver fixtures also cover 100/250/500 devices and a coupled 500-device PV/storage/AC network. Broader topology/size coverage, physical touch hardware and accessibility remain open. See [Saving](SAVING.md), [Controls](CONTROLS.md), [Performance](PERFORMANCE.md) and [Current status](STATUS.md).
