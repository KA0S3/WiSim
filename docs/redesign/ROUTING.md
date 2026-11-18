# Supported 3D cable routing

Implemented 17 November 2026. Select a conductor in 3D and choose Preview supported route. Inspect its path, length and support count, then Apply supported route or Cancel route preview. Apply uses one Undo step. Escape cancels the preview.

The router requires at least one wall. It searches front/back wall faces, roof/rail planes and front/inside enclosure planes. Terminal approaches follow the support normal, remain within surface edges and extend at most 0.4 m. Mounted endpoints use their selected mount face. Plane paths use local horizontal/vertical legs. At a pitched junction, the cable direction follows the adjoining plane's pitch.

Transitions require touching structural bounding volumes within 2 mm tolerance and intersecting finite support planes. Junction extents include structure half-thickness, 15 mm cable clearance and a 30 mm bend allowance. Coplanar paths require overlapping face rectangles. Disconnected supports and unsupported endpoints give explicit failures. The router uses simplified structural surfaces. Mechanical conduit bend radii, obstacle avoidance around fixtures and construction fixing schedules require further geometry/input.

Applied routes save support identities and recompute after equipment/support edits. Cached geometry avoids repeating unchanged path searches during simulation. When support is lost, the invalid physical path is hidden, diagnostics identify the conductor, and the last validated electrical length is retained with an explicit export warning. Restoring valid geometry repairs the route. Manual bend editing or choosing a specified length clears automatic support tracking.

Copies preserve/remap used supports, and older manual routes remain valid. Seven focused routing cases, four existing geometry cases and TypeScript passed. The pitched-junction check exposed an insufficient corner allowance, which was corrected and rerun. Broad/browser verification remains deferred until the ordered sections are complete.
