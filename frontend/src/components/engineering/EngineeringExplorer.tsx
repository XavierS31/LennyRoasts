import { useEffect, useMemo, useState, type RefObject } from "react";
import type { Challenge, EvaluationJob } from "../../api/client";
import EngineeringScene, { type CameraCommand, type SceneController } from "./EngineeringScene";
import type { LocationState } from "./navigation";
import AtriumMap from "./AtriumMap";
import { agentRoster, agentStation, appearanceForProject } from "./agentRoster";
import { projectStation } from "./atriumLayout";
import type { AgentEntry } from "./agentMeshes";
type SampleInput = { project_id: string; name: string; input: string };
import CameraMenu from "./CameraMenu";
import { sponsorRoom, isSponsorRoom, type SponsorRoomId } from "./classroomLayout";
import { ArrowLeftIcon, DoorOpenIcon, MicrophoneIcon } from "@phosphor-icons/react";

export default function EngineeringExplorer({ job, challenges, projectName, category, onCategory, panelsVisible, isStale, location, onBuilding, controller, onSponsor, onReturnAtrium, onPitch, onViewReport }: {
  job: EvaluationJob | null;
  challenges: Challenge[];
  projectName: string;
  category: string;
  onCategory: (id: string) => void;
  panelsVisible: boolean;
  isStale: boolean;
  location: LocationState;
  onBuilding: (building: LocationState["building"]) => void;
  controller: RefObject<SceneController | null>;
  onSponsor: (id: SponsorRoomId) => void;
  onReturnAtrium: () => void;
  onPitch: () => void;
  onViewReport: () => void;
}) {
  const [marker, setMarker] = useState("user");
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [showSamples, setShowSamples] = useState(true);
  const [samples, setSamples] = useState<SampleInput[]>([]);
  const [sampleError, setSampleError] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const room = sponsorRoom(location.sponsor);
  const roomResult = job?.status === "completed" ? job.result?.challenge_results.find((entry) => entry.challenge_id === room.id) : undefined;
  const results = location.kind === "atrium" && job?.status === "completed" ? job.result?.challenge_results ?? [] : [];
  const result = results.find((entry) => entry.challenge_id === category) ?? results.find((entry) => entry.challenge_id === "overall") ?? results[0];
  const rival = result?.rivals.find((entry) => entry.project_id === marker);
  const selectedName = rival?.name ?? projectName;
  const selectedScore = rival?.score_10 ?? result?.score_10;
  const sample = samples.find((entry) => `sample:${entry.project_id}` === marker);
  const sampleIndex = sample ? samples.indexOf(sample) : 0;
  const liveReport = Boolean(result && job && !job.judge_version.startsWith("mock-") && !job.judge_version.startsWith("fixture-"));
  const previewActive = showSamples && !liveReport;
  const agents = useMemo<AgentEntry[]>(() => {
    if (location.kind !== "atrium") return [];
    const user = result ? [{ key: "user", appearance: appearanceForProject("your-idea-avatar"), position: [-3, 28] as [number, number] }] : [];
    if (previewActive) return [...samples.map((entry, index) => ({ key: `sample:${entry.project_id}`, appearance: appearanceForProject(entry.project_id), position: agentStation(index) })), ...user];
    if (!result) return [];
    const count = Math.min(200, Math.max(result.rivals.length, result.placement?.eligible_competitors ?? 0));
    return [...Array.from({ length: count }, (_, index) => {
      const returned = result.rivals[index];
      const station = returned ? projectStation(index + 1) : agentStation(index);
      const position: [number, number] = returned ? [station[0] + 3, station[1]] : station;
      return { key: returned?.project_id ?? `anonymous:${index}`, appearance: returned ? appearanceForProject(returned.project_id) : agentRoster[index], position };
    }), ...user];
  }, [location.kind, previewActive, samples, result]);

  useEffect(() => { setMarker("user"); setAgentExpanded(false); }, [result, previewActive]);
  useEffect(() => {
    if (location.kind !== "atrium" || !previewActive) return;
    let cancelled = false;
    void import("./agentInputs.json").then((module) => {
      if (!cancelled) { setSamples(module.default.agents); setSampleError(false); }
    }).catch(() => { if (!cancelled) setSampleError(true); });
    return () => { cancelled = true; };
  }, [location.kind, previewActive]);
  useEffect(() => { setResultsExpanded(false); }, [location.kind]);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 900px)");
    const resize = () => { if (narrow.matches) setResultsExpanded(false); };
    narrow.addEventListener("change", resize);
    return () => narrow.removeEventListener("change", resize);
  }, []);

  function camera(action: CameraCommand) { void controller.current?.command(action); }
  function selectProject(id: string) { setMarker(id); void controller.current?.command("focus", id); }
  function selectAgent(id: string) { setMarker(id); if (id.startsWith("sample:") || id.startsWith("anonymous:")) setAgentExpanded(true); }
  function visitSample(index: number) {
    const entry = samples[(index + samples.length) % samples.length];
    if (entry) { selectProject(`sample:${entry.project_id}`); setAgentExpanded(true); }
  }

  return <div className={`engineering-explorer scene-${location.kind} ${panelsVisible ? "with-panels" : "without-panels"}`}>
    <EngineeringScene kind={location.kind} result={result} projectName={projectName} selectedMarker={marker} panelsVisible={panelsVisible} agents={agents}
      sponsor={location.sponsor} onSponsor={onSponsor} onReturnAtrium={onReturnAtrium} onPitch={onPitch}
      controller={controller} onSelectMarker={selectAgent} onHoverBuilding={() => {}}
      onSelectBuilding={(building) => onBuilding(building === "Engineering I" ? "Engineering I" : "Engineering II")} />
    <CameraMenu key={location.kind} kind={location.kind} onCamera={camera}
      onSponsor={(id) => { if (isSponsorRoom(id)) onSponsor(id); }} />
    {location.kind === "atrium" && <div className="atrium-tools">
    <AtriumMap projectNames={result ? [projectName, ...result.rivals.map((entry) => entry.name)] : []} />
    <aside className="agent-inspector glass-panel" aria-label="AI agent inputs">
      <button className="agent-inspector-toggle" type="button" aria-expanded={agentExpanded} aria-controls="agent-input-content" onClick={() => setAgentExpanded((value) => !value)}>
        {previewActive ? `${samples.length || "Loading"} sample agents` : `${agents.filter((agent) => agent.key !== "user").length} field representatives`} · {agentExpanded ? "Close inputs" : "Explore inputs"}
      </button>
      <div id="agent-input-content" hidden={!agentExpanded}>
        {!liveReport && <label className="agent-preview-toggle"><input type="checkbox" checked={showSamples} onChange={(event) => setShowSamples(event.target.checked)} />Show saved synthetic sample agents</label>}
        {previewActive ? <>
          <p className="agent-source">Synthetic practice inputs · no live agent activity or judge results.</p>
          {sampleError ? <p role="status">Sample inputs could not load. Reload to try again; your report is still available.</p> : <>
            <label htmlFor="agent-input-choice">Choose an agent</label>
            <select id="agent-input-choice" value={sample?.project_id ?? ""} onChange={(event) => { selectProject(`sample:${event.target.value}`); setAgentExpanded(true); }}>
              <option value="" disabled>{samples.length ? "Select a saved project" : "Loading saved inputs…"}</option>
              {samples.map((entry, index) => <option key={entry.project_id} value={entry.project_id}>{String(index + 1).padStart(3, "0")} · {entry.name}</option>)}
            </select>
            <div className="agent-input-navigation">
              <button type="button" disabled={!samples.length} onClick={() => visitSample(sampleIndex - 1)}>Previous agent</button>
              <button type="button" disabled={!samples.length} onClick={() => visitSample(sample ? sampleIndex + 1 : 0)}>Next agent</button>
            </div>
            {sample ? <><h2>{sample.name}</h2><p className="agent-input-text">{sample.input}</p><small>Saved input {sampleIndex + 1} of {samples.length} · {sample.project_id}</small></> : <p>Select a floating mesh or choose an agent to read its distinct project input.</p>}
          </>}
        </> : <p>The API supplies up to three rival summaries. Select a returned rival in the report to read its summary. Other meshes represent the returned field count; their inputs are unavailable through the current API.</p>}
      </div>
    </aside>
    </div>}
    {location.kind === "classroom" && <>
      {!panelsVisible && <aside className="classroom-caption glass-panel" aria-label="Sponsor classroom" style={{ "--sponsor-color": room.color } as React.CSSProperties}>
        <button type="button" className="classroom-back" onClick={onReturnAtrium}><ArrowLeftIcon size={17} aria-hidden="true" />Atrium</button>
        <h1>{room.name} classroom</h1>
        <p>Lenny is ready for your product pitch.</p>
      </aside>}
      <div className="classroom-actions glass-panel" role="group" aria-label="Classroom actions">
        <button type="button" onClick={onReturnAtrium}><DoorOpenIcon size={20} aria-hidden="true" />Exit to atrium</button>
        <button type="button" className="classroom-pitch" onClick={onPitch}><MicrophoneIcon size={20} aria-hidden="true" />Pitch to Lenny</button>
      </div>
      {roomResult && !panelsVisible && <aside className="classroom-feedback glass-panel" aria-label="Sponsor pitch result">
        <p>{roomResult.score_10.toFixed(1)} / 10 · {roomResult.eligible ? "Eligible" : "Ineligible"}</p>
        <small>{job?.judge_version.startsWith("mock-") ? "Development mock · practice only" : job?.judge_version.startsWith("fixture-") || job?.pool_version.startsWith("fixture-") ? "Synthetic fixture · practice only" : "Simulated field · practice only"}{isStale ? " · Last submitted pitch" : ""}</small>
        <button type="button" onClick={onViewReport}>View practice report</button>
      </aside>}
    </>}
    {location.kind === "awards" && <aside className="ballroom-caption glass-panel" aria-label="Award ceremony room">
      <h1>Cape Ballroom</h1>
    </aside>}
    {result && <section className="scene-results glass-panel" aria-label="API results in the scene">
      <button type="button" className="results-toggle" aria-expanded={resultsExpanded} aria-controls="scene-result-content" onClick={() => setResultsExpanded((value) => !value)}>
        {challenges.find((challenge) => challenge.id === result.challenge_id)?.name ?? result.challenge_id} · {result.score_10.toFixed(1)} / 10 · {resultsExpanded ? "Collapse" : "Details"}
      </button>
      <div id="scene-result-content" hidden={!resultsExpanded}>
      <p className="section-kicker">PRIVATE PRACTICE RESULTS · FROM THE API</p>
      <p className="scene-mode">{job?.judge_version.startsWith("mock-") ? "Development mock · not live judge results" : job?.judge_version.startsWith("fixture-") || job?.pool_version.startsWith("fixture-") ? "Synthetic fixture · not live judge results" : "Simulated field · practice only"}</p>
      {isStale && <p className="stale-report-note">The form has changed. These results belong to the last submitted idea.</p>}
      <label htmlFor="scene-category">Category</label>
      <select id="scene-category" value={result.challenge_id} onChange={(event) => onCategory(event.target.value)}>
        {results.map((entry) => <option key={entry.challenge_id} value={entry.challenge_id}>{challenges.find((challenge) => challenge.id === entry.challenge_id)?.name ?? entry.challenge_id}</option>)}
      </select>
      <div className="marker-selector" role="group" aria-label="Select result marker">
        <button type="button" aria-pressed={!rival} onClick={() => selectProject("user")}>Your idea</button>
        {result.rivals.map((entry) => <button type="button" key={entry.project_id} aria-pressed={marker === entry.project_id} onClick={() => selectProject(entry.project_id)}>{entry.name}</button>)}
      </div>
      <h2>{selectedName}</h2><p className="scene-score">{selectedScore?.toFixed(1)} <span>/ 10</span></p>
      {rival ? <p>{rival.summary}</p> : <>
        <p>{result.eligible ? "Eligible" : "Ineligible"} · {result.placement ? `Practice placement ${result.placement.best_rank}–${result.placement.worst_rank} of ${result.placement.field_size_including_user}` : "No placement returned"}</p>
        <p>{result.placement ? `${result.placement.eligible_competitors} eligible competitors. ${previewActive ? "The sample crowd shows all 200 saved synthetic inputs, including projects outside this category." : "The crowd represents the returned field count, capped at 200; only returned rivals have named identities."}` : "No field population is inferred."}</p>
      </>}
      <small>Gold table: your idea · blue tables: returned rivals. Select a project to visit its table. Marker height shows API score. {job?.judge_version}</small>
      <h3>Competition scores</h3>
      <p>The API returns these nearby rivals, not the full field or their ranks.</p>
      <ol className="competition-scores" aria-label="Returned rivals by score">
        {[...result.rivals].sort((a, b) => b.score_10 - a.score_10).map((entry) => <li key={entry.project_id}>
          <button type="button" aria-pressed={marker === entry.project_id} onClick={() => selectProject(entry.project_id)}>{entry.name} <strong>{entry.score_10.toFixed(1)} / 10</strong></button>
        </li>)}
      </ol>
      </div>
    </section>}
  </div>;
}
