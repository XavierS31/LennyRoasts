import { useEffect, useState, type RefObject } from "react";
import type { Challenge, EvaluationJob } from "../../api/client";
import EngineeringScene, { type CameraCommand, type SceneController } from "./EngineeringScene";
import type { LocationState } from "./navigation";
import AtriumMap from "./AtriumMap";

export default function EngineeringExplorer({ job, challenges, projectName, category, onCategory, panelsVisible, isStale, location, onBuilding, onEnter, entering, controller }: {
  job: EvaluationJob | null;
  challenges: Challenge[];
  projectName: string;
  category: string;
  onCategory: (id: string) => void;
  panelsVisible: boolean;
  isStale: boolean;
  location: LocationState;
  onBuilding: (building: LocationState["building"]) => void;
  onEnter: () => void;
  entering: boolean;
  controller: RefObject<SceneController | null>;
}) {
  const [hovered, setHovered] = useState("");
  const [marker, setMarker] = useState("user");
  const [resultsExpanded, setResultsExpanded] = useState(false);
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
    <EngineeringScene kind={location.kind} result={result} projectName={projectName} selectedMarker={marker}
      controller={controller} onSelectMarker={setMarker} onHoverBuilding={setHovered}
      onSelectBuilding={(building) => onBuilding(building === "Engineering I" ? "Engineering I" : "Engineering II")} />
    {location.kind === "campus" && <div className="scene-navigation glass-panel">
      <span className="scene-caption">UCF · ENGINEERING I / II</span>
      <div className="building-entry">
        <label htmlFor="building-choice" className="visually-hidden">Building to enter</label>
        <select id="building-choice" value={location.building} disabled={entering} onChange={(event) => onBuilding(event.target.value as LocationState["building"])}>
          <option>Engineering I</option><option>Engineering II</option>
        </select>
        <button type="button" onClick={onEnter} disabled={entering}>{entering ? "Entering…" : "Enter building ↗"}</button>
      </div>
      <small>{hovered || "Select a building · drag to orbit · scroll to zoom"}</small>
    </div>}
    <div className="camera-controls glass-panel" role="group" aria-label="Camera controls">
      <button type="button" aria-label="Zoom in" onClick={() => camera("in")}>+</button>
      <button type="button" aria-label="Zoom out" onClick={() => camera("out")}>−</button>
      <button type="button" onClick={() => camera("reset")}>Reset</button>
      <button type="button" onClick={() => camera("iso")}>{location.kind === "atrium" ? "Balcony view" : "Orbit view"}</button>
      <button type="button" onClick={() => camera("top")}>{location.kind === "atrium" ? "Whole floor" : "Top view"}</button>
      {location.kind === "atrium" ? <>
        <button type="button" onClick={() => camera("floor")}>Table level</button>
        <button type="button" onClick={() => camera("stairs")}>Staircase</button>
        <button type="button" onClick={() => camera("ceiling")}>Skylights</button>
        <button type="button" onClick={() => camera("entrance")}>Glass entrance</button>
      </> : <button type="button" onClick={() => camera("front")}>Front view</button>}
    </div>
    {location.kind === "atrium" && <AtriumMap projectNames={result ? [projectName, ...result.rivals.map((entry) => entry.name)] : []} />}
    {location.kind === "atrium" && !result && <p className="atrium-empty glass-panel">Explore Engineering II. Submit an idea on the Exterior to bring your project and API-returned competition into the room.</p>}
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
