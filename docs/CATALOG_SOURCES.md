# Product catalogue sources

The canonical, editable manufacturer-product database is [src/catalog-data.json](../src/catalog-data.json). Add one record per exact manufacturer model there; do not generate model rows from naming patterns or infer ratings from a product family name. [src/catalog.ts](../src/catalog.ts) provides the TypeScript types and exports that database to the app.

The catalogue retains exact manufacturer model identities while research is in progress. `verified` means the listed ratings, product colors, terminal types/positions, and applicable installation guidance have been checked against manufacturer material. `partially verified` and `reference only` entries remain browseable but cannot be applied to a simulation until their `missingData` checklist is resolved. Unknown fields stay absent; do not replace them with family-level assumptions. `sourceChecked` is the date a fully researched exact record was reviewed. Each record must link to a manufacturer source supporting its identity and any populated claims.

## Verified database contents (reviewed 2026-10-20)

The database currently has **57 exact-model records** across five kinds and seven brands: 23 verified records, 22 partially verified records, and 12 reference-only research candidates.

- 23 MPPT controllers: 15 verified and eight additional Victron SmartSolar candidates.
- Four Victron Lithium Battery Smart batteries.
- Six EPEVER Tracer AN G3 MPPT controllers.
- Two Morningstar ProStar MPPT controllers.
- One Renogy Rover Li 40A MPPT controller.
- One Blue Sea Systems 285-Series 60A circuit breaker (7184).
- 14 Victron BlueSolar photovoltaic modules, two verified and 12 additional exact panel models.
- Seven batteries: four verified Victron Lithium Battery Smart models and three additional exact candidates from Battle Born, Renogy, and Victron.
- 12 inverters/inverter-chargers: one verified Victron Phoenix model, five additional Phoenix VE.Direct variants, and six Samlex EVO models.

Coverage includes MPPT controllers, batteries, circuit protection, PV modules, and inverters from Victron Energy, EPEVER, Morningstar, Renogy, Blue Sea Systems, Battle Born Batteries, and Samlex America. The catalogue intentionally distinguishes discovered model identities from complete verified simulation profiles. Incomplete candidates show their remaining research checklist and are excluded from matching and apply actions; their missing ratings, colors, terminals, and rules are not guessed.

### Research queue added in this batch

- Eight SmartSolar MPPT 150/60 through 250/100 variants have the manufacturer family source attached; verify exact ratings, colors, terminal diagram/order, and model-specific installation guidance.
- Twelve BlueSolar panel models (20W, 30W, 40W, 55W, 90W, 115W, 130W, 140W, 150W, 185W, 305W, and 360W) are listed by exact article number and nominal power from Victron's panel datasheet. Their remaining electrical values, appearance, connector, terminal layout, and installation data remain to be confirmed at the model level.
- Battery candidates are Battle Born BB10012, Renogy RBT12100LFP-M-US, and Victron Lithium SuperPack 12.8V/100Ah. Their product identities are listed, but their missing specifications and physical details need exact-document confirmation.
- Six Samlex EVO identities (EVO-2212, EVO-2224, EVO-2212E, EVO-3012E, EVO-4024E, and EVO-0722) are recorded. Only selected EVO-2212 values are populated from the cited manual; finish, terminals, installation guidance, and the remaining model-specific values still need a full manual review.
- Five additional Phoenix VE.Direct variants (12/250, 12/375, 12/500, 12/800, and 24/1200) are tied to the manufacturer's family datasheet but remain unapplied reference records until ratings and physical details are checked.

The official Victron and Renogy manuals provide model-specific controller ratings, connection diagrams, and installation guidance.

| Model | Supported battery voltage | Nominal PV power at 12 / 24 / 48 V battery | Charge current | Max PV Voc | Max PV short-circuit current |
| --- | --- | --- | --- | --- | --- |
| SmartSolar MPPT 75/10 | 12 / 24 V | 145 / 290 W | 10 A | 75 V | 10 A |
| SmartSolar MPPT 75/15 | 12 / 24 V | 220 / 440 W | 15 A | 75 V | 15 A |
| SmartSolar MPPT 100/15 | 12 / 24 V | 220 / 440 W | 15 A | 100 V | 15 A |
| SmartSolar MPPT 100/20 | 12 / 24 / 48 V | 290 / 580 / 1160 W | 20 A | 100 V | 20 A |
| SmartSolar MPPT 100/30 | 12 / 24 V | 440 / 880 W | 30 A | 100 V | 35 A |
| SmartSolar MPPT 100/50 | 12 / 24 V | 700 / 1400 W | 50 A | 100 V | 60 A |

The manuals list 98% maximum efficiency for these controller families and identify the enclosure color as Blue (RAL 5012). The 75/10 and 75/15 load output is rated 15 A; the 100/15 and 100/20 load output is 20 A at 12/24 V, with the manual listing 1 A at 48 V for the 100/20. Each controller record also carries a color-reference image URL, terminal-layout image URL, terminal domain/role/direction, bottom-facing physical side, and left-to-right order. The 75/10–100/20 diagrams show BAT+, BAT−, PV−, PV+, LOAD−, LOAD+; the 100/30–100/50 diagrams show BAT+, BAT−, PV−, PV+.

The four Lithium Battery Smart records cover 12.8V/50Ah, 12.8V/100Ah, 12.8V/200Ah, and 25.6V/100Ah variants. Their product records include nominal voltage, capacity, lithium chemistry, maximum charge/discharge current, top-mounted M8/M10 terminals, and the shared installation rules. The Blue Sea 7184 record includes its 60A current rating, 48V DC maximum, 3000A interrupt capacity at 48V, M6 stud terminals, diagonal terminal positions from the manufacturer drawing, appearance reference, and circuit-breaker installation cautions.

The Renogy Rover Li 40A record includes its 12/24V support, 100V PV limit, 40A charging rating, 520/1040W nominal PV power at 12/24V, and six bottom-facing terminals in the manual's labeled order. The exact short-circuit input-current limit is not populated because it was not established from the cited manufacturer sources.

The EPEVER Tracer AN G3 series contributes six exact controller variants. Their rated charge currents, PV open-circuit voltage limits, and rated charging power are stored per model, not inferred from the series name. The family manual identifies six bottom terminals grouped as PV, battery, and load; the device's printed polarity labels remain authoritative. The input short-circuit current is not populated where the cited data does not establish it.

| EPEVER model | Charge current | Max PV Voc | Rated charging power at 12 / 24 V |
| --- | --- | --- | --- |
| Tracer1206AN G3 | 10 A | 60 V | 130 / 260 W |
| Tracer2206AN G3 | 20 A | 60 V | 260 / 520 W |
| Tracer1210AN G3 | 10 A | 100 V | 130 / 260 W |
| Tracer2210AN G3 | 20 A | 100 V | 260 / 520 W |
| Tracer3210AN G3 | 30 A | 100 V | 390 / 780 W |
| Tracer4210AN G3 | 40 A | 100 V | 520 / 1040 W |

The two BlueSolar records are SPM041751200 (175W, 12V nominal) and SPM042151200 (215W, 24V nominal). Each has the manufacturer's STC power, Vmp, Imp, Voc, Isc, and MC4-compatible connector specification. The Phoenix Inverter 12/1200 record represents the 12V DC, 230V AC/50Hz model, with 1000W continuous output and 2200W surge rating. Product appearance, port types, and the simulator-facing terminal positions are referenced to Victron's product datasheets.

## Official source documents

- [SmartSolar MPPT 75/10–100/20 technical specifications](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/technical-specifications.html)
- [SmartSolar MPPT 75/10–100/20 installation instructions](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/installation.html)
- [SmartSolar MPPT 75/10–100/20 terminal diagram](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/image/img-41f4927cc5d1a7b8a41d6b89b54a6e43.png)
- [SmartSolar MPPT 100/30–100/50 technical specifications](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/technical-specifications.html)
- [SmartSolar MPPT 100/30–100/50 installation instructions](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/installation.html)
- [SmartSolar MPPT 100/30–100/50 terminal diagram](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/image/img-f63ee0e94a46e80537f4699dd497ec05.png)
- [Lithium Battery Smart technical data](https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/technical-data.html)
- [Lithium Battery Smart installation instructions](https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/installation.html)
- [Renogy Rover Li controller product specifications](https://www.renogy.com/products/rover-li-40-amp-mppt-solar-charge-controller)
- [Renogy Rover Li 20/30/40A manual](https://cdn.shopify.com/s/files/1/0631/0137/0483/files/UM_Rover_20Li_20Series_2020A_2630A_2640A_G2.pdf?v=1752029603)
- [EPEVER Tracer AN G3 datasheet](https://www.epever.com/wp-content/uploads/2024/08/EPEVER-DataSheet-Tracer-AN-G31.pdf)
- [EPEVER Tracer AN G3 manual](https://www.epever.com/wp-content/uploads/2024/08/Tracer-AN-G3-Manual-EN-V2.4.pdf)
- [Victron BlueSolar monocrystalline panel datasheet](https://www.victronenergy.com/upload/documents/Datasheet-BlueSolar-Monocrystalline-Panels-EN.pdf)
- [Victron Phoenix VE.Direct inverter datasheet](https://www.victronenergy.com/upload/documents/Datasheet-Inverter-VE.Direct-250VA-1600VA-EN.pdf)
- [Victron SmartSolar MPPT 150/60 through 250/100 product family](https://www.victronenergy.com/solar-charge-controllers/smartsolar-250-85-250-100)
- [Samlex EVO-series manual](https://samlexamerica.com/wp-content/uploads/2020/01/11025-EVO-2212E-3012E-2224E-4024E-0722_Lrez.pdf)
- [Battle Born BB10012 datasheet](https://cdn.shopify.com/s/files/1/0981/3924/2777/files/BB10012_Data_Sheet.pdf?v=1786988701)
- [Renogy Core Mini 12V 100Ah battery listing](https://www.renogy.com/12v-100ah-core-mini-lithium-iron-phosphate-battery/)
- [Victron Lithium SuperPack product family](https://www.victronenergy.com/batteries/lithium-superpack)
- [Blue Sea Systems 285-Series 60A breaker specifications](https://www.bluesea.com/products/7184/285-Series_Circuit_Breaker_-_Surface_Mount_60A)
- [Blue Sea Systems 285-Series dimensioned drawing](https://d2pyqm2yd3fw2i.cloudfront.net/files/resources/dimensioned_drawing/285-Surface.jpg)
- [Blue Sea Systems 7184 product appearance](https://dh778tpvmt77t.cloudfront.net/images/products/7184.jpg)

## Installation guidance captured

The Victron controller rule sets are kept distinct because their terminal torque and layouts differ. EPEVER, BlueSolar, Phoenix inverter, Renogy, battery, and circuit-breaker rules use separate model-family guidance.

- 75/10–100/20: vertical mounting on a non-flammable surface with terminals down, 100 mm clearance above and below, within 3 m of but not directly above the battery, battery-supply fuse per the exact manual table, model-specific PV voltage constraints, battery-first connection sequence, 0.75 N·m terminal torque, flexible multi-stranded copper, and manual-specific isolation/ground-fault caveats.
- 100/30–100/50: the same manual-backed mounting, clearance, battery placement, fuse, PV sizing, connection-order and ground-fault caveats, with 1.6 N·m terminal torque.
- EPEVER Tracer AN G3: retain the model-specific 60 V or 100 V PV voltage limit, use the six labeled bottom terminals, and follow the manual for external fast-acting protection, isolation, and installation environment.
- BlueSolar modules: retain the datasheet's 1000 V maximum system voltage and use compatible PV-ST01 / MC4-type connectors.
- Phoenix Inverter VE.Direct: keep the model's DC voltage and regional AC output/frequency distinction explicit; use the model-specific manual for installation and protection design.

The Blue Sea 285-Series guidance records surface mounting, terminal hardware torque, and the manufacturer's warning not to use the breaker as a switch where high inrush current is expected.

These are manufacturer instructions, not a complete installation design or a substitute for local requirements. Fuse values are deliberately not generalized: consult the exact model's manual table. Cold-weather PV open-circuit voltage and the applicable array disconnection/grounding rules must be considered by a qualified installer.

## Data-quality boundary

Earlier generated names and generic example profiles without manufacturer evidence were removed. Current non-verified rows are different: each is an exact product identity linked to a manufacturer source, explicitly marked as in progress/reference only, and paired with a checklist of unknowns. They are not presented as verified products or complete simulation profiles.

User-created custom records continue to be stored separately in local browser storage by `src/customCatalogue.ts`; they are not manufacturer-verified products and are not mixed into `src/catalog-data.json`. The JSON file is the single source of truth for sourced manufacturer models. It has a schema version, review date, rule sets, and product records to make adding a sourced model straightforward.
