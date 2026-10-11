import { useState, type ReactNode, type Ref } from "react";
import { ArrowUpRightIcon, CaretDownIcon, LightbulbIcon, RobotIcon, PencilSimpleIcon, TrophyIcon } from "@phosphor-icons/react";
import type { Challenge, ChallengeResult } from "../api/client";
import { ceremonyCategories } from "./engineering/ceremonyResults";
import JudgingCategoryLabel from "./JudgingCategoryLabel";

const criteria = [
  ["originality", "Originality"], ["tech_understanding", "Technical understanding"],
  ["functionality", "Functionality"], ["wow", "Wow factor"], ["relevance", "Category fit"],
] as const;

export default function AtriumDashboard({ result, results, challenges, projectName, onCategory, onRevise, onAgent, onCeremonies, headingRef, notice, children }: {
  headingRef: Ref<HTMLHeadingElement>;
  notice: ReactNode;
  children: ReactNode;
  result: ChallengeResult;
  results: ChallengeResult[];
  challenges: Challenge[];
  projectName: string;
  onCategory: (id: string) => void;
  onRevise: () => void;
  onAgent: (id: string) => void;
  onCeremonies: () => void;
}) {
  const placement = result.placement;
  const [mobilePanel, setMobilePanel] = useState("user");
  return <div className="atrium-dashboard" data-mobile-panel={mobilePanel}>
    <div className="dashboard-panel-switch glass-panel" role="group" aria-label="Ratings panels">
      <button type="button" aria-pressed={mobilePanel === "user"} aria-controls="dashboard-user-panel" onClick={() => setMobilePanel("user")}>Your project</button>
      <button type="button" aria-pressed={mobilePanel === "agents"} aria-controls="dashboard-agents-panel" onClick={() => setMobilePanel("agents")}>Competitors</button>
    </div>
    <aside className="dashboard-user dashboard-edge-panel dashboard-scroll-surface glass-panel" id="dashboard-user-panel" tabIndex={0} aria-labelledby="report-heading">
      <h2 id="report-heading" ref={headingRef} tabIndex={-1}>Your Hackathon Project Ratings</h2>
      <p className="dashboard-project-name">{projectName}</p>
      {notice}
      <div className="dashboard-toolbar">
        <label htmlFor="dashboard-category">Judging category
          <select id="dashboard-category" value={result.challenge_id} onChange={(event) => onCategory(event.target.value)}>
            {results.map((entry) => <option value={entry.challenge_id} key={entry.challenge_id}>{challenges.find((challenge) => challenge.id === entry.challenge_id)?.name ?? entry.challenge_id}</option>)}
          </select>
        </label>
      </div>
      <section className="dashboard-ratings" aria-label="Your ratings">
        <div className="dashboard-score-row">
          <p className="dashboard-score" aria-label={`Your rating ${result.score_10.toFixed(1)} out of 10`}><strong>{result.score_10.toFixed(1)}</strong><span>/ 10</span></p>
          <p className="dashboard-placement">{!result.eligible ? "Not eligible for this category" : placement ? <><strong>Place {placement.best_rank === placement.worst_rank ? placement.best_rank : `${placement.best_rank}–${placement.worst_rank}`}</strong><span>of {placement.field_size_including_user} practice entries</span></> : "No placement returned"}</p>
        </div>
        <details className="dashboard-scores-overview">
          <summary>All category ratings<CaretDownIcon size={16} aria-hidden="true" /></summary>
          <dl className="dashboard-category-scores" aria-label="Your overall and sponsor category scores">
            {results.filter((entry) => ceremonyCategories.some((category) => category.id === entry.challenge_id)).map((entry) => <div key={entry.challenge_id}>
              <dt><button type="button" aria-pressed={entry.challenge_id === result.challenge_id} onClick={() => onCategory(entry.challenge_id)}>{ceremonyCategories.find((category) => category.id === entry.challenge_id)?.name}</button></dt>
              <dd>{entry.score_10.toFixed(1)} <span>/ 10</span></dd>
              <dd className="dashboard-category-place">{!entry.eligible ? "Ineligible" : entry.placement ? `Place ${entry.placement.best_rank}–${entry.placement.worst_rank}` : "Unranked"}</dd>
            </div>)}
          </dl>
        </details>
        <h4 className="dashboard-rubric-heading">Rubric scores · {challenges.find((challenge) => challenge.id === result.challenge_id)?.name ?? result.challenge_id}</h4>
        <dl className="dashboard-criteria" aria-label="Rubric criterion means, not criterion ranks">
          {criteria.map(([key, label]) => result.criteria[key] === undefined ? null : <div key={key}><dt>{label}</dt><dd>{result.criteria[key]!.toFixed(1)} <span>/ 5</span></dd></div>)}
        </dl>
        <p className="dashboard-rationale">{result.rationale}</p>
      </section>
      <section className="dashboard-improvements" aria-labelledby="improvement-heading">
        <h3 id="improvement-heading"><LightbulbIcon size={22} aria-hidden="true" />How to improve</h3>
        {result.improvements.length ? <ol>{result.improvements.map((suggestion, index) => <li key={`${index}:${suggestion}`}>{suggestion}</li>)}</ol> : <p>No improvement suggestions were returned for this category.</p>}
        <p className="dashboard-footnote">Judge feedback on the submitted description. Revise and evaluate again to get a new rating.</p>
        <button type="button" className="dashboard-revise" onClick={onRevise}><PencilSimpleIcon size={18} aria-hidden="true" />Revise your idea</button>
      </section>
      {children}
    </aside>
    <aside className="dashboard-agents dashboard-edge-panel dashboard-scroll-surface glass-panel" id="dashboard-agents-panel" tabIndex={0} aria-labelledby="agent-ratings-heading">
      <h2 id="agent-ratings-heading"><RobotIcon size={22} aria-hidden="true" />Competitors’ ratings <span>(agents)</span></h2>
      <div className="dashboard-agent-categories">
        {ceremonyCategories.map((category) => {
          const categoryResult = results.find((entry) => entry.challenge_id === category.id);
          return <div key={category.id}>
            {category.id === "overall" && <h3 className="dashboard-general-heading">Overall project</h3>}
            <details className="dashboard-agent-category">
            <summary><JudgingCategoryLabel category={category} /><CaretDownIcon size={17} aria-hidden="true" /></summary>
            {categoryResult?.rivals.length ? <ol aria-label={`${category.name} API field leaders`}>{categoryResult.rivals.map((rival) => <li key={rival.project_id}>
              <div className="dashboard-agent-heading"><h4>{rival.name}</h4><p><strong>{rival.score_10.toFixed(1)}</strong><span>/ 10</span></p></div>
              <details className="dashboard-agent-project"><summary>Project summary</summary><p>{rival.summary}</p></details>
              <button type="button" onClick={() => { onCategory(category.id); onAgent(rival.project_id); }}>View agent in atrium<ArrowUpRightIcon size={16} aria-hidden="true" /></button>
            </li>)}</ol> : <p className="dashboard-no-agents">{categoryResult ? "No rival ratings were returned for this category." : "This category was not evaluated in your submission."}</p>}
            </details>
          </div>;
        })}
        <p className="category-unavailable">Best Embedded <span>Unavailable in this API</span></p>
      </div>
      <p className="dashboard-footnote">The API returns up to three field leaders by average score. Top ten is unavailable.</p>
      <div className="dashboard-ceremonies-link">
        <h3>Watch ceremonies to see prizes</h3>
        <button type="button" onClick={onCeremonies}><TrophyIcon size={20} aria-hidden="true" />Watch ceremonies<ArrowUpRightIcon size={17} aria-hidden="true" /></button>
      </div>
    </aside>
  </div>;
}
