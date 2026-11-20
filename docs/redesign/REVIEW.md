# Workbench review checklist

Run `npm run verify` for tests, catalogue validation, the production build and the Edge browser suite. Run `npm run ui:smoke` against that build for Chromium and Firefox coverage. Run `Preview.cmd` for manual review. Record the OS, browser, viewport, scenario, expected and observed behavior, and evidence for any failure.

1. Open a solar example and change an appliance load. Check live watts, probe two terminals and inspect the scope.
2. Create and undo a schematic connection. Confirm equipment moves preserve wiring. Inspect the same cable in 3D and terminal detail.
3. Generate a system with an appliance schedule and AC charger input. Review the PV alternatives and engineering findings. Export JSON, terminal/cable CSV and PDF. Match a branch reference across all three exports.
4. In the building editor, change a wall or roof, then preview, apply and undo a supported route. Verify a missing support produces a finding and check the measured cable length.
5. Save a named version, edit it, restore the earlier version and reopen after reload. Import a JSON backup in a fresh browser profile.
6. Start a Learn exercise, inspect its pass conditions, introduce a fault and verify the evidence after repair.

## Manual accessibility and device checks

- On a physical phone, open the multimeter and tap **Place probes on schematic**. Probe both battery terminals and confirm a voltage appears. Repeat with **Choose probe terminals** in the docked meter. In the 3D view, pinch and orbit, then switch apps and return. Confirm measurements resume and the active panel stays usable.
- With a screen reader on desktop, open Export and Projects from the keyboard. Confirm the dialog title is announced, background controls are unavailable, and Escape returns focus to the launcher. Open diagnostics with a known fault. Confirm the fault count, explanation, inspection action, and repair preview can be read and activated. In the meter, confirm both probe selectors and the resulting voltage are readable. Note whether simulation recovery, progress and errors are announced.

See [status](STATUS.md), the [product audit](AUDIT.md) and [earlier verification](IMPLEMENTATION.md).
