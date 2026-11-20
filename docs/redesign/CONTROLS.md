# Workbench controls

The shared 2D home/compartment editor is available in the system designer and 3D controls. Building-only application and explicit equipment refit have separate effects. Floor/roof selection, construction animation and generated Learn rooms are described in [Building design](BUILDINGS.md). Six focused Edge scenarios passed for the new workflows, including phone controls, route preview/Undo and plan gestures. Escape cancels plan editing without closing the designer. Tab navigation includes collapsible sections and the plan.

Supported cable routing was added on 17 November 2026. In 3D, select a conductor and use Preview supported route, Apply or Cancel. Applied routes follow saved supports and report failed support changes. Manual bend edits clear automatic tracking. See [Supported routing](ROUTING.md) for geometry constraints and verification.

For named projects, copies, saved versions and portable backups, see [Saving and retrieving projects](SAVING.md).

For coloured fault markers, the diagnostics drawer and optional one-at-a-time fixes, see [Sandbox warnings and optional fixes](DIAGNOSTICS.md). Electrically wrong sandbox setups remain allowed.

## Schematic organisation and selection

The wheel zooms. **Ctrl + wheel** pans vertically; **Shift + wheel** pans horizontally. Middle/right drag pans. Drag a rectangle from empty canvas to select multiple items; **Ctrl-click** adds/removes items. Drag selected equipment to move the group in one Undo step while retaining its wires.

**Auto arrange** keeps a layered electrical layout. Its **Options** menu provides **Compact layers** and **Arrange for screen**, which wraps the layout to the available canvas shape. These operations change schematic coordinates, not electrical connections, physical positions or specified/measured cable lengths.

Multiple selection opens group actions in the right sidebar: copy, download, use as a separately saved system, delete selection or delete other equipment. Destructive actions show what will be removed and require the in-app confirmation; **Keep everything** cancels. Undo restores a deletion. Copies retain internal conductors and explain excluded boundary connections. **Paste** adds copied equipment to the current project with independent identities/references; it also works after switching projects. It is not connected to existing equipment automatically.

Settings and 3D positioning panels scroll independently at normal browser zoom, including short windows. **Hide/Show 3D controls** is available on desktop as well as phone. Nested mounting/site settings use the outer panel scroll. The 3D canvas keeps touch gestures; overlay panels retain native scrolling.

## Move equipment without breaking connections

Select **3D workbench**, then select equipment by clicking it or using **Selection**. Press **W** for Move. Drag the selected body or the coloured axis arrows. Body dragging slides mounted equipment along its mounting surface; the arrows can also change its clearance. Wires remain attached to their original terminals. Measured cables update their length; specified lengths remain explicit assumptions.

Press **X**, **Y** or **Z** to constrain movement; press the same key again for all axes. Arrow keys nudge 1 cm; **Shift + arrow** nudges 10 cm. In all-axis mode, left/right moves X and up/down moves Y. A drag previews locally and commits once on release. **Escape** cancels the drag; **Ctrl+Z** undoes the committed movement.

Press **V** for Camera. Left drag orbits, right drag pans, and the wheel zooms. Right-drag pan and wheel zoom also work in Move mode. **F** focuses the selection; **Home** fits the system. Perspective, Front, Top and Focus buttons provide the same discoverable camera actions.

Explicit camera commands stop leftover pan/orbit momentum before fitting or focusing, so the target stays centred. The scene renders on demand; changing live readings does not redraw unchanged physical equipment.

On a phone, **Hide equipment settings** keeps the selection while closing the settings panel. **Settings** reopens it. **Hide 3D controls** frees the canvas for gestures; **Show 3D controls** restores the tools. In Move mode, drag the selected body with one finger. In Camera mode, one finger orbits; two fingers pan or pinch to zoom. Interrupted touch gestures and loss of window focus cancel unfinished movement.

## Add and configure equipment

Choose a component from the equipment library while in 3D. The app keeps the 3D view, selects and focuses the new equipment, and opens its Configuration tab on the right. Edit its ratings there. **Closest catalogue matches** updates for panels, controllers, batteries, inverters and supported chargers. Nearest verified alternatives stay visible when no product satisfies every rating. Each card explains the differing voltage, power, capacity/current, frequency and surge values where applicable. **Use this product** applies its catalogue ratings/dimensions while preserving identity, placement and external wiring. Warnings remain visible; a closest alternative is not an approval of suitability.

Where smaller panels or batteries can meet the requested power/capacity/current using multiple units, **Use N units in parallel** creates individual equipment and measured positive/negative branch conductors. Product voltage stays unchanged, so parallel units cannot fix a voltage-class mismatch. New branch cables initially use 16 mm2 and need sizing/protection/terminal review. Arbitrary series stacking of named batteries is not assumed. Compact bank/array presentation and richer bank-aware alternatives remain open work.

Expand **Attached cables** to inspect a selected device's connections or select a cable for routing and length settings. Press **C** for Connect, choose the source equipment and terminal, then the destination equipment and terminal. New 3D connections use measured lengths. Select a cable and choose **Add wire bend** to edit its route.

## Walls, roofs and mounting

**Add wall / roof / rail / box** are visible in the 3D controls. Select the new structure to edit its size, position and rotation in **Workspace & mounting**. Select equipment and use **Mount to** to attach it. Enclosures support front and inside-back mounting. Moving or rotating a parent carries its equipment and terminals. Removing a structure keeps its equipment in the same world position.

For a solar panel, use **Panel roof** in **Panel angle & sun**. **Panel tilt degrees** is measured from horizontal: 0 is flat and 90 is upright. **Facing azimuth degrees** is clockwise from north: 0 north, 90 east, 180 south, 270 west. Roofs have equivalent pitch and facing controls. **Match mounting angle** aligns a panel with its surface. Tilting a mounted panel preserves clearance beneath its lowest corner.

## Sun and live information

The compass shows north, the selected facing and the sun's azimuth. Expand **Site & time settings** to enter latitude, longitude, UTC offset and local date/time. The initial Johannesburg location/time is an example. **Advance 1 hour** and **Aim at sun now** support comparisons.

Enable **Use site & panel angles in simulation** to couple panel orientation to live PV current. The model combines beam incidence and a configurable diffuse sky fraction, multiplied by the existing sunlight setting. Night output is zero. Weather, roof shadows and annual energy yield are not modelled.

In Schematic view, hover over a device for a readable popup with live voltage, current and power; batteries also show charge, and chargers show input power. Click a device for Configuration or Live readings. Hover control buttons for shortcut and usage hints.

## Terminal detail on desktop

Use the **Component** picker or **Previous/Next component** buttons to switch equipment while remaining in Terminal detail. The view reuses the same available 3D body and terminal anchors as the workbench, with the same source/approximation notes. No additional manufacturer CAD assets are implied. Drag to orbit, right-drag to pan and use the wheel to zoom; **Front view** and **Frame component** reset the inspection camera without residual pan/orbit inertia.

Click a labelled 3D terminal or a terminal-strip button to attach voltmeter probes. Live voltage/current/power are displayed below the model; AC quantities identify RMS values. Close the voltmeter when returning to the connection list if it covers the area you want to inspect. A conductor row opens its settings while keeping the current component in the model view. The arrow beside it follows the connected equipment directly. Inspection/camera movement does not modify device placement or circuit wiring.

## Compact arrays and banks

Select a grouped node or its diagram button for settings. Expand/Collapse changes the schematic, Extract separates chosen members without disconnecting them, and Ungroup keeps all real equipment. Add matching parallel branch copies a complete series/protected branch after review confirmation. Multi-selection can create a compact array/bank. Copy and delete operate on real members, with independent identities on paste and confirmation before deletion. See [GROUPS.md](GROUPS.md).

## Designer and interaction improvements

- Cable route length is optional. Blank means measured terminal-to-terminal routing; generated house runs use vertical wall drops and horizontal wall/ceiling runs. Cable schedules include measured routes, specified minimums and balancing slack.
- Panel wattage, quantity and string count can be set independently or left automatic. Sourced panel/MPPT combinations still have to satisfy energy, cold-voltage, hot-voltage, current and power limits.
- Generated projects with unresolved placement/routing failures are rejected with the affected items. The app checks full-sun and battery-only startup with ngspice before opening a generated project. These are operating-point checks, not proof of all possible operating conditions or installation compliance.
- Long motor starts size continuous inverter power. Startup current also sizes battery capacity/current paths and protection.
- Building preferences can choose rooms and walls by equipment category, individual scheduled appliance, or existing equipment. Wall numbers appear on the plan. Lower floors appear as optional dashed guides with junction snapping.
- Compass north is measured clockwise from plan up. Automatic panel placement ranks available roof slopes toward the equator, then fills fitting spaces. Hemisphere is explicit. This is an orientation heuristic; annual weather, shading and financial yield optimisation are not included.
- Obstructing walls, roofs and panels fade with the camera and allow equipment clicks through them. Selecting a structure keeps it solid for editing. The optional roof visibility control remains available.
- Hold Ctrl while panning or zooming in 3D for four times normal speed. Release Ctrl or leave the window to restore normal speed.
- Trip findings retain the measured overload, duration, rating and adjacent equipment after the path opens. Generated-system trip/overload findings offer a previewed rebuild from saved requirements; manual modifications are replaced by that rebuild. The separate trip reset keeps time and stored charge.

Run `npm run ui:improvements` for the opaque/faded selection comparison, rendered fade check, Ctrl zoom and retained-trip diagnostics. Screenshots and results are written to `artifacts/`.
