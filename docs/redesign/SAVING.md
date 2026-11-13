# Saving and retrieving projects

WiSim automatically saves edited projects in this browser. Use **Save** in the header or **Ctrl+S** (Command+S on Mac) to create an explicit saved version as well. The latest 20 saved versions of each project are retained; autosaving updates the current working project without filling that version list.

Click the **WiSim logo** or **Projects and examples** in the left rail. **Your saved projects** lists named projects with device/conductor counts and their last saved time.

- **Open** retrieves a project. Switching projects first archives the current project and keeps a checkpoint.
- **Previous versions** shows explicit saves and checkpoints. **Restore** first saves the current work, then loads the chosen settings. The newer work remains available as another checkpoint.
- **Save a copy** creates a separate project with a new identity and the chosen name. Editing the copy does not change the original.
- **Download JSON** saves an editable backup of that project. **Export → Editable project** downloads the current working project. **Import project** opens a downloaded backup.

If an imported file or restored version has the identity of another project already in your library, WiSim also checkpoints that project's newer saved copy before replacing it.

The original single-project working copy is preserved and automatically enters the library. A newer library save is recovered if the startup cache could not be updated. Storage failures produce a visible message and a **Download current project** action; opening another project is blocked if the current work could not be archived.

Projects include equipment, connections, ratings, schematic placement, 3D placement/routes, structures, mounting and site settings. Restoring starts simulation from the project's initial settings; live waveform history and an in-progress solver state are not saved versions.

The library uses IndexedDB in the same browser/profile and site address. It is local storage, without account/cloud sync. Clearing site data removes it. Download JSON backups to keep projects outside the browser or move them to another device/address. Legacy-app files use a different schema and still require a migration path; current imports accept WiSim v4 projects.
