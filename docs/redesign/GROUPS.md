# Compact arrays and battery banks

Groups are saved schematic metadata over real equipment. They never replace individual devices in the electrical solver, physical workbench, catalogue, equipment schedule or exported wiring details. Old v4 projects without groups remain supported.

The default designer now contains 24 real devices and 31 conductors, presented as six schematic items: the array, controller, bank, main protection, inverter and load. Each group exposes its real external terminals. An unwired source terminal remains available; grouping does not create an electrical connection.

Select an array/bank or its button near the top of the diagram to:

- Rename, expand or collapse it. Expansion arranges visible equipment using the existing ELK layout dependency with actual terminal sides. Layout and group movement retain physical positions and measured cable lengths.
- Inspect a real unit, extract selected equipment, or ungroup everything while retaining all wiring. Existing ungrouped panels/batteries can be added to the presentation independently of their connections.
- Add a matching parallel branch after confirming the review warning. A generated PV branch copies both series panels and its fuse; a battery branch copies its pack and protection. New wire endpoints attach to the existing collectors. Complex branches without exactly two collector connections require explicit wiring instead.
- Copy/download the real subset, paste independent equipment into another project, or delete after confirmation. Keyboard Delete opens the same confirmation. Undo restores changes.

Multi-select two or more panels or batteries (optionally their fuses, isolators and busbars) to create a compact group. A device belongs to at most one group; mixed panel/battery/converter groups are rejected. Partial copies omit incomplete group metadata. Full-group copies remap member and group identities. Deleting members prunes invalid empty group metadata.

The wiring description follows conductor connections and protection/busbar paths to identify uniform series/parallel branches. Separate or complex networks are labelled for inspection. This describes installed wiring, including open/tripped protection; it does not assert that a branch is conducting or that a product permits that arrangement.

Live source power sums the solved readings from actual panels/packs. Battery charging remains negative. The voltage range is explicitly **per unit**, not a series-string or bank-terminal voltage. Currents through series panels are not summed. Source power is before internal cable/fuse losses; individual losses remain visible after expansion and in conductor settings. Missing unit data stays unknown instead of becoming zero. Boundary/net-power and per-string current summaries remain further work.

Collapsed equipment and internal-wire faults map to the visible group marker and warning leader. The diagnostics panel retains every original finding and repair target. Locate reveals the real equipment when applicable. A named group never exempts equipment from electrical checks.

Controlled schematic nodes retain their measured dimensions across live-reading updates. Terminal measurements refresh when a port layout changes; drawing a new simulation frame must not clear conductor paths. The production group browser check verifies all nine visible conductors after continuing frames, all 25 when the PV group expands, and nine again after collapse and dragging.

Adding branches is a sandbox edit: protection, branch balance, cable sizing, collector/controller limits, permitted parallel operation and mounting space still need review. It does not rerun the designer or establish installation compliance. New branches have measured physical lengths; supported surface auto-routing remains separate unfinished work.
# Designer quantity update, 17 November 2026

The sourced default design now contains 23 real devices and 29 conductors, presented as eight items. Its PV group has six 550 W modules in three two-module strings. Larger proposals can have separate PV groups per independent MPPT. Older saved groups retain their original units and topology. Focused group/layout/export checks pass for the changed designer output.
