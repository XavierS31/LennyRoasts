import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import { ArrowLeftIcon, DoorOpenIcon, MicrophoneIcon, TrophyIcon, PlayIcon, PauseIcon } from "@phosphor-icons/react";
import { ceremonyCategories, ceremonyLeaders, confirmedTopThree } from "./ceremonyResults";

export default function EngineeringExplorer({ job, challenges, projectName, category, onCategory, panelsVisible, isStale, location, onBuilding, controller, onSponsor, onReturnAtrium, onPitch, onViewReport, ceremonyRun }: {
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
  ceremonyRun: number;
}) {
  const [marker, setMarker] = useState("user");
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [showSamples, setShowSamples] = useState(true);
  const [samples, setSamples] = useState<SampleInput[]>([]);
  const [sampleError, setSampleError] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [ceremonyIndex, setCeremonyIndex] = useState(0);
  const [ceremonyPlaying, setCeremonyPlaying] = useState(false);
  const [leaderIndex, setLeaderIndex] = useState(0);
  const [prizePhase, setPrizePhase] = useState("ready");
  const prizeToken = useRef(0);
  const activePresenter = useRef("");
  const room = sponsorRoom(location.sponsor);
  const roomResult = job?.status === "completed" ? job.result?.challenge_results.find((entry) => entry.challenge_id === room.id) : undefined;
  const results = job?.status === "completed" ? job.result?.challenge_results ?? [] : [];
  const result = results.find((entry) => entry.challenge_id === category) ?? results.find((entry) => entry.challenge_id === "overall") ?? results[0];
  const rival = result?.rivals.find((entry) => entry.project_id === marker);
  const selectedName = rival?.name ?? projectName;
  const selectedScore = rival?.score_10 ?? result?.score_10;
  const sample = samples.find((entry) => `sample:${entry.project_id}` === marker);
  const sampleIndex = sample ? samples.indexOf(sample) : 0;
  const previewActive = showSamples && results.length === 0;
  const agents = useMemo<AgentEntry[]>(() => {
    if (location.kind !== "atrium" && location.kind !== "awards") return [];
    const user = result && location.kind === "atrium" ? [{ key: "user", appearance: appearanceForProject("your-idea-avatar"), position: [-3, 28] as [number, number] }] : [];
    if (previewActive) return [...samples.map((entry, index) => ({ key: `sample:${entry.project_id}`, appearance: appearanceForProject(entry.project_id), position: agentStation(index) })), ...user];
    if (!result) return [];
    if (location.kind === "awards") {
      const returned = [...new Map(results.flatMap((entry) => entry.rivals).map((entry) => [entry.project_id, entry])).values()];
      const overall = results.find((entry) => entry.challenge_id === "overall");
      const count = Math.min(200, Math.max(returned.length, overall?.placement?.eligible_competitors ?? result.placement?.eligible_competitors ?? 0));
      return Array.from({ length: count }, (_, index) => ({ key: returned[index]?.project_id ?? `anonymous:${index}`, appearance: returned[index] ? appearanceForProject(returned[index].project_id) : agentRoster[index], position: agentStation(index) }));
    }
    const count = Math.min(200, Math.max(result.rivals.length, result.placement?.eligible_competitors ?? 0));
    return [...Array.from({ length: count }, (_, index) => {
      const returned = result.rivals[index];
      const station = returned ? projectStation(index + 1) : agentStation(index);
      const position: [number, number] = returned ? [station[0] + 3, station[1]] : station;
      return { key: returned?.project_id ?? `anonymous:${index}`, appearance: returned ? appearanceForProject(returned.project_id) : agentRoster[index], position };
    }), ...user];
  }, [location.kind, previewActive, samples, result, job]);

  useEffect(() => { setMarker("user"); setAgentExpanded(false); }, [result, previewActive]);
  useEffect(() => {
    if ((location.kind !== "atrium" && location.kind !== "awards") || !previewActive) return;
    let cancelled = false;
    void import("./agentInputs.json").then((module) => {
      if (!cancelled) { setSamples(module.default.agents); setSampleError(false); }
    }).catch(() => { if (!cancelled) setSampleError(true); });
    return () => { cancelled = true; };
  }, [location.kind, previewActive]);
  useEffect(() => {
    prizeToken.current++; activePresenter.current = ""; setPrizePhase("ready"); setCeremonyIndex(0); setLeaderIndex(0);
    setCeremonyPlaying(location.kind === "awards" && ceremonyRun > 0);
  }, [location.kind, ceremonyRun]);
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
  async function previewPrize() {
    const token = ++prizeToken.current;
    setCeremonyPlaying(false); activePresenter.current = "";
    setPrizePhase("moving");
    await new Promise<void>((done) => window.requestAnimationFrame(() => done()));
    await controller.current?.command("award");
    if (prizeToken.current === token) setPrizePhase("collected");
  }
  const ceremony = ceremonyCategories[ceremonyIndex];
  const ceremonyResult = results.find((entry) => entry.challenge_id === ceremony.id);
  const leaders = ceremonyLeaders(ceremonyResult);
  const presenting = leaders[leaderIndex];
  const showingUser = !presenting && confirmedTopThree(ceremonyResult);
  useEffect(() => {
    if (location.kind !== "awards" || !ceremonyPlaying || !agents.length) return;
    let cancelled = false;
    let timer = 0;
    function advance() {
      if (cancelled) return;
      const steps = leaders.length + (confirmedTopThree(ceremonyResult) ? 1 : 0);
      if (leaderIndex + 1 < steps) setLeaderIndex((index) => index + 1);
      else if (ceremonyIndex < ceremonyCategories.length - 1) { setLeaderIndex(0); setCeremonyIndex((index) => index + 1); }
      else setCeremonyPlaying(false);
    }
    if (presenting) {
      const frame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        const identity = `${ceremony.id}:${presenting.project_id}`;
        const action = activePresenter.current === identity ? "resumeAward" : "award";
        activePresenter.current = identity;
        void controller.current?.command(action).then(() => {
          if (!cancelled) timer = window.setTimeout(advance, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 3500 : 1000);
        });
      });
      return () => { cancelled = true; window.cancelAnimationFrame(frame); window.clearTimeout(timer); void controller.current?.command("pauseAward"); };
    }
    timer = window.setTimeout(advance, 4500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [location.kind, ceremonyPlaying, ceremonyIndex, leaderIndex, agents, ceremonyResult, controller]);

  return <div className={`engineering-explorer scene-${location.kind} ${panelsVisible ? "with-panels" : "without-panels"}`}>
    <EngineeringScene kind={location.kind} result={result} projectName={projectName} selectedMarker={marker} panelsVisible={panelsVisible} agents={agents}
      sponsor={location.sponsor} onSponsor={onSponsor} onReturnAtrium={onReturnAtrium} onPitch={onPitch}
      controller={controller} prizeAgent={presenting?.project_id} onSelectMarker={selectAgent} onHoverBuilding={() => {}}
      onSelectBuilding={(building) => onBuilding(building === "Engineering I" ? "Engineering I" : "Engineering II")} />
    <CameraMenu key={location.kind} kind={location.kind} onCamera={camera}
      onSponsor={(id) => { if (isSponsorRoom(id)) onSponsor(id); }} />
    {location.kind === "atrium" && <AtriumMap projectNames={result ? [projectName, ...result.rivals.map((entry) => entry.name)] : []} onRoom={onSponsor} />}
    {location.kind === "atrium" && <aside className="agent-inspector glass-panel" aria-label="AI agent inputs">
      <button className="agent-inspector-toggle" type="button" aria-expanded={agentExpanded} aria-controls="agent-input-content" onClick={() => setAgentExpanded((value) => !value)}>
        {previewActive ? `${samples.length || "Loading"} sample agents` : `${agents.filter((agent) => agent.key !== "user").length} field representatives`} · {agentExpanded ? "Close inputs" : "Explore inputs"}
      </button>
      <div id="agent-input-content" hidden={!agentExpanded}>
        {!results.length && <label className="agent-preview-toggle"><input type="checkbox" checked={showSamples} onChange={(event) => setShowSamples(event.target.checked)} />Show saved synthetic sample agents</label>}
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
        </> : <p>The API supplies up to three field leaders and their summaries. Select a returned agent in the report to read its summary. Other meshes represent the returned field count; their inputs are unavailable through the current API.</p>}
      </div>
    </aside>}
    {location.kind === "classroom" && <>
      {!panelsVisible && <aside className="classroom-caption glass-panel" aria-label="Sponsor classroom" style={{ "--sponsor-color": room.color } as React.CSSProperties}>
        <button type="button" className="classroom-back" onClick={onReturnAtrium}><ArrowLeftIcon size={17} aria-hidden="true" />Atrium</button>
        <h1>{room.id === "overall" ? room.name : `${room.name} classroom`}</h1>
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
      <p>{agents.length} {previewActive ? "synthetic sample agents" : "field representatives"} seated · same avatars as the atrium</p>
    </aside>}
    {location.kind === "awards" && <aside className="ceremony-dashboard glass-panel" aria-label="Award ceremonies">
      <h2><TrophyIcon size={23} aria-hidden="true" />Ceremonies</h2>
      <div className="ceremony-categories" role="group" aria-label="Ceremony categories">
        {ceremonyCategories.map((entry, index) => <button key={entry.id} type="button" aria-pressed={index === ceremonyIndex} onClick={() => { prizeToken.current++; setPrizePhase("ready"); activePresenter.current = ""; setLeaderIndex(0); setCeremonyIndex(index); setCeremonyPlaying(false); void controller.current?.command("pauseAward"); }}>{entry.name}</button>)}
      </div>
      <div className="ceremony-announcement" role="status" aria-live="polite">
        <h3>{ceremony.name}</h3>
        {showingUser ? <><p className="ceremony-user-win">You placed in the top three for {ceremony.name}!</p><p>{ceremonyResult!.score_10.toFixed(1)} / 10 · practice placement {ceremonyResult!.placement!.best_rank}–{ceremonyResult!.placement!.worst_rank}</p></> : presenting ? <><p className="dashboard-footnote">Field leader {leaders.length - leaderIndex} · by average score</p><h4>{presenting.name}</h4><p><strong>{presenting.score_10.toFixed(1)} / 10</strong></p><details className="ceremony-project-details" open><summary>About this project</summary><p>{presenting.summary}</p></details></> : <p>No evaluated field leaders returned for this category.</p>}
        <p className="dashboard-footnote">Practice prizes · API field leaders. Placement ranges include ties and scoring variation.</p>
        {job && <small>{job.judge_version.startsWith("mock-") ? "Mock practice results" : job.judge_version.startsWith("fixture-") || job.pool_version.startsWith("fixture-") ? "Synthetic fixture results" : "Simulated practice field"}{isStale ? " · Last submitted idea" : ""}</small>}
      </div>
      <button type="button" className="ceremony-play" disabled={!results.length} onClick={() => { if (!ceremonyPlaying && ceremonyIndex === ceremonyCategories.length - 1 && leaderIndex >= leaders.length - 1) { activePresenter.current = ""; setLeaderIndex(0); setCeremonyIndex(0); } setCeremonyPlaying((playing) => !playing); }}>{ceremonyPlaying ? <PauseIcon size={18} aria-hidden="true" /> : <PlayIcon size={18} aria-hidden="true" />}{ceremonyPlaying ? "Pause ceremony" : "Play ceremonies in order"}</button>
      <details className="ceremony-preview">
        <summary>Prize walk preview</summary>
        <p>Animation preview only. This agent is not a declared winner.</p>
        <button type="button" disabled={!agents.length || prizePhase === "moving"} onClick={() => void previewPrize()}>{prizePhase === "moving" ? "Agent collecting the prize…" : prizePhase === "collected" ? "Replay prize walk" : "Preview prize walk"}</button>
      </details>
    </aside>}
    {location.kind === "atrium" && result && !panelsVisible && <section className="scene-results glass-panel" aria-label="API results in the scene">
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
