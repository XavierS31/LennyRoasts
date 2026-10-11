import { useEffect, useState, type RefObject } from "react";
import type { Challenge, EvaluationJob } from "../../api/client";
import EngineeringScene, { type CameraCommand, type SceneController } from "./EngineeringScene";
import type { LocationState } from "./navigation";
import AtriumMap from "./AtriumMap";
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
  const room = sponsorRoom(location.sponsor);
  const roomResult = job?.status === "completed" ? job.result?.challenge_results.find((entry) => entry.challenge_id === room.id) : undefined;
  const results = location.kind === "atrium" && job?.status === "completed" ? job.result?.challenge_results ?? [] : [];
  const result = results.find((entry) => entry.challenge_id === category) ?? results.find((entry) => entry.challenge_id === "overall") ?? results[0];
  const rival = result?.rivals.find((entry) => entry.project_id === marker);
  const selectedName = rival?.name ?? projectName;
  const selectedScore = rival?.score_10 ?? result?.score_10;

  useEffect(() => { setMarker("user"); }, [result]);
  useEffect(() => { setResultsExpanded(false); }, [location.kind]);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 900px)");
    const resize = () => { if (narrow.matches) setResultsExpanded(false); };
    narrow.addEventListener("change", resize);
    return () => narrow.removeEventListener("change", resize);
  }, []);

  function camera(action: CameraCommand) { void controller.current?.command(action); }
  function selectProject(id: string) { setMarker(id); void controller.current?.command("focus", id); }

  return <div className={`engineering-explorer scene-${location.kind} ${panelsVisible ? "with-panels" : "without-panels"}`}>
    <EngineeringScene kind={location.kind} result={result} projectName={projectName} selectedMarker={marker} panelsVisible={panelsVisible}
      sponsor={location.sponsor} onSponsor={onSponsor} onReturnAtrium={onReturnAtrium} onPitch={onPitch}
      controller={controller} onSelectMarker={setMarker} onHoverBuilding={() => {}}
      onSelectBuilding={(building) => onBuilding(building === "Engineering I" ? "Engineering I" : "Engineering II")} />
    <CameraMenu key={location.kind} kind={location.kind} onCamera={camera}
      onSponsor={(id) => { if (isSponsorRoom(id)) onSponsor(id); }} />
    {location.kind === "atrium" && <AtriumMap projectNames={result ? [projectName, ...result.rivals.map((entry) => entry.name)] : []} />}
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
        <p>{result.placement ? `${result.placement.eligible_competitors} eligible competitors. Atrium figures are anonymous representatives, capped at 200.` : "No field population is inferred."}</p>
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
