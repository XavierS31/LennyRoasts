import { useState } from "react";
import { ArrowUpRightIcon, LightbulbIcon, RobotIcon, UserCircleIcon, PencilSimpleIcon, TrophyIcon } from "@phosphor-icons/react";
import type { Challenge, ChallengeResult } from "../api/client";
import { ceremonyCategories } from "./engineering/ceremonyResults";

const criteria = [
  ["originality", "Originality"], ["tech_understanding", "Technical understanding"],
  ["functionality", "Functionality"], ["wow", "Wow factor"], ["relevance", "Category fit"],
] as const;

export default function AtriumDashboard({ result, results, challenges, projectName, onCategory, onRevise, onAgent, onCeremonies }: {
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
  const [agentCategory, setAgentCategory] = useState("gemini");
  const agentResult = results.find((entry) => entry.challenge_id === agentCategory);
  return <div className="atrium-dashboard">
    <div className="dashboard-toolbar">
      <label htmlFor="dashboard-category">Judging category
        <select id="dashboard-category" value={result.challenge_id} onChange={(event) => onCategory(event.target.value)}>
          {results.map((entry) => <option value={entry.challenge_id} key={entry.challenge_id}>{challenges.find((challenge) => challenge.id === entry.challenge_id)?.name ?? entry.challenge_id}</option>)}
        </select>
      </label>
      <button type="button" className="dashboard-revise" onClick={onRevise}><PencilSimpleIcon size={18} aria-hidden="true" />Revise your idea</button>
    </div>
    <div className="dashboard-columns">
      <div className="dashboard-user">
        <section className="dashboard-ratings" aria-labelledby="your-ratings-heading">
          <h3 id="your-ratings-heading"><UserCircleIcon size={22} aria-hidden="true" />Your ratings</h3>
          <p className="dashboard-project-name">{projectName}</p>
          <dl className="dashboard-category-scores" aria-label="Your overall and sponsor category scores">
            {results.filter((entry) => ceremonyCategories.some((category) => category.id === entry.challenge_id)).map((entry) => <div key={entry.challenge_id}>
              <dt><button type="button" aria-pressed={entry.challenge_id === result.challenge_id} onClick={() => onCategory(entry.challenge_id)}>{ceremonyCategories.find((category) => category.id === entry.challenge_id)?.name}</button></dt>
              <dd>{entry.score_10.toFixed(1)} <span>/ 10</span></dd>
              <dd className="dashboard-category-place">{!entry.eligible ? "Ineligible" : entry.placement ? `Place ${entry.placement.best_rank}–${entry.placement.worst_rank}` : "Unranked"}</dd>
            </div>)}
          </dl>
          <div className="dashboard-score-row">
            <p className="dashboard-score" aria-label={`Your rating ${result.score_10.toFixed(1)} out of 10`}><strong>{result.score_10.toFixed(1)}</strong><span>/ 10</span></p>
            <p className="dashboard-placement">{!result.eligible ? "Not eligible for this category" : placement ? <><strong>Place {placement.best_rank === placement.worst_rank ? placement.best_rank : `${placement.best_rank}–${placement.worst_rank}`}</strong><span>of {placement.field_size_including_user} practice entries</span></> : "No placement returned"}</p>
          </div>
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
        </section>
      </div>
      <section className="dashboard-agents" aria-labelledby="agent-ratings-heading">
        <h3 id="agent-ratings-heading"><RobotIcon size={22} aria-hidden="true" />Agent ratings</h3>
        <div className="dashboard-agent-categories" role="group" aria-label="Agent rating categories">
          {ceremonyCategories.map((entry) => <button key={entry.id} type="button" aria-pressed={agentCategory === entry.id} onClick={() => setAgentCategory(entry.id)}>{entry.name}</button>)}
        </div>
        <p className="dashboard-footnote">Up to three field leaders by average score, returned by the API. A top-ten list is unavailable.</p>
        {agentResult?.rivals.length ? <ul>{agentResult.rivals.map((rival) => <li key={rival.project_id}>
          <div className="dashboard-agent-heading"><h4>{rival.name}</h4><p><strong>{rival.score_10.toFixed(1)}</strong><span>/ 10</span></p></div>
          <p>{rival.summary}</p>
          <button type="button" onClick={() => { onCategory(agentCategory); onAgent(rival.project_id); }}>View agent in atrium<ArrowUpRightIcon size={16} aria-hidden="true" /></button>
        </li>)}</ul> : <p className="dashboard-no-agents">{agentResult ? "No rival ratings were returned for this category." : "This category was not evaluated in your submission."} Select another category to explore its report.</p>}
      </section>
    </div>
    <div className="dashboard-ceremonies-link">
      <div><h3>Watch ceremonies to see prizes</h3><p>Meet the API’s leading agents and review your practice placements in the ballroom.</p></div>
      <button type="button" onClick={onCeremonies}><TrophyIcon size={20} aria-hidden="true" />Watch ceremonies<ArrowUpRightIcon size={17} aria-hidden="true" /></button>
    </div>
  </div>;
}
