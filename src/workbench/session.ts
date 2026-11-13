import { emptyState, type Project, type RuntimeState } from './model'

/** A run belongs to one project and one set of initial conditions. */
export class SimulationSession {
  private projectId: string | null = null
  private initialSoc: number | null = null
  state: RuntimeState = emptyState()

  prepare(project: Project): RuntimeState {
    if (project.id !== this.projectId || project.initialSoc !== this.initialSoc || !project.devices.length) {
      this.state = emptyState()
    }
    this.projectId = project.id
    this.initialSoc = project.initialSoc
    return this.state
  }

  reset() {
    this.projectId = null
    this.initialSoc = null
    this.state = emptyState()
  }
}
