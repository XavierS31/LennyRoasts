import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { NotebookIcon, ChartBarIcon, CheckIcon, PlusIcon } from "@phosphor-icons/react";
import sampleIdea from "../demo/campus-queue.txt?raw";
import SceneBoundary from "./components/engineering/SceneBoundary";
import { sceneLocation, scenePath, type LocationState } from "./components/engineering/navigation";
import { sponsorRoom, type SponsorRoomId } from "./components/engineering/classroomLayout";
import type { SceneController } from "./components/engineering/EngineeringScene";
import { ideaError, ideaSubmission, MAX_IDEA_LENGTH } from "./ideaSubmission";
import IdeaFileImport from "./components/IdeaFileImport";
import AtriumDashboard from "./components/AtriumDashboard";
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
type IdeaInputMode = "describe" | "import";
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
  const [panelsVisible, setPanelsVisible] = useState(() => sceneLocation(new URL(window.location.href)).kind === "campus");
  const [location, setLocation] = useState(() => sceneLocation(new URL(window.location.href)));
  const [entering, setEntering] = useState(false);
  const sceneController = useRef<SceneController | null>(null);
  const sceneTransition = useRef(0);
  const [sceneCategory, setSceneCategory] = useState("");
  const [ceremonyRun, setCeremonyRun] = useState(0);
  const [idea, setIdea] = useState("");
  const [ideaInputMode, setIdeaInputMode] = useState<IdeaInputMode>("describe");
  const [isImporting, setIsImporting] = useState(false);
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
  const entryHeading = useRef<HTMLHeadingElement>(null);
  const noticeHeading = useRef<HTMLHeadingElement>(null);
  const ideaInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const back = () => {
      sceneTransition.current++;
      setEntering(false);
      const next = sceneLocation(new URL(window.location.href));
      setLocation(next);
      setPanelsVisible(next.kind === "campus");
    };
    window.addEventListener("popstate", back);
    return () => { sceneTransition.current++; window.removeEventListener("popstate", back); };
  }, []);

  function navigate(kind: LocationState["kind"], building = location.building, sponsor?: SponsorRoomId) {
    sceneTransition.current++;
    setEntering(false);
    const next: LocationState = kind === "classroom" ? { kind, building, sponsor: sponsor ?? "gemini" } : { kind, building };
    window.history.pushState(null, "", scenePath(next));
    setLocation(next);
    setPanelsVisible(kind === "campus");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openClassroom(id: SponsorRoomId) {
    setSceneCategory(id);
    navigate("classroom", location.building, id);
  }

  function pitchInClassroom() {
    const id = sponsorRoom(location.sponsor).id;
    // Opt in only when the student chooses to pitch, and preserve other choices.
    if (id !== "overall" && !activeJobId && !isSubmitting) setSelectedChallenges((current) => current.includes(id) ? current : [...current, id]);
    setIdeaInputMode("describe");
    setPanelsVisible(true);
    window.requestAnimationFrame(() => ideaInput.current?.focus());
  }

  async function enterBuilding(building = location.building) {
    const token = ++sceneTransition.current;
    setEntering(true);
    await sceneController.current?.command("enter", building);
    if (token === sceneTransition.current) navigate("atrium", building);
  }

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
    if ((job || activeJobId || pollNotice) && (location.kind === "campus" || job?.status === "failed")) {
      setPanelsVisible(true);
    }
  }, [job?.evaluation_id, job?.status, activeJobId, pollNotice]);

  useEffect(() => {
    if (job?.status === "completed" && job.result) {
      navigate("atrium"); setPanelsVisible(true);
    }
  }, [job?.evaluation_id, job?.status]);

  useEffect(() => {
    if (notice) {
      if (location.kind !== "classroom") navigate("campus");
      setPanelsVisible(true);
    }
  }, [notice]);

  useEffect(() => {
    if (location.kind === "atrium" && panelsVisible && (job?.status === "completed" || job?.status === "failed")) {
      window.requestAnimationFrame(() => reportHeading.current?.focus());
    } else if (location.kind === "campus" && job?.status === "completed") {
      window.requestAnimationFrame(() => entryHeading.current?.focus());
    }
  }, [job?.status, location.kind, panelsVisible]);

  function loadSample() {
    setIdea(sampleIdea.trim());
    setSelectedChallenges(location.kind === "classroom" && location.sponsor && location.sponsor !== "gemini" && location.sponsor !== "overall" ? ["gemini", location.sponsor] : ["gemini"]);
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
    if (location.kind !== "campus" && location.kind !== "classroom") navigate("campus");
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
    if (isImporting || isSubmitting) return;
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
  const canSubmit = Boolean(config?.field_ready) && !isSubmitting && !activeJobId && !isImporting;
  const currentSubmission = ideaSubmission(idea, selectedChallenges);
  const reportIsStale =
    submittedSubmission !== null &&
    JSON.stringify(currentSubmission) !== JSON.stringify(submittedSubmission);

  const reportResults = job?.status === "completed" ? job.result?.challenge_results ?? [] : [];
  const dashboardResult = reportResults.find((entry) => entry.challenge_id === sceneCategory) ?? reportResults.find((entry) => entry.challenge_id === "overall") ?? reportResults[0];

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
    <main className={`app-shell engineering-app view-${location.kind} ${dashboardResult ? "has-completed-report" : ""}`}>
      <SceneBoundary><Suspense fallback={<p className="scene-fallback glass-panel" role="status">Loading {location.kind === "awards" ? "Cape Ballroom" : "Engineering campus"}…</p>}>
        <EngineeringExplorer job={job} challenges={config?.challenges ?? []}
          projectName={submittedSubmission?.name ?? "Your idea"}
          category={sceneCategory} onCategory={setSceneCategory} panelsVisible={panelsVisible} isStale={reportIsStale}
          location={location} controller={sceneController}
          onSponsor={openClassroom} onReturnAtrium={() => navigate("atrium")}
          onPitch={pitchInClassroom}
          onViewReport={() => { navigate("atrium"); setPanelsVisible(true); }} ceremonyRun={ceremonyRun}
          onBuilding={(building) => setLocation((current) => ({ ...current, building }))} />
      </Suspense></SceneBoundary>
      <header className="masthead">
        <a href="/" className="wordmark" aria-label="LennyRoasts home" onClick={(event) => { event.preventDefault(); navigate("campus"); }}>
          <span className="wordmark-crop"><img src="/assets/engineering/lenny-roasts-logo-transparent.png" alt="Lenny Roasts" /></span>
        </a>
        <nav className="scene-tabs" aria-label="Explore UCF rooms and buildings">
          <button type="button" aria-label="Exterior" aria-pressed={location.kind === "campus"} onClick={() => navigate("campus")}>Exterior</button>
          <button type="button" aria-label="Atrium" aria-pressed={location.kind === "atrium"} onClick={() => navigate("atrium", "Engineering II")}>Atrium</button>
          <button type="button" aria-label="Awards" aria-pressed={location.kind === "awards"} onClick={() => navigate("awards")}>Awards</button>
        </nav>
        {location.kind !== "awards" && <button type="button" className="secondary-button panel-toggle" aria-label={location.kind === "atrium" ? "Judging report" : location.kind === "classroom" ? "Pitch panel" : "Idea panel"} title={location.kind === "atrium" ? "Judging report" : location.kind === "classroom" ? "Pitch panel" : "Idea panel"} aria-expanded={panelsVisible} aria-controls="glass-content" onClick={() => { if (location.kind === "classroom" && !panelsVisible) pitchInClassroom(); else setPanelsVisible((value) => !value); }}>{location.kind === "atrium" ? <ChartBarIcon size={23} weight="light" aria-hidden="true" /> : <NotebookIcon size={23} weight="light" aria-hidden="true" />}</button>}
      </header>

      <div className="glass-content" id="glass-content" hidden={!panelsVisible}>
      <section className="intro" aria-label={location.kind === "campus" ? "Project introduction and service status" : "Service status"} hidden={location.kind === "awards" || (location.kind === "atrium" && Boolean(dashboardResult))}>
        <h1 id="page-title" hidden={location.kind !== "campus"}><span className="welcome-prefix">Welcome to</span><img className="hackathon-logo" src="/assets/engineering/knight-hacks-logo-inline-black.png" alt="Knight Hacks" /></h1>

      <div className="service-status-row">
      <details className={`mode-banner mode-${mode}`} hidden={location.kind === "awards"}>
        <summary>
          <span><span className="service-label">Service status</span><span className="service-value">{configLoading ? "Loading API…" : configError || !config || mode === "unavailable" ? "API unavailable" : mode === "mock" ? "Mock API" : mode === "fixture" ? "Fixture API" : "Judge API ready"}</span></span>
        </summary>
        <div className="mode-copy">
          <span className="mode-indicator" aria-hidden="true" />
          <div>
            {configLoading ? <p>Loading challenge information. You can keep preparing your project below.</p> : configError ? <p>Challenge information could not be loaded. Retry to check the service again.</p> : null}
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
            {config && (
              <p className="version-line">
                Judge <code>{config.judge_version}</code> <span aria-hidden="true">·</span> Field <code>{config.pool_version}</code>
              </p>
            )}
          </div>
        </div>
      </details>
      {(configLoading || configError || mode === "unavailable") &&
        <button type="button" className="text-button service-retry" onClick={refreshChallenges} disabled={configLoading} aria-busy={configLoading}>
          Reload
        </button>
      }
      {configError && <small className="compact-api-error" role="alert">{configError.message}</small>}
      </div>
      </section>

      <div className="workspace">
        {(job || activeJobId || pollNotice) && location.kind !== "awards" && !(location.kind === "atrium" && dashboardResult) && <section className="submission-status glass-panel" aria-label="Submission status">
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

          {job?.status === "completed" && job.result && location.kind === "campus" && <div className="enter-results">
            <h2 ref={entryHeading} tabIndex={-1}>Your results are ready.</h2>
            <p>Enter Engineering II to see your placement, competition, and judging feedback.</p>
            <button type="button" className="submit-button" disabled={entering} onClick={() => void enterBuilding("Engineering II")}>
              {entering ? "Entering Engineering II…" : "Enter Engineering II ↗"}
            </button>
          </div>}
        </section>}
        <section className="form-panel" aria-labelledby="form-heading" hidden={location.kind !== "campus" && location.kind !== "classroom"}>
          <div className="section-heading">
            <div>
              <h2 id="form-heading">{location.kind === "classroom" ? `Pitch to ${sponsorRoom(location.sponsor).name} Lenny` : "Let Lenny roast your project"}</h2>
            </div>
            <button type="button" className="text-button" onClick={loadSample} disabled={Boolean(activeJobId) || isSubmitting || isImporting}>
              Try a sample
            </button>
          </div>

          {location.kind === "classroom" && <p className="classroom-track-note">{location.sponsor === "overall" ? "Overall judging is included automatically." : location.sponsor && selectedChallenges.includes(location.sponsor) ? `The ${sponsorRoom(location.sponsor).name} track is included in your sponsor choices.` : `Add the ${sponsorRoom(location.sponsor).name} track below to include this sponsor.`} Describe your product below.</p>}

          <form onSubmit={submit} noValidate>
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
              <div className="idea-input-modes" role="group" aria-label="Choose how to add your idea">
                <button type="button" aria-pressed={ideaInputMode === "describe"}
                  aria-controls="idea-description-panel" disabled={isImporting}
                  onClick={() => setIdeaInputMode("describe")}>Describe your idea</button>
                <button type="button" aria-pressed={ideaInputMode === "import"}
                  aria-controls="idea-import-panel" disabled={isImporting}
                  onClick={() => setIdeaInputMode("import")}>Import notes</button>
              </div>
              <div id="idea-description-panel" className="idea-input-panel" hidden={ideaInputMode !== "describe"}>
                <div className="form-field idea-field">
                  <label className="visually-hidden" htmlFor="idea-description">Describe your idea</label>
                  <textarea
                    ref={ideaInput}
                    id="idea-description"
                    name="idea"
                    rows={8}
                    disabled={isImporting}
                    value={idea}
                    onChange={(event) => {
                      setIdea(event.target.value);
                      setErrors((current) => ({ ...current, idea: undefined }));
                      setNotice(null);
                    }}
                    placeholder={"I want to build…\n\nIt would help… by…\n\nFor the hackathon, the first demo would…"}
                    aria-required="true"
                    aria-invalid={Boolean(errors.idea)}
                    aria-describedby={`hint-idea${errors.idea ? " error-idea" : ""}`}
                  />
                  <div className="field-meta">
                    <small id="hint-idea">Rough notes are welcome.</small>
                    <span>{Array.from(idea).length.toLocaleString()} / {MAX_IDEA_LENGTH.toLocaleString()}</span>
                  </div>
                  {errors.idea && <p className="field-error" id="error-idea">{errors.idea}</p>}
                </div>
              </div>
              <div id="idea-import-panel" className="idea-input-panel" hidden={ideaInputMode !== "import"}>
                <IdeaFileImport idea={idea} disabled={Boolean(activeJobId) || isSubmitting}
                  onBusyChange={setIsImporting} onImport={(text) => {
                    setIdea(text);
                    setIdeaInputMode("describe");
                    setErrors((current) => ({ ...current, idea: undefined }));
                    setNotice(null);
                    window.requestAnimationFrame(() => { ideaInput.current?.focus(); if (ideaInput.current) ideaInput.current.scrollTop = 0; });
                  }} />
              </div>

              <details
                id="sponsor-challenges"
                className="challenge-picker"
                aria-labelledby="sponsor-heading"
                aria-describedby={errors.challenges ? "error-challenges" : undefined}
              >
                <summary id="sponsor-heading">Sponsor tracks <span className="required-label">Optional{selectedChallenges.length ? ` · ${selectedChallenges.length} selected` : ""}</span></summary>
                <p className="muted-copy">Choose the tools your idea would use.</p>
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
                          <span className="track-checkmark" aria-hidden="true">{checked ? <CheckIcon size={18} weight="light" /> : <PlusIcon size={18} weight="light" />}</span>
                          <span className="track-name">{challenge.name}</span>
                        </label>
                        <details className="challenge-description">
                          <summary>Details</summary>
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
              >
                <span>{isSubmitting ? "Submitting…" : activeJobId ? "Evaluation active" : "Evaluate idea"}</span>
                <span aria-hidden="true">↗</span>
              </button>
            </fieldset>
          </form>
        </section>

        <section className="report-panel" aria-labelledby="report-heading" hidden={location.kind !== "atrium"}>
          {!dashboardResult && <div className="section-heading report-heading-row">
            <div>
              <h2 id="report-heading" ref={reportHeading} tabIndex={-1}>Your judging report</h2>
            </div>
            <span className={`status-chip status-${job ? job.status : mode}`}>
              {job?.status ?? modeLabel(mode)}
            </span>
          </div>}

          {job?.status === "completed" && dashboardResult && (
            <div className="report-results">
              <AtriumDashboard headingRef={reportHeading} notice={<>
                <details className="dashboard-mode-note"><summary>{jobMode(job, config) === "mock" ? "Mock scores · synthetic practice field" : jobMode(job, config) === "fixture" ? "Synthetic fixture · example results" : "Simulated practice field"}</summary><p>Ratings reflect your submitted description. Practice placements are not predictions of real event results.</p></details>
                {reportIsStale && <p className="stale-report-note" role="status">The idea has changed. This report is for your last submitted version.</p>}
              </>} result={dashboardResult} results={reportResults} challenges={config?.challenges ?? []}
                projectName={submittedSubmission?.name ?? "Your idea"} onCategory={setSceneCategory}
                onRevise={() => { navigate("campus"); window.requestAnimationFrame(() => ideaInput.current?.focus()); }}
                onAgent={(id) => { setPanelsVisible(false); window.requestAnimationFrame(() => { void sceneController.current?.command("focus", id); }); }}
                onCeremonies={() => { setCeremonyRun((run) => run + 1); navigate("awards"); }}>
                <details className="dashboard-scoring-details">
                  <summary>Scoring details and evidence</summary>
                  <p className="version-line">Judge <code>{job.judge_version}</code> · Field <code>{job.pool_version}</code></p>
                  <ReportCard result={dashboardResult} challenge={config?.challenges.find((challenge) => challenge.id === dashboardResult.challenge_id)} selected={true}
                    onShowInScene={() => { setSceneCategory(dashboardResult.challenge_id); setPanelsVisible(false); }} />
                </details>
              </AtriumDashboard>
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

      <footer className="page-footer" hidden={location.kind === "awards" || (location.kind === "atrium" && Boolean(dashboardResult))}>
        <span>Lenny acts as your hackathon judges for Knight Hacks IX.</span>
        <span>TEXT-ONLY PRACTICE · SIMULATED FIELD · NOT A REAL-WINNER PREDICTION</span>
      </footer>
      </div>
    </main>
  );
}
