# WireSim Sandbox browser QA

Source of truth: [SANDBOX_REFOCUS_PLAN.md](../SANDBOX_REFOCUS_PLAN.md). This checklist is the remaining manual release gate; it is not a substitute for running the app in a browser.

Run `npm run dev -- --host 127.0.0.1 --port 4173`, then test the same session at:

- Laptop: 1440×900
- Tablet: 768×1024
- Phone: 390×844

For each viewport, record pass/fail and a screenshot or note for:

1. The fixed header remains visible; rails and inspector scroll internally; the document has no horizontal overflow.
2. Add PV, battery, inverter, and load devices. Drag a device and confirm grid snapping and attached wire movement.
3. Click two compatible labeled terminals. Confirm the wire lands on the terminal rows, uses the correct domain colour, and shows gauge/length/material/parallel metadata.
4. Select, bend, and delete a wire. Confirm the bend persists after export/import or reload.
5. Use Shift/Ctrl/Cmd multi-selection, Delete, Ctrl/Cmd+D, Undo, Redo, and Reset. Confirm selection and inspector state remain coherent.
6. Change AC profile, load demand, and cable gauge. Confirm readings and device-state indicators update without a Run/Pause action.
7. Open Fault Lab and a lesson. Confirm the challenge stays isolated, probes use the live solution, and reset restores the normal project.
8. Tab through controls and SVG terminals; activate a terminal with Enter/Space; confirm visible focus rings and polite status feedback.
9. Enable reduced motion; confirm transitions are disabled and no interaction becomes unavailable.

Do not mark the gate complete until these actions have been performed in a real browser at all three widths.
