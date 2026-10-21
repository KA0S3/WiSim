export type DiagnosticExplanation = { why: string; boundary: string }

/** Turn project-model notes into issue-specific learning context. */
export function explainModelBoundaryWarning(evidence: string): DiagnosticExplanation {
  const warning = evidence.toLowerCase()
  if (warning.includes('control/data link')) return {
    why: 'This connection represents a signal or communication path. Treating it as an energy path would make the modeled topology misleading.',
    boundary: 'WiSim checks the represented connection but does not simulate protocols or calculate power flow on data/control links.',
  }
  if (warning.includes('sink terminals') || warning.includes('source terminals')) return {
    why: 'The terminal direction labels indicate expected source and sink roles. A same-role pair may not match the intended learning circuit.',
    boundary: 'These labels are model hints; WiSim does not solve directional current flow or infer the intended device behavior.',
  }
  if (warning.includes('behind an open protection or transfer device')) return {
    why: 'The conductor remains in the project, but an open fuse or transfer switch interrupts this represented path.',
    boundary: 'The open state is a simplified learner-controlled model and does not reproduce physical contact or protection behavior.',
  }
  if (warning.includes('display')) return {
    why: 'A saved display tag is not recognized by the current editor, so its appearance may differ from what the project author intended.',
    boundary: 'Terminal domains determine modeled electrical compatibility; wire color and display-domain tags do not change the connection physics.',
  }
  return {
    why: 'This note identifies a connection detail that may differ from the intended learning example.',
    boundary: 'The solver reports the represented model state and does not infer undocumented device behavior.',
  }
}
