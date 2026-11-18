import type {Project} from './model'
import type {LearnScenarioDefinition,LearnScenarioEvaluation} from './learn'

export function LearnPanel({project,scenario,progress}:{project:Project;scenario:LearnScenarioDefinition;progress:LearnScenarioEvaluation}) {
  const repair=(project.learn?.task??scenario.task)==='repair'
  const remaining=progress.checklist.filter(item=>!item.passed)
  const sample=project.learn?.sample??{}
  return <section className="learn-panel" aria-label="Training task">
    <details key={project.learn?.runId} open>
      <summary><span>{repair?'Repair':'Build'} / {scenario.title}</span><small>{progress.allPassed?'All tasks passed':`${progress.checklist.length-remaining.length}/${progress.checklist.length} tasks passed`}</small></summary>
      <div className="learn-checklist" tabIndex={0} aria-label="Scenario brief and checks">
        <p><strong>{scenario.client}</strong> / {scenario.difficulty==='Ready'?'Intermediate':scenario.difficulty}</p>
        <p>{repair?'The client reports that the supplied system has stopped working after maintenance. Find and repair its faults, then prove that it powers the client load.':'The client load and site conditions are provided. Select, size and wire the supply equipment to meet the brief.'}</p>
        <p>{scenario.summary}</p>
        <dl className="learn-targets">{Object.entries(sample).map(([key,value])=><div key={key}><dt>{({sun:'Sunlight (%)',ambient:'Ambient (C)',loadWatts:'Client load (W)',pvWatts:'Array target (W)',soc:'Initial reserve (%)',mpptWatts:'Controller target (W)',batteryAh:'Battery capacity (Ah)',chargeVoltage:'Charging target (V)',inverterWatts:'Inverter target (W)',sourceVoltage:'Source voltage (V)',frequency:'Frequency (Hz)'} as Record<string,string>)[key]??key.replace(/([A-Z])/g,' $1')}</dt><dd>{value.toFixed(1)}</dd></div>)}</dl>
        <details className="training-hint"><summary>Show a hint</summary><p>{repair?'Check the inverter switch, follow both conductors from inverter to load, and compare the controller capacity with the array rating.':'Add a battery, solar array, controller and inverter. Match the DC voltage and connect both outgoing and return conductors to the supplied client load. The sunlight, temperature and client demand stay fixed during training.'}</p></details>
        {remaining[0]&&<p className="training-next"><strong>Next task</strong> / {remaining[0].label}</p>}
        {progress.checklist.map(item=><div key={item.id} className={`learn-item ${item.passed?'pass':''}`}><span className="training-check" aria-label={item.passed?'Passed':'To do'}>{item.passed?'✓':'○'}</span><span><strong>{item.label}</strong><small>{item.evidence}</small></span></div>)}
        {progress.allPassed&&<p role="status">All checks passed. Your system is working.</p>}
      </div>
    </details>
  </section>
}
