# Home and compartment designer

Implemented with focused checks on 17 November 2026. Section 4 visual review passed six isolated Edge scenarios with no page errors, including actual wall/curve gestures, construction stages, route preview/Undo, independent application and phone controls. Screenshots are in artifacts/qa-building-*.png. Room labels and surface appearance were refined after reviewing these images.

## Editing a layout

Open Design home/compartment in the optional collapsed system-designer section, or in the 3D controls. Enable a layout in the system designer. Set floor count, height, wall thickness, floor width/depth, roof shape and pitch. Small compartments can use heights down to 0.2 m. The workspace supports up to 100 floors and 5000 generated surfaces within its import/render capacity.

Choose Straight wall or Curved wall and click successive endpoints on the snapped plan. Close wall loops to create rooms. End the chain with Escape. Intersections split into shared junctions. In Select mode, drag a wall/junction, change the selected wall shape, or drag its amber curve control. Remove wall and local Undo are available. Pan, zoom, Fit layout and grid spacing controls support larger plans and touch input.

Floors can have different layouts. Added floors start as independent copies of the preceding floor. Name rooms and choose an indoor equipment room and panel roof. Multi-room fitting requires explicit targets. Roof choices include flat, gable, hip and shed. Triangulated/clipped roof pieces preserve irregular footprints and exposed lower-floor areas. Curves use connected quadratic walls with faceted 3D segments.

## Applying and fitting

System generation includes the layout and fits the equipment. Independent 3D application has an explicit Refit checkbox, initially clear. Building-only application preserves world equipment placement and electrical wiring. Replacing previously generated supports detaches their mounted equipment at its resolved world placement. Refit packs actual saved dimensions onto indoor wall faces or floor space and the selected roof. Panels can rotate by 90 degrees. Fit checks reject concave gaps and overlapping equipment footprints. Unsupported placements/routes are listed in 3D controls.

Existing sourced panel/controller models are used by the system designer. Generic battery/inverter assumptions remain documented until the later electrical/product sections. Fitting preserves unit identities and electrical topology. Supported routes are proposed for fitted conductors, and generated design paths are resized for the resulting physical lengths. Mechanical loading, doors/windows, access/fixing engineering and manufacturer CAD fidelity require additional inputs.

The 3D construction sequence reveals walls, floors, indoor equipment, roofs, panels and conductors during a 7.5-second origin-centred orbit/zoom-out. Reduced motion skips the sequence. Take control and camera interaction end it. Roof/panel visibility can be toggled for interior inspection. The layout, room choices, generated surfaces, mounts and routes save with the project.

Learn runs offer a generated practice layout by default, with an opt-out. Dimensions vary with the sampled run. Beginner/Ready/Advanced layouts contain one/two/three rooms respectively. Existing learning scenarios and checks are preserved.

## Focused evidence

Twelve building cases passed after removing an unnecessary undefined optional field exposed by the JSON round-trip assertion. Seven routing and six prior mounting cases also passed after polygonal surfaces/back-wall mounting were added. A real-ngspice building-fitted design solves with no fault findings after route-based conductor resizing. TypeScript passes. Broad/browser checks remain scheduled for the later verification stage.
