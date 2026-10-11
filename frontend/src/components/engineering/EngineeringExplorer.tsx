import { useEffect, useRef, useState } from "react";
import type { Challenge, EvaluationJob } from "../../api/client";
import EngineeringScene, { type CameraCommand, type SceneController, type SceneKind } from "./EngineeringScene";
import { sceneLocation, scenePath } from "./navigation";

export default function EngineeringExplorer({ job, challenges, projectName, category, onCategory, panelsVisible, isStale }: {
  job: EvaluationJob | null;
  challenges: Challenge[];
  projectName: string;
  category: string;
  onCategory: (id: string) => void;
  panelsVisible: boolean;
  isStale: boolean;
}) {
  const [location, setLocation] = useState(() => sceneLocation(new URL(window.location.href)));
  const [hovered, setHovered] = useState("");
  const [marker, setMarker] = useState("user");
  const [entering, setEntering] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(() => !window.matchMedia("(max-width: 900px)").matches);
  const controller = useRef<SceneController | null>(null);
  const transition = useRef(0);
  const results = job?.status === "completed" ? job.result?.challenge_results ?? [] : [];
  const result = results.find((entry) => entry.challenge_id === category) ?? results[0];
  const rival = result?.rivals.find((entry) => entry.project_id === marker);
  const selectedName = rival?.name ?? projectName;
  const selectedScore = rival?.score_10 ?? result?.score_10;

  useEffect(() => {
    const back = () => { transition.current++; setEntering(false); setLocation(sceneLocation(new URL(window.location.href))); };
    window.addEventListener("popstate", back);
    return () => { transition.current++; window.removeEventListener("popstate", back); };
  }, []);
  useEffect(() => { setMarker("user"); }, [result]);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 900px)");
    const resize = () => setResultsExpanded(!narrow.matches);
    narrow.addEventListener("change", resize);
    return () => narrow.removeEventListener("change", resize);
  }, []);

  function navigate(kind: SceneKind) {
    transition.current++;
    setEntering(false);
    const next = { ...location, kind };
    window.history.pushState(null, "", scenePath(next));
    setLocation(next);
    setHovered("");
  }
  async function enter() {
    const token = ++transition.current;
    setEntering(true);
    await controller.current?.command("enter", location.building);
    if (token === transition.current) navigate("atrium");
  }
  function camera(action: CameraCommand) { void controller.current?.command(action); }

  return <div className={`engineering-explorer ${panelsVisible ? "with-panels" : "without-panels"}`}>
    <EngineeringScene kind={location.kind} result={result} projectName={projectName} selectedMarker={marker}
      controller={controller} onSelectMarker={setMarker} onHoverBuilding={setHovered}
      onSelectBuilding={(building) => setLocation((current) => ({ ...current, building: building === "Engineering I" ? "Engineering I" : "Engineering II" }))} />
    <nav className="scene-navigation glass-panel" aria-label="Explore Engineering buildings">
      <span className="scene-caption">UCF · ENGINEERING I / II</span>
      <div className="scene-tabs">
        <button type="button" aria-pressed={location.kind === "campus"} onClick={() => navigate("campus")}>Exterior</button>
        <button type="button" aria-pressed={location.kind === "atrium"} onClick={() => navigate("atrium")}>Atrium</button>
        <button type="button" aria-pressed={location.kind === "awards"} onClick={() => navigate("awards")}>Auditorium</button>
      </div>
      {location.kind === "campus" && <div className="building-entry">
        <label htmlFor="building-choice" className="visually-hidden">Building to enter</label>
        <select id="building-choice" value={location.building} onChange={(event) => setLocation((current) => ({ ...current, building: event.target.value as typeof current.building }))}>
          <option>Engineering I</option><option>Engineering II</option>
        </select>
        <button type="button" onClick={() => void enter()} disabled={entering}>{entering ? "Entering…" : "Enter building ↗"}</button>
      </div>}
      <small>{hovered || (location.kind === "campus" ? "Select a building · drag to orbit · scroll to zoom" : `${location.building} · drag to orbit · scroll to zoom`)}</small>
    </nav>
    <div className="camera-controls glass-panel" role="group" aria-label="Camera controls">
      <button type="button" aria-label="Zoom in" onClick={() => camera("in")}>+</button>
      <button type="button" aria-label="Zoom out" onClick={() => camera("out")}>−</button>
      <button type="button" onClick={() => camera("reset")}>Reset</button>
      <button type="button" onClick={() => camera("iso")}>Orbit view</button>
      <button type="button" onClick={() => camera("top")}>Top view</button>
      <button type="button" onClick={() => camera("front")}>Front view</button>
    </div>
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
        <button type="button" aria-pressed={!rival} onClick={() => setMarker("user")}>Your idea</button>
        {result.rivals.map((entry) => <button type="button" key={entry.project_id} aria-pressed={marker === entry.project_id} onClick={() => setMarker(entry.project_id)}>{entry.name}</button>)}
      </div>
      <h2>{selectedName}</h2><p className="scene-score">{selectedScore?.toFixed(1)} <span>/ 10</span></p>
      {rival ? <p>{rival.summary}</p> : <>
        <p>{result.eligible ? "Eligible" : "Ineligible"} · {result.placement ? `Practice placement ${result.placement.best_rank}–${result.placement.worst_rank} of ${result.placement.field_size_including_user}` : "No placement returned"}</p>
        <p>{result.placement ? `${result.placement.eligible_competitors} eligible competitors. Atrium figures are anonymous representatives, capped at 200.` : "No field population is inferred."}</p>
      </>}
      <small>Gold: your idea · blue: returned rivals. Marker height shows API score, never win probability. {job?.judge_version}</small>
      </div>
    </section>}
  </div>;
}
