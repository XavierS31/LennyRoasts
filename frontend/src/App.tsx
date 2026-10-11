import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import sampleIdea from "../demo/campus-queue.txt?raw";
import SceneBoundary from "./components/engineering/SceneBoundary";
import { ideaError, ideaSubmission, MAX_IDEA_LENGTH } from "./ideaSubmission";
import {
  ApiRequestError,
  getChallenges,
  getEvaluation,
  submitEvaluation,
  type Challenge,
  type ChallengeList,
  type ChallengeResult,
  type EvaluationJob,
  type RunScore,
  type Submission,
} from "./api/client";

type ErrorField = "idea" | "challenges";
type FormErrors = Partial<Record<ErrorField, string>>;
type Notice = {
  title: string;
  message: string;
  details?: string[];
  kind?: "error" | "info";
  action?: "refresh-field";
};
type ServiceMode = "loading" | "unavailable" | "mock" | "fixture" | "live";
const EngineeringExplorer = lazy(() => import("./components/engineering/EngineeringExplorer"));

const JOB_STORAGE_KEY = "lennyroasts.active-evaluation";
const MAX_AUTOMATIC_POLL_MS = 5 * 60 * 1000;
const criterionLabels = [
  ["originality", "Originality"],
  ["tech_understanding", "Technical understanding"],
  ["functionality", "Functionality"],
  ["wow", "Wow factor"],
  ["relevance", "Relevance"],
] as const;

function readStoredJobId(): string | null {
  try {
    return window.sessionStorage.getItem(JOB_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveStoredJobId(id: string): void {
  try {
    window.sessionStorage.setItem(JOB_STORAGE_KEY, id);
  } catch {
    // The current page can still follow the job when session storage is disabled.
  }
}

function removeStoredJobId(): void {
  try {
    window.sessionStorage.removeItem(JOB_STORAGE_KEY);
  } catch {
    // There is no persistent job id to clear when storage is disabled.
  }
}

function challengeMode(config?: ChallengeList): ServiceMode {
  if (!config) return "loading";
  if (
    !config.field_ready ||
    config.judge_version === "unconfigured" ||
    config.pool_version === "unconfigured"
  ) {
    return "unavailable";
  }
  if (config.judge_version.startsWith("mock-")) return "mock";
  if (
    config.judge_version.startsWith("fixture-") ||
    config.pool_version.startsWith("fixture-")
  ) {
    return "fixture";
  }
  return "live";
}

function jobMode(job: EvaluationJob, config?: ChallengeList): ServiceMode {
  if (job.judge_version.startsWith("mock-")) return "mock";
  if (
    job.judge_version.startsWith("fixture-") ||
    job.pool_version.startsWith("fixture-")
  ) {
    return "fixture";
  }
  if (
    !config?.field_ready ||
    job.judge_version === "unconfigured" ||
    job.pool_version === "unconfigured"
  ) {
    return "unavailable";
  }
  return "live";
}

function modeLabel(mode: ServiceMode): string {
  switch (mode) {
    case "mock":
      return "Development mock scoring";
    case "fixture":
      return "Synthetic fixture response";
    case "live":
      return "Live simulated-field evaluation";
    case "unavailable":
      return "Evaluation unavailable";
    default:
      return "Loading challenge readiness";
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      window.clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function getInputId(field: ErrorField): string {
  return field === "challenges" ? "sponsor-heading" : "idea-description";
}

function serverFieldErrors(details: string[]): FormErrors {
  const errors: FormErrors = {};
  for (const detail of details) {
    if (/challenges/i.test(detail)) errors.challenges = detail;
    else if (/submission/i.test(detail)) errors.idea = detail;
  }
  return errors;
}

function getApiDetails(error: unknown): string[] {
  return error instanceof ApiRequestError ? error.apiError?.details ?? [] : [];
}

function getSubmitNotice(error: unknown): Notice {
  if (error instanceof ApiRequestError && error.status === 422) {
    return {
      title: "The API rejected this submission",
      message: error.apiError?.message ?? "Review the fields and try again.",
      details: getApiDetails(error),
    };
  }
  if (error instanceof ApiRequestError && error.status === 503) {
    return {
      title: "Evaluation is unavailable",
      message:
        error.apiError?.message ??
        "The field or scoring service is not ready. Your idea is still in this form, and no report was created.",
      details: getApiDetails(error),
      action: "refresh-field",
    };
  }
  if (error instanceof ApiRequestError) {
    return {
      title: `The API returned an error (${error.status})`,
      message: error.apiError?.message ?? error.message,
      details: getApiDetails(error),
    };
  }
  return {
    title: "Could not start the evaluation",
    message:
      "The request did not return an evaluation ID, so no automatic retry was made. Keep your idea description here and choose when to submit again.",
    details: error instanceof Error ? [error.message] : undefined,
  };
}

function rankText(result: ChallengeResult): string | null {
  const placement = result.placement;
  if (!result.eligible || !placement) return null;
  const rank =
    placement.best_rank === placement.worst_rank
      ? `${placement.best_rank}`
      : `${placement.best_rank}–${placement.worst_rank}`;
  return `Practice placement ${rank} of ${placement.field_size_including_user} eligible entries, including yours.`;
}

function criterionValue(result: ChallengeResult, key: (typeof criterionLabels)[number][0]) {
  return result.criteria[key];
}

function EvidenceValue({ value }: { value: string | undefined }) {
  if (!value || value.trim().toLowerCase() === "not described") {
    return <p className="evidence-missing">Not described in the idea description.</p>;
  }
  return <blockquote className="evidence-quote">{value}</blockquote>;
}

function RunDetails({ runs }: { runs: RunScore[] }) {
  return (
    <details className="report-detail">
      <summary>See the three scoring runs</summary>
      <div className="table-scroll">
        <table>
          <caption>Per-run scores returned by the API</caption>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Total</th>
              <th scope="col">Score</th>
              <th scope="col">Eligibility</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.run}>
                <th scope="row">{run.run + 1}</th>
                <td>
                  {run.total.toFixed(1)} / {run.max_total}
                </td>
                <td>{run.score_10.toFixed(1)} / 10</td>
                <td>{run.eligible ? "Eligible" : "Ineligible"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="run-criteria-list">
        {runs.map((run) => (
          <div className="run-criteria" key={`criteria-${run.run}`}>
            <h5>Run {run.run + 1} criteria</h5>
            <ul>
              {criterionLabels.map(([key, label]) => {
                const value = run.criteria[key];
                return value === undefined ? null : (
                  <li key={key}>
                    {label}: {value} / 5
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function ReportCard({
  result,
  challenge,
  onShowInScene,
  selected,
}: {
  result: ChallengeResult;
  challenge?: Challenge;
  onShowInScene: () => void;
  selected: boolean;
}) {
  const evidenceEntries = criterionLabels
    .map(([key, label]) => [label, result.evidence[key]] as const)
    .filter(([, value]) => value !== undefined);
  const placementText = rankText(result);

  return (
    <article className={`report-card ${selected ? "scene-selected" : ""}`}>
      <button className="text-button scene-link" type="button" onClick={onShowInScene}>Show in 3D scene ↗</button>
      <header className="report-card-header">
        <div className="report-card-title">
          <h3>{challenge?.name ?? result.challenge_id}</h3>
          <span className={`eligibility ${result.eligible ? "is-eligible" : "is-ineligible"}`}>
            {result.eligible ? "Eligible" : "Ineligible"}
          </span>
        </div>
        <div className="score-block" aria-label={`Score ${result.score_10.toFixed(1)} out of 10`}>
          <strong>{result.score_10.toFixed(1)}</strong>
          <span>/ 10</span>
        </div>
      </header>

      <p className="total-score">
        Total score: {result.total.toFixed(1)} / {result.max_total}
      </p>

      <div className={`placement-box ${result.eligible ? "" : "placement-unranked"}`}>
        {placementText ? (
          <>
            <strong>{placementText}</strong>
            <span>
              {result.placement?.eligible_competitors} eligible competitors · {result.placement?.field_size_including_user} total entries including yours
            </span>
          </>
        ) : result.eligible ? (
          <>
            <strong>No placement was returned for this eligible result.</strong>
            <span>The report does not assign a substitute rank.</span>
          </>
        ) : (
          <>
            <strong>Not eligible for this category’s simulated ranking.</strong>
            <span>No placement is assigned to an ineligible result.</span>
          </>
        )}
      </div>

      <section className="rationale-section" aria-label="Judge rationale">
        <h4>Rationale</h4>
        <p>{result.rationale}</p>
      </section>

      <section className="criteria-section" aria-label="Criterion means">
        <h4>Criterion means</h4>
        <dl className="criteria-list">
          {criterionLabels.map(([key, label]) => {
            const value = criterionValue(result, key);
            return value === undefined ? null : (
              <div className="criterion" key={key}>
                <dt>{label}</dt>
                <dd>{value.toFixed(1)} <span>/ 5</span></dd>
              </div>
            );
          })}
        </dl>
      </section>

      {result.warnings.length > 0 && (
        <section className="warning-section" aria-label="Warnings">
          <h4>Warnings</h4>
          <ul>
            {result.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      {result.rivals.length > 0 && (
        <section className="rivals-section" aria-label="Rival summaries">
          <h4>Rivals returned by the field</h4>
          <ul className="rival-list">
            {result.rivals.map((rival) => (
              <li className="rival" key={rival.project_id}>
                <div>
                  <strong>{rival.name}</strong>
                  <p>{rival.summary}</p>
                </div>
                <span>{rival.score_10.toFixed(1)} / 10</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.improvements.length > 0 && (
        <section className="improvements-section" aria-label="Suggested improvements">
          <h4>What to clarify or build next</h4>
          <ul>
            {result.improvements.map((improvement, index) => (
              <li key={`${improvement}-${index}`}>{improvement}</li>
            ))}
          </ul>
        </section>
      )}

      {challenge && (
        <details className="report-detail">
          <summary>Challenge description from the API</summary>
          <p className="challenge-detail-copy">{challenge.description}</p>
        </details>
      )}

      <details className="report-detail">
        <summary>Evidence from the idea description</summary>
        <dl className="evidence-list">
          {evidenceEntries.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd><EvidenceValue value={value} /></dd>
            </div>
          ))}
        </dl>
      </details>

      <RunDetails runs={result.runs} />
    </article>
  );
}

export default function App() {
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [activePanel, setActivePanel] = useState<"project" | "report">("project");
  const [sceneCategory, setSceneCategory] = useState("");
  const [idea, setIdea] = useState("");
  const [selectedChallenges, setSelectedChallenges] = useState<Submission["challenges"]>([]);
  const [config, setConfig] = useState<ChallengeList>();
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<Notice | null>(null);
  const [job, setJob] = useState<EvaluationJob | null>(null);
  const [submittedSubmission, setSubmittedSubmission] = useState<Submission | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => readStoredJobId());
  const [pollingEnabled, setPollingEnabled] = useState(() => Boolean(readStoredJobId()));
  const [isPolling, setIsPolling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pollNotice, setPollNotice] = useState<Notice | null>(null);
  const [configRefresh, setConfigRefresh] = useState(0);
  const reportHeading = useRef<HTMLHeadingElement>(null);
  const noticeHeading = useRef<HTMLHeadingElement>(null);
  const ideaInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setConfigLoading(true);
    setConfigError(null);
    getChallenges(controller.signal)
      .then((nextConfig) => {
        setConfig(nextConfig);
        setConfigLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setConfigError({
          title: "Challenge information could not be loaded",
          message:
            error instanceof Error
              ? error.message
              : "The API did not return challenge information.",
        });
        setConfigLoading(false);
      });
    return () => controller.abort();
  }, [configRefresh]);

  useEffect(() => {
    if (!activeJobId || !pollingEnabled) return;

    const controller = new AbortController();
    let cancelled = false;
    const evaluationId = activeJobId;
    setIsPolling(true);
    setPollNotice(null);

    async function pollExistingJob() {
      const startedAt = Date.now();
      let attempt = 0;
      let networkFailures = 0;
      await sleep(850, controller.signal);

      while (!controller.signal.aborted && !cancelled) {
        try {
          const nextJob = await getEvaluation(evaluationId, controller.signal);
          if (cancelled) return;
          setJob(nextJob);
          networkFailures = 0;

          if (nextJob.status === "completed") {
            if (!nextJob.result) {
              setPollNotice({
                title: "The API returned an incomplete result",
                message:
                  "The job is marked complete but has no report. Resume checks to ask the same job again; no new evaluation was submitted.",
              });
              setPollingEnabled(false);
              setIsPolling(false);
              return;
            }
            removeStoredJobId();
            setActiveJobId(null);
            setPollingEnabled(false);
            setPollNotice(null);
            setIsPolling(false);
            return;
          }

          if (nextJob.status === "failed") {
            removeStoredJobId();
            setActiveJobId(null);
            setPollingEnabled(false);
            setPollNotice(null);
            setIsPolling(false);
            return;
          }
        } catch (error: unknown) {
          if (controller.signal.aborted || cancelled) return;
          if (error instanceof ApiRequestError && error.status === 404) {
            removeStoredJobId();
            setActiveJobId(null);
            setPollingEnabled(false);
            setIsPolling(false);
            setPollNotice({
              title: "This evaluation is no longer available",
              message:
                "The job ID is unknown, expired, or belongs to another browser session. No replacement evaluation was created. Review your idea description and submit again only if you choose to.",
              details: error.apiError?.details,
            });
            return;
          }

          if (error instanceof ApiRequestError) {
            setPollingEnabled(false);
            setIsPolling(false);
            setPollNotice({
              title: "The existing evaluation could not be checked",
              message: `${error.apiError?.message ?? error.message} Resume checks to continue this same job; it will not be submitted again.`,
              details: error.apiError?.details,
            });
            return;
          }

          networkFailures += 1;
          if (networkFailures >= 3) {
            setPollingEnabled(false);
            setIsPolling(false);
            setPollNotice({
              title: "Connection interrupted",
              message:
                "Three checks could not reach the API. The evaluation ID is saved for this browser session. Resume checks to continue the same job; no new evaluation was submitted.",
              details: error instanceof Error ? [error.message] : undefined,
            });
            return;
          }
          setPollNotice({
            title: "Connection interrupted",
            message: `Trying again to check the existing evaluation (${networkFailures} of 3). The submission will not be repeated.`,
          });
        }

        if (Date.now() - startedAt >= MAX_AUTOMATIC_POLL_MS) {
          setPollingEnabled(false);
          setIsPolling(false);
          setPollNotice({
            title: "Still processing",
            message:
              "Automatic checks are paused. Resume checks to continue this same evaluation. The server-side job was not canceled.",
          });
          return;
        }

        const waitMs = Math.min(1000 * 1.7 ** attempt, 10000);
        attempt += 1;
        await sleep(waitMs, controller.signal);
      }
      setIsPolling(false);
    }

    void pollExistingJob();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeJobId, pollingEnabled]);

  useEffect(() => {
    if (job || activeJobId || pollNotice) {
      setActivePanel("report");
      setPanelsVisible(true);
    }
  }, [job?.evaluation_id, job?.status, activeJobId, pollNotice]);

  useEffect(() => {
    if (notice) {
      setActivePanel("project");
      setPanelsVisible(true);
    }
  }, [notice]);

  useEffect(() => {
    if (job?.status === "completed" || job?.status === "failed") {
      window.requestAnimationFrame(() => reportHeading.current?.focus());
    }
  }, [job?.status]);

  function loadSample() {
    setIdea(sampleIdea.trim());
    setSelectedChallenges(["gemini"]);
    setJob(null);
    setSubmittedSubmission(null);
    setErrors({});
    setNotice(null);
    setPollNotice(null);
    window.requestAnimationFrame(() => {
      if (ideaInput.current) ideaInput.current.scrollTop = 0;
    });
  }

  function focusFirstError(nextErrors: FormErrors) {
    setActivePanel("project");
    setPanelsVisible(true);
    const focusOrder: ErrorField[] = ["idea", "challenges"];
    const field = focusOrder.find(
      (candidate) => nextErrors[candidate],
    );
    window.requestAnimationFrame(() => {
      if (field) document.getElementById(getInputId(field))?.focus();
      else noticeHeading.current?.focus();
    });
  }

  async function refreshChallenges() {
    setConfigError(null);
    setConfigLoading(true);
    setConfigRefresh((value) => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const descriptionError = ideaError(idea);
    const nextErrors: FormErrors = descriptionError ? { idea: descriptionError } : {};
    const normalized = ideaSubmission(idea, selectedChallenges);
    setErrors(nextErrors);
    setNotice(null);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }
    if (activeJobId) {
      setNotice({
        title: "An evaluation is already in progress",
        message: "Resume checking the saved job before starting another evaluation.",
      });
      return;
    }
    if (!config || !config.field_ready) {
      const unavailableNotice: Notice = {
        title: "Evaluation is unavailable",
        message:
          "The API has not reported a ready field. Your idea description remains in the form, and no request was submitted.",
        action: "refresh-field",
      };
      setNotice(unavailableNotice);
      window.requestAnimationFrame(() => noticeHeading.current?.focus());
      return;
    }

    setIsSubmitting(true);
    setJob(null);
    setSubmittedSubmission(null);
    setPollNotice(null);
    try {
      const nextJob = await submitEvaluation(
        { contract_version: "1.0.0", submission: normalized },
      );
      setJob(nextJob);
      setSubmittedSubmission(normalized);
      saveStoredJobId(nextJob.evaluation_id);
      setActiveJobId(nextJob.evaluation_id);
      setPollingEnabled(nextJob.status === "queued" || nextJob.status === "running");

      if (nextJob.status === "completed" && nextJob.result) {
        removeStoredJobId();
        setActiveJobId(null);
      } else if (nextJob.status === "failed") {
        removeStoredJobId();
        setActiveJobId(null);
      }
    } catch (error: unknown) {
      const details = getApiDetails(error);
      const serverErrors = serverFieldErrors(details);
      setErrors((current) => ({ ...current, ...serverErrors }));
      const nextNotice = getSubmitNotice(error);
      setNotice(nextNotice);
      if (Object.keys(serverErrors).length > 0) focusFirstError(serverErrors);
      else window.requestAnimationFrame(() => noticeHeading.current?.focus());
    } finally {
      setIsSubmitting(false);
    }
  }

  function pauseChecks() {
    setPollingEnabled(false);
    setIsPolling(false);
    setPollNotice({
      title: "Checking paused",
      message:
        "This pauses browser polling only. It does not cancel the server-side evaluation. Resume checks to continue this same job.",
    });
  }

  function resumeChecks() {
    if (!activeJobId) return;
    setPollNotice(null);
    setPollingEnabled(true);
  }

  const mode = challengeMode(config);
  const automaticChallenges = config?.challenges.filter((challenge) => challenge.automatic) ?? [];
  const sponsorChallenges =
    config?.challenges.filter((challenge) => challenge.kind === "sponsor" && !challenge.automatic) ?? [];
  const canSubmit = Boolean(config?.field_ready) && !isSubmitting && !activeJobId;
  const currentSubmission = ideaSubmission(idea, selectedChallenges);
  const reportIsStale =
    submittedSubmission !== null &&
    JSON.stringify(currentSubmission) !== JSON.stringify(submittedSubmission);

  let evaluationStatus = "Ready for a submission";
  if (configLoading && !config) evaluationStatus = "Loading challenge readiness";
  else if (isSubmitting) evaluationStatus = "Submitting once to the evaluation API";
  else if (job?.status === "queued") evaluationStatus = "Evaluation queued; waiting for the API to update it";
  else if (job?.status === "running") evaluationStatus = "Evaluation running; checking for updates";
  else if (job?.status === "completed") evaluationStatus = "Evaluation complete";
  else if (job?.status === "failed") evaluationStatus = "Evaluation failed";
  else if (activeJobId) evaluationStatus = "Reconnecting to the saved evaluation";
  else if (!config?.field_ready) evaluationStatus = "Evaluation unavailable until the field is ready";

  return (
    <main className="app-shell engineering-app">
      <SceneBoundary><Suspense fallback={<p className="scene-fallback glass-panel" role="status">Loading Engineering campus…</p>}>
        <EngineeringExplorer job={job} challenges={config?.challenges ?? []}
          projectName={submittedSubmission?.name ?? "Your idea"}
          category={sceneCategory} onCategory={setSceneCategory} panelsVisible={panelsVisible} isStale={reportIsStale} />
      </Suspense></SceneBoundary>
      <header className="masthead">
        <a href="/" className="wordmark" aria-label="LennyRoasts home" onClick={(event) => { event.preventDefault(); window.history.pushState(null, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); }}>
          <img src="/assets/engineering/lenny-roasts-logo-transparent.png" alt="" />
          Lenny<span>Roasts</span>
        </a>
        <span className="edition">KNIGHT HACKS IX <span aria-hidden="true">/</span> PRACTICE TABLE</span>
        <button type="button" className="secondary-button panel-toggle" aria-expanded={panelsVisible} aria-controls="glass-content" onClick={() => setPanelsVisible((value) => !value)}>{panelsVisible ? "Hide panels" : "Show panels"}</button>
      </header>

      <div className="glass-content" id="glass-content" hidden={!panelsVisible}>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">BEFORE YOU BUILD, TEST THE IDEA</p>
        <h1 id="page-title">Got an idea? Give it a reality check.</h1>
        <p className="lede">
          Explore where your hackathon idea fits, what makes it stand out, and what to build first.
        </p>
      </section>

      <section className={`mode-banner mode-${mode}`} aria-labelledby="mode-heading">
        <div className="mode-copy">
          <span className="mode-indicator" aria-hidden="true" />
          <div>
            <h2 id="mode-heading">{modeLabel(mode)}</h2>
            {mode === "mock" && (
              <p>
                This API version uses deterministic development mock rules. Scores and placements are not live judge results or verified software outcomes.
              </p>
            )}
            {mode === "fixture" && (
              <p>
                The API reports a synthetic fixture version. These values are examples and are not live field results.
              </p>
            )}
            {mode === "live" && (
              <p>
                The API reports a ready, non-mock simulated field. Report counts and placements come from that evaluation response.
              </p>
            )}
            {mode === "unavailable" && (
              <p>
                The API reports that evaluation is not ready. You can prepare the form, but no scoring request will be sent until the field is available.
              </p>
            )}
            {mode === "loading" && <p>Loading challenge definitions and field readiness from the API.</p>}
            {config && (
              <p className="version-line">
                Judge <code>{config.judge_version}</code> <span aria-hidden="true">·</span> Field <code>{config.pool_version}</code>
              </p>
            )}
          </div>
        </div>
        {configError && (
          <div className="config-failure" role="alert">
            <p>{configError.message}</p>
            <button type="button" className="secondary-button" onClick={refreshChallenges}>
              Retry challenge load
            </button>
          </div>
        )}
        {mode === "unavailable" && !configError && (
          <button
            type="button"
            className="secondary-button readiness-retry"
            onClick={refreshChallenges}
            disabled={configLoading}
          >
            {configLoading ? "Refreshing…" : "Refresh field status"}
          </button>
        )}
      </section>

      <div className="workspace">
        <div className="panel-switch glass-panel" role="group" aria-label="Frontend panels">
          <button type="button" aria-pressed={activePanel === "project"} onClick={() => setActivePanel("project")}>Your idea</button>
          <button type="button" aria-pressed={activePanel === "report"} onClick={() => setActivePanel("report")}>Practice report {job?.status === "completed" ? "· ready" : ""}</button>
        </div>
        <section className="form-panel" aria-labelledby="form-heading" hidden={activePanel !== "project"}>
          <div className="section-heading">
            <div>
              <p className="section-kicker">THE STARTING POINT</p>
              <h2 id="form-heading">Your idea</h2>
            </div>
            <button type="button" className="text-button" onClick={loadSample} disabled={Boolean(activeJobId) || isSubmitting}>
              Load sample
            </button>
          </div>

          <p className="form-intro">
            Tell us what you want to build, who it helps, and how it would work. Include tools you’re considering and what you’d show in a first demo. It’s okay if nothing is built yet.
          </p>

          <form onSubmit={submit} noValidate aria-describedby="privacy-copy">
            {notice && (
              <div className="notice notice-error" role="alert">
                <h3 ref={noticeHeading} tabIndex={-1}>{notice.title}</h3>
                <p>{notice.message}</p>
                {notice.details && notice.details.length > 0 && (
                  <ul>{notice.details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul>
                )}
                {notice.action === "refresh-field" && (
                  <button type="button" className="secondary-button" onClick={refreshChallenges}>
                    Refresh field status
                  </button>
                )}
              </div>
            )}

            <fieldset disabled={Boolean(activeJobId) || isSubmitting}>
              <legend className="visually-hidden">Your idea</legend>
              <div className="form-field idea-field">
                <label htmlFor="idea-description">Describe your idea <span className="required-label">Required</span></label>
                <textarea
                  ref={ideaInput}
                  id="idea-description"
                  name="idea"
                  rows={12}
                  value={idea}
                  onChange={(event) => {
                    setIdea(event.target.value);
                    setErrors((current) => ({ ...current, idea: undefined }));
                    setNotice(null);
                  }}
                  placeholder={"I want to build…\n\nIt would help… by…\n\nFor the hackathon, the first demo would…"}
                  aria-invalid={Boolean(errors.idea)}
                  aria-describedby={`hint-idea${errors.idea ? " error-idea" : ""}`}
                />
                <div className="field-meta">
                  <small id="hint-idea">Rough notes, a paragraph, or a pasted pitch — any format works.</small>
                  <span>{Array.from(idea).length.toLocaleString()} / {MAX_IDEA_LENGTH.toLocaleString()}</span>
                </div>
                {errors.idea && <p className="field-error" id="error-idea">{errors.idea}</p>}
              </div>

              <details
                id="sponsor-challenges"
                className="challenge-picker"
                open={errors.challenges ? true : undefined}
                aria-labelledby="sponsor-heading"
                aria-describedby={errors.challenges ? "error-challenges" : undefined}
              >
                <summary id="sponsor-heading">Check sponsor fit <span className="required-label">Optional{selectedChallenges.length ? ` · ${selectedChallenges.length} selected` : ""}</span></summary>
                <p className="muted-copy">Choose the sponsor tools or tracks your idea would use.</p>
                {errors.challenges && <p className="field-error" id="error-challenges">{errors.challenges}</p>}
                {!configLoading && sponsorChallenges.length === 0 && (
                  <p className="muted-copy">No sponsor opt-ins are currently listed by the API.</p>
                )}
                <div className="track-list">
                  {sponsorChallenges.map((challenge) => {
                    const id = challenge.id as Submission["challenges"][number];
                    const checked = selectedChallenges.includes(id);
                    return (
                      <div className="track-item" key={challenge.id}>
                        <label className="track-choice" htmlFor={`track-${challenge.id}`}>
                          <input
                            id={`track-${challenge.id}`}
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedChallenges((current) => event.target.checked
                                ? [...current, id]
                                : current.filter((selected) => selected !== id));
                              setErrors((current) => ({ ...current, challenges: undefined }));
                              setNotice(null);
                            }}
                            aria-describedby={`track-description-${challenge.id}`}
                          />
                          <span className="track-checkmark" aria-hidden="true">{checked ? "Selected" : "Select"}</span>
                          <span className="track-name">{challenge.name}</span>
                        </label>
                        <details className="challenge-description">
                          <summary>Challenge description</summary>
                          <p id={`track-description-${challenge.id}`}>{challenge.description}</p>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </details>
              <p className="automatic-copy">
                Always checked: {automaticChallenges.length > 0
                  ? automaticChallenges.map((challenge) => challenge.name).join(", ")
                  : "loading categories…"}.
              </p>

              <button
                className="submit-button"
                type="submit"
                disabled={!canSubmit}
                aria-describedby="submit-help"
              >
                <span>{isSubmitting ? "Submitting once…" : activeJobId ? "Evaluation already active" : "Evaluate my idea"}</span>
                <span aria-hidden="true">↗</span>
              </button>
              <p id="submit-help" className="submit-help">
                {activeJobId
                  ? "Resume the saved evaluation in the report panel. A second job cannot be started while it is active."
                  : !config?.field_ready
                    ? "The API must report a ready field before an evaluation can be submitted."
                    : "One description is enough to get started."}
              </p>
            </fieldset>
          </form>

          <p className="privacy-copy" id="privacy-copy">
            Evaluations are private to the requesting browser session. The current mock keeps job data in server memory; live retention details depend on the backend service.
          </p>
        </section>

        <section className="report-panel" aria-labelledby="report-heading" hidden={activePanel !== "report"}>
          <div className="section-heading report-heading-row">
            <div>
              <p className="section-kicker">EVALUATION REPORT</p>
              <h2 id="report-heading" ref={reportHeading} tabIndex={-1}>Practice report</h2>
            </div>
            <span className={`status-chip status-${job ? job.status : mode}`}>
              {job?.status ?? modeLabel(mode)}
            </span>
          </div>

          <p className="evaluation-status" role="status" aria-live="polite">
            {isPolling && <span className="working-indicator" aria-hidden="true" />}
            {evaluationStatus}
            {activeJobId && <code className="job-id">Job ID: {activeJobId}</code>}
          </p>

          {pollNotice && (
            <div className="notice notice-info" role="status">
              <h3>{pollNotice.title}</h3>
              <p>{pollNotice.message}</p>
              {pollNotice.details && pollNotice.details.length > 0 && (
                <ul>{pollNotice.details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul>
              )}
              {activeJobId && !pollingEnabled && (
                <button type="button" className="secondary-button" onClick={resumeChecks}>
                  Resume checks
                </button>
              )}
            </div>
          )}

          {activeJobId && pollingEnabled && (
            <button type="button" className="text-button pause-button" onClick={pauseChecks}>
              Pause browser checks
            </button>
          )}

          {job?.status === "failed" && (
            <div className="notice notice-error" role="alert">
              <h3>Evaluation failed</h3>
              <p>{job.error?.message ?? "The API reported a terminal failure."}</p>
              {job.error?.details && job.error.details.length > 0 && (
                <ul>{job.error.details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul>
              )}
              <p>Your idea description is still in the form. This failed job has no report; submit again only when you decide to start a new evaluation.</p>
            </div>
          )}

          {job?.status === "completed" && job.result && (
            <div className="report-results">
              <div className={`result-mode mode-${jobMode(job, config)}`}>
                <strong>{modeLabel(jobMode(job, config))}</strong>
                {jobMode(job, config) === "mock" && (
                  <p>These are input-dependent mock scores against synthetic competitors. They are not Qwen judgments or live results.</p>
                )}
                {jobMode(job, config) === "live" && (
                  <p>Practice ranks use the simulated field captured by this job. They are not win probability or a forecast of real event results.</p>
                )}
                {jobMode(job, config) === "fixture" && (
                  <p>This response is a synthetic fixture. It is not a user's scored report.</p>
                )}
                <p className="version-line">
                  Judge <code>{job.judge_version}</code> <span aria-hidden="true">·</span> Field <code>{job.pool_version}</code>
                </p>
              </div>

              {reportIsStale && (
                <p className="stale-report-note" role="status">
                  The form has changed. This report belongs to the last submitted version of the idea description.
                </p>
              )}

              <p className="report-explanation">
                Scores and ranks below are returned by the API. Placement ranges include run-to-run variation and ties within the simulated field; they are not win probabilities or statistical confidence intervals. Feedback is based on your description. Functionality reflects described implementation; planned features are not treated as proof of a working build.
              </p>

              <div className="report-cards">
                {job.result.challenge_results.map((result) => (
                  <ReportCard
                    key={result.challenge_id}
                    result={result}
                    challenge={config?.challenges.find((challenge) => challenge.id === result.challenge_id)}
                    selected={sceneCategory === result.challenge_id || (!sceneCategory && result === job.result?.challenge_results[0])}
                    onShowInScene={() => { setSceneCategory(result.challenge_id); setPanelsVisible(false); }}
                  />
                ))}
              </div>
            </div>
          )}

          {!job && !activeJobId && !pollNotice && (
            <div className="empty-report">
              <p className="empty-label">Your report will appear here</p>
              <h3>A rough idea is a good start.</h3>
              <p>Describe what you’re thinking of building, or load the sample idea to try the flow.</p>
            </div>
          )}

          {job?.status !== "completed" && job?.status !== "failed" && activeJobId && !pollNotice && (
            <div className="processing-panel" aria-hidden="true">
              <span className="processing-line" />
              <strong>{job?.status === "queued" ? "Queued for evaluation" : "Waiting for the evaluation"}</strong>
              <p>Checking the same job for an update. No completion time is guaranteed.</p>
            </div>
          )}
        </section>
      </div>

      <footer className="page-footer">
        <span>KNIGHT HACKS IX</span>
        <span>TEXT-ONLY PRACTICE · SIMULATED FIELD · NOT A REAL-WINNER PREDICTION</span>
      </footer>
      </div>
    </main>
  );
}
