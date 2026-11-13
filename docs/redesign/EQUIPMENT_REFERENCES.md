# Equipment geometry source register

Research date: 12 November 2026. These references are inputs for subsequent geometry work. They have not yet been applied to the 3D equipment catalogue. Exact variant and revision matching is required; aggregate electrical blocks must not be rendered as if they were a single physical unit.

- JA Solar JAM72S30-550/MR/1500V, 35 mm frame variant: manufacturer datasheet lists 2278 x 1134 x 35 mm. The later 30 mm frame variant is a different reference. Source: https://www.jasolar.com/uploadfile/2023/0525/20230525053534178.pdf
- Victron SmartSolar 150/100-Tr VE.Can: technical specification table, 216 mm high x 295 mm wide x 103 mm deep. The MC4 version is taller and must not share the same body dimensions. Source: https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html
- Victron MultiPlus-II 48/5000/70-50 230V, PMP482505010, drawing revision 01 (till HQ2320): use this exact drawing for dimensions and mounting rather than assuming the present product page describes that revision. Source: https://www.victronenergy.com/upload/documents/MultiPlus-II-48V-5000VA-230V-PMP48250510-till-HQ2320.pdf

Manufacturer manuals/drawings provide dimensions and operating data; they are not an open-source asset license. Create procedural geometry from documented measurements, keep source attribution, and verify redistribution permission before bundling manufacturer CAD/textures. Battery and charger variants still need matching primary references.

## Applied profiles - 12 November 2026

Seventeen profiles are now implemented in src/workbench/profiles.ts: BlueSolar SPM041751200 and SPM042152402; SmartSolar 75/10, 75/15, 100/15, 100/20, 100/30 and 100/50; Lithium Battery Smart 12.8 V 50/100/160/180/200/330 Ah and 25.6 V 100/200 Ah (200-a enclosure reference); Phoenix 12/1200 VE.Direct 230 V. Dimensions are stored as W/H/D in metres. Body appearance and connector anchor positions are procedural approximations, explicitly labelled in the interface.

Sources:
- Small SmartSolar specifications and drawings: https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/technical-specifications.html
- SmartSolar 100/30 and 100/50: https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/technical-specifications.html
- Battery dimensions and variants: https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/technical-data.html
- Panel article-number table: https://www.victronenergy.com/upload/documents/Datasheet-BlueSolar-Monocrystalline-Panels-EN.pdf
- Phoenix table, page 2, specifically the 12 V variant (117 H x 232 W x 362 D mm): https://www.victronenergy.com/upload/documents/Datasheet-Inverter-VE.Direct-250VA-1600VA-EN.pdf

The earlier JA Solar, SmartSolar 150/100 and MultiPlus references remain research inputs, not applied models. Charger dimensions are researched at https://www.victronenergy.com/media/pg/Blue_Smart_IP22_Charger_230V_manual/en/technical-specifications---bsc---psc.html ; a working charger model still needs implementation before enabling that product in the sandbox.

Generic charger enclosure profile: Blue Smart IP22 230 V single-output family envelope, 235 H x 108 W x 65 D mm, per the manufacturer technical-specification table checked 12 November 2026. The profile supplies geometry only and does not promote any incomplete catalogue SKU or imply its charging firmware is modelled. Source: https://www.victronenergy.com/media/pg/Blue_Smart_IP22_Charger_230V_manual/en/technical-specifications---bsc---psc.html .
