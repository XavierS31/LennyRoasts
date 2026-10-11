import { useEffect, useRef, useState, type FormEvent } from "react";
import fixtures from "../../contracts/fixtures.json";
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

type TextField =
  | "name"
  | "tagline"
  | "inspiration"
  | "what_it_does"
  | "how_we_built_it"
  | "challenges_we_ran_into"
  | "accomplishments"
  | "what_we_learned"
  | "whats_next";
type ErrorField = TextField | "built_with" | "challenges";
type FormErrors = Partial<Record<ErrorField, string>>;
type Notice = {
  title: string;
  message: string;
  details?: string[];
  kind?: "error" | "info";
  action?: "refresh-field";
};
type ServiceMode = "loading" | "unavailable" | "mock" | "fixture" | "live";

const JOB_STORAGE_KEY = "lennyroasts.active-evaluation";
const MAX_AUTOMATIC_POLL_MS = 5 * 60 * 1000;
const MAX_TAGS = 30;
const MAX_TAG_LENGTH = 80;

const textFields: Array<{ key: TextField; label: string; hint: string }> = [
  {
    key: "inspiration",
    label: "Inspiration",
    hint: "What need or moment led you to build this?",
  },
  {
    key: "what_it_does",
    label: "What it does",
    hint: "Describe the features that are built and working.",
  },
  {
    key: "how_we_built_it",
    label: "How we built it",
    hint: "Name the tools and explain how the parts connect.",
  },
  {
    key: "challenges_we_ran_into",
    label: "Challenges we ran into",
    hint: "What did not work yet, or what was difficult?",
  },
  {
    key: "accomplishments",
    label: "Accomplishments",
    hint: "What did the team finish during the event?",
  },
  {
    key: "what_we_learned",
    label: "What we learned",
    hint: "What did you learn about the problem or your approach?",
  },
  {
    key: "whats_next",
    label: "What’s next",
    hint: "Keep future plans separate from what is already built.",
  },
];

const fieldOrder: TextField[] = [
  "name",
  "tagline",
  ...textFields.map(({ key }) => key),
];

const fieldLabels: Record<TextField, string> = {
  name: "Project name",
  tagline: "Tagline",
  inspiration: "Inspiration",
  what_it_does: "What it does",
  how_we_built_it: "How we built it",
  challenges_we_ran_into: "Challenges we ran into",
  accomplishments: "Accomplishments",
  what_we_learned: "What we learned",
  whats_next: "What’s next",
};

const emptySubmission: Submission = {
  name: "",
  tagline: "",
  inspiration: "",
  what_it_does: "",
  how_we_built_it: "",
  challenges_we_ran_into: "",
  accomplishments: "",
  what_we_learned: "",
  whats_next: "",
  built_with: [],
  challenges: [],
};

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

function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeSubmission(submission: Submission, tagText: string): Submission {
  return {
    ...submission,
    built_with: parseTags(tagText),
    challenges: [...submission.challenges],
  };
}

function validateSubmission(
  submission: Submission,
  tagText: string,
): { errors: FormErrors; normalized: Submission } {
  const normalized = normalizeSubmission(submission, tagText);
  const errors: FormErrors = {};

  for (const field of fieldOrder) {
    const value = submission[field];
    const characterLimit = field === "name" ? 100 : field === "tagline" ? 139 : 8000;
    if (!value.trim()) {
      errors[field] = `${fieldLabels[field]} is required.`;
    } else if (Array.from(value).length > characterLimit) {
      errors[field] = `Use ${characterLimit} characters or fewer.`;
    }
  }

  const tags = normalized.built_with;
  if (tags.length === 0) {
    errors.built_with = "Add at least one technology tag.";
  } else if (tags.length > MAX_TAGS) {
    errors.built_with = `Use no more than ${MAX_TAGS} unique technology tags.`;
  } else if (tags.some((tag) => Array.from(tag).length > MAX_TAG_LENGTH)) {
    errors.built_with = `Each technology tag must be ${MAX_TAG_LENGTH} characters or fewer.`;
  }

  if (new Set(submission.challenges).size !== submission.challenges.length) {
    errors.challenges = "Each sponsor challenge can only be selected once.";
  }

  return { errors, normalized };
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
  return field === "built_with"
    ? "built-with"
    : field === "challenges"
      ? "sponsor-challenges"
      : `submission-${field}`;
}

function serverFieldErrors(details: string[]): FormErrors {
  const errors: FormErrors = {};
  for (const detail of details) {
    const field = fieldOrder.find((candidate) =>
      new RegExp(`(?:submission\\.)?${candidate}(?:\\b|\\[)`, "i").test(detail),
    );
    if (field) errors[field] = detail;
    else if (/built_with/i.test(detail)) errors.built_with = detail;
    else if (/challenges/i.test(detail)) errors.challenges = detail;
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
        "The field or scoring service is not ready. Your project is still in this form, and no report was created.",
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
      "The request did not return an evaluation ID, so no automatic retry was made. Keep your write-up here and choose when to submit again.",
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
    return <p className="evidence-missing">Not described in the write-up.</p>;
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
}: {
  result: ChallengeResult;
  challenge?: Challenge;
}) {
  const evidenceEntries = criterionLabels
    .map(([key, label]) => [label, result.evidence[key]] as const)
    .filter(([, value]) => value !== undefined);
  const placementText = rankText(result);

  return (
    <article className="report-card">
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
          <h4>Ways to strengthen the write-up</h4>
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
        <summary>Evidence from the write-up</summary>
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
  const [submission, setSubmission] = useState<Submission>(emptySubmission);
  const [tags, setTags] = useState("");
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
                "The job ID is unknown, expired, or belongs to another browser session. No replacement evaluation was created. Review your write-up and submit again only if you choose to.",
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
    if (job?.status === "completed" || job?.status === "failed") {
      window.requestAnimationFrame(() => reportHeading.current?.focus());
    }
  }, [job?.status]);

  function loadSample() {
    setSubmission(structuredClone(fixtures.request.submission) as Submission);
    setTags(fixtures.request.submission.built_with.join(", "));
    setJob(null);
    setSubmittedSubmission(null);
    setErrors({});
    setNotice(null);
    setPollNotice(null);
  }

  function updateTextField(field: TextField, value: string) {
    setSubmission((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  }

  function focusFirstError(nextErrors: FormErrors) {
    const focusOrder: ErrorField[] = [...fieldOrder, "built_with", "challenges"];
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
    const { errors: nextErrors, normalized } = validateSubmission(submission, tags);
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
          "The API has not reported a ready field. Your write-up remains in the form, and no request was submitted.",
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
  const currentSubmission = normalizeSubmission(submission, tags);
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
    <main className="app-shell">
      <header className="masthead">
        <a href="/" className="wordmark" aria-label="LennyRoasts home">
          Lenny<span>Roasts</span>
        </a>
        <span className="edition">KNIGHT HACKS IX <span aria-hidden="true">/</span> PRACTICE TABLE</span>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">A PRACTICE FIELD FOR YOUR DEVPOST WRITE-UP</p>
        <h1 id="page-title">See how your hack reads in the field.</h1>
        <p className="lede">
          Share the project details, then review scores and placement ranges for each category.
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
        <section className="form-panel" aria-labelledby="form-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">PROJECT WRITE-UP</p>
              <h2 id="form-heading">Your project</h2>
            </div>
            <button type="button" className="text-button" onClick={loadSample} disabled={Boolean(activeJobId) || isSubmitting}>
              Load sample
            </button>
          </div>

          <p className="form-intro">
            Use the details you would put on Devpost. Explain what works today and what is still planned.
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
              <legend className="visually-hidden">Project details</legend>
              <div className="form-field">
                <label htmlFor="submission-name">Project name <span className="required-label">Required</span></label>
                <input
                  id="submission-name"
                  name="name"
                  autoComplete="off"
                  maxLength={100}
                  value={submission.name}
                  onChange={(event) => updateTextField("name", event.target.value)}
                  placeholder="Campus Queue"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "error-name" : "hint-name"}
                />
                <div className="field-meta">
                  <small id="hint-name">A short title for your entry.</small>
                  <span>{Array.from(submission.name).length} / 100</span>
                </div>
                {errors.name && <p className="field-error" id="error-name">{errors.name}</p>}
              </div>

              <div className="form-field">
                <label htmlFor="submission-tagline">Tagline <span className="required-label">Required</span></label>
                <input
                  id="submission-tagline"
                  name="tagline"
                  maxLength={139}
                  value={submission.tagline}
                  onChange={(event) => updateTextField("tagline", event.target.value)}
                  placeholder="Explain campus shuttle delays using sample data."
                  aria-invalid={Boolean(errors.tagline)}
                  aria-describedby={errors.tagline ? "error-tagline" : "hint-tagline"}
                />
                <div className="field-meta">
                  <small id="hint-tagline">One line about the problem and approach.</small>
                  <span>{Array.from(submission.tagline).length} / 139</span>
                </div>
                {errors.tagline && <p className="field-error" id="error-tagline">{errors.tagline}</p>}
              </div>

              <div className="write-up-fields">
                {textFields.map(({ key, label, hint }) => (
                  <div className="form-field" key={key}>
                    <label htmlFor={`submission-${key}`}>{label} <span className="required-label">Required</span></label>
                    <textarea
                      id={`submission-${key}`}
                      name={key}
                      maxLength={8000}
                      rows={4}
                      value={submission[key]}
                      onChange={(event) => updateTextField(key, event.target.value)}
                      placeholder={hint}
                      aria-invalid={Boolean(errors[key])}
                      aria-describedby={errors[key] ? `error-${key}` : `hint-${key}`}
                    />
                    <div className="field-meta">
                      <small id={`hint-${key}`}>{hint}</small>
                      <span>{Array.from(submission[key]).length} / 8,000</span>
                    </div>
                    {errors[key] && <p className="field-error" id={`error-${key}`}>{errors[key]}</p>}
                  </div>
                ))}
              </div>

              <div className="form-field">
                <label htmlFor="built-with">Built with <span className="required-label">Required</span></label>
                <input
                  id="built-with"
                  name="built_with"
                  value={tags}
                  onChange={(event) => {
                    setTags(event.target.value);
                    setErrors((current) => ({ ...current, built_with: undefined }));
                    setNotice(null);
                  }}
                  placeholder="react, python, gemini"
                  aria-invalid={Boolean(errors.built_with)}
                  aria-describedby={errors.built_with ? "error-built-with" : "hint-built-with"}
                />
                <div className="field-meta">
                  <small id="hint-built-with">Separate tags with commas. Repeated tags are sent once.</small>
                  <span>{parseTags(tags).length} / {MAX_TAGS} unique</span>
                </div>
                {errors.built_with && <p className="field-error" id="error-built-with">{errors.built_with}</p>}
              </div>

              <section
                className="challenge-picker"
                aria-labelledby="sponsor-heading"
                aria-describedby={errors.challenges ? "error-challenges" : undefined}
              >
                <div className="challenge-picker-heading">
                  <div>
                    <h3 id="sponsor-heading">Sponsor challenges</h3>
                    <p>Choose the sponsor tracks your team entered. Leaving them all clear is okay.</p>
                  </div>
                </div>
                {errors.challenges && <p className="field-error" id="error-challenges">{errors.challenges}</p>}
                {!configLoading && sponsorChallenges.length === 0 && (
                  <p className="muted-copy">No sponsor opt-ins are currently listed by the API.</p>
                )}
                <div className="track-list">
                  {sponsorChallenges.map((challenge) => {
                    const id = challenge.id as Submission["challenges"][number];
                    const checked = submission.challenges.includes(id);
                    return (
                      <div className="track-item" key={challenge.id}>
                        <label className="track-choice" htmlFor={`track-${challenge.id}`}>
                          <input
                            id={`track-${challenge.id}`}
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSubmission((current) => ({
                                ...current,
                                challenges: event.target.checked
                                  ? [...current.challenges, id]
                                  : current.challenges.filter((selected) => selected !== id),
                              }));
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
                <p className="automatic-copy">
                  Automatically included: {automaticChallenges.length > 0
                    ? automaticChallenges.map((challenge) => challenge.name).join(", ")
                    : "no automatic categories are listed by the API"}.
                  These are not sent as sponsor opt-ins.
                </p>
                {automaticChallenges.map((challenge) => (
                  <details className="challenge-description general-description" key={challenge.id}>
                    <summary>{challenge.name} description</summary>
                    <p>{challenge.description}</p>
                  </details>
                ))}
              </section>

              <button
                className="submit-button"
                type="submit"
                disabled={!canSubmit}
                aria-describedby="submit-help"
              >
                <span>{isSubmitting ? "Submitting once…" : activeJobId ? "Evaluation already active" : "Evaluate this write-up"}</span>
                <span aria-hidden="true">↗</span>
              </button>
              <p id="submit-help" className="submit-help">
                {activeJobId
                  ? "Resume the saved evaluation in the report panel. A second job cannot be started while it is active."
                  : !config?.field_ready
                    ? "The API must report a ready field before an evaluation can be submitted."
                    : "This sends the fields above once to the same-origin API."}
              </p>
            </fieldset>
          </form>

          <p className="privacy-copy" id="privacy-copy">
            Evaluations are private to the requesting browser session. The current mock keeps job data in server memory; live retention details depend on the backend service.
          </p>
        </section>

        <section className="report-panel" aria-labelledby="report-heading">
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
              <p>Your write-up is still in the form. This failed job has no report; submit again only when you decide to start a new evaluation.</p>
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
                  The form has changed. This report belongs to the last submitted version of the write-up.
                </p>
              )}

              <p className="report-explanation">
                Scores and ranks below are returned by the API. Placement ranges include run-to-run variation and ties within the simulated field; they are not win probabilities or statistical confidence intervals. Feedback is based on the write-up only; software execution has not been verified.
              </p>

              <div className="report-cards">
                {job.result.challenge_results.map((result) => (
                  <ReportCard
                    key={result.challenge_id}
                    result={result}
                    challenge={config?.challenges.find((challenge) => challenge.id === result.challenge_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {!job && !activeJobId && !pollNotice && (
            <div className="empty-report">
              <p className="empty-label">Your report will appear here</p>
              <h3>Start with the write-up you have.</h3>
              <p>Load Campus Queue to explore the flow, or enter your own project. The API calculates each placement after submission.</p>
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
    </main>
  );
}
