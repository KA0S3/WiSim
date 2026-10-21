# WireSim Sandbox browser QA

Source of truth: [SANDBOX_REFOCUS_PLAN.md](../SANDBOX_REFOCUS_PLAN.md). This checklist is the remaining manual release gate; it is not a substitute for running the app in a browser.

Run `npm run dev -- --host 127.0.0.1 --port 4173`, then test the same session at:

- Laptop: 1440×900
- Tablet: 768×1024
- Phone: 390×844

For each viewport, record pass/fail and a screenshot or note for:

1. The fixed header remains visible; rails and inspector scroll internally; the document has no horizontal overflow.
2. Add PV, battery, inverter, and load devices. Drag with mouse and touch at 70%, 100%, and 130% zoom; confirm grid snapping, accurate pointer alignment, and attached wire movement.
3. Click two compatible labeled terminals. Confirm the wire lands on the terminal rows, uses the correct domain colour, and shows gauge/length/material/parallel metadata. In the conductor dialog, verify focus starts in the fields, Tab stays within the modal, Enter saves a valid connection, Escape cancels, and invalid conductor settings disable saving. Also connect an intentionally incompatible terminal pair: it should save with a specific warning and brief subtle pulse, remain excluded from modeled power paths, focus the wire when its warning is selected, and clear when the wire is corrected or deleted.
4. Select, bend, and delete a wire. Drag bends at different zoom levels and viewport aspect ratios; confirm pointer alignment and persistence after export/import or reload. Force a saved-corner conflict, reset corners to auto-route, and confirm the path recovers where space permits; verify Undo restores the bends.
5. Use Shift/Ctrl/Cmd multi-selection, Delete, Ctrl/Cmd+D, Undo, Redo, and Reset. Confirm selection and inspector state remain coherent.
6. Change AC profile, load demand, and cable gauge. Use the inspector controls to open/close a transfer switch and trip/reset a fuse; confirm readings and state indicators update without Run/Pause, and Undo/Redo restores each change.
7. Open Fault Lab and a lesson. Confirm the challenge stays isolated, probes use the live solution, and reset restores the normal project.
8. Tab through controls and SVG terminals; activate a terminal with Enter/Space; confirm visible focus rings and polite status feedback.
9. Enable reduced motion; confirm transitions and connection-warning pulses are disabled and no interaction becomes unavailable.
10. Attach voltage, current, resistance, and continuity probes. Confirm the readings track project changes, the latest saved readings can be removed individually, older readings can be cleared as a group, and probe state survives export/import.

Do not mark the gate complete until these actions have been performed in a real browser at all three widths.
