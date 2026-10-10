import { useEffect, useRef, useState, type FormEvent } from "react";
import fixtures from "../../contracts/fixtures.json";
import {
  getChallenges,
  getEvaluation,
  submitEvaluation,
  type ChallengeList,
  type EvaluationJob,
  type Submission,
} from "./api/client";

const textFields = [
  ["inspiration", "Inspiration"],
  ["what_it_does", "What it does"],
  ["how_we_built_it", "How we built it"],
  ["challenges_we_ran_into", "Challenges we ran into"],
  ["accomplishments", "Accomplishments"],
  ["what_we_learned", "What we learned"],
  ["whats_next", "What’s next"],
] as const;
const empty: Submission = {
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

export default function App() {
  const [submission, setSubmission] = useState<Submission>(empty);
  const [tags, setTags] = useState("");
  const [config, setConfig] = useState<ChallengeList>();
  const [job, setJob] = useState<EvaluationJob>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getChallenges(controller.signal)
      .then(setConfig)
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => {
      controller.abort();
      activeRequest.current?.abort();
    };
  }, []);

  function loadSample() {
    setSubmission(structuredClone(fixtures.request.submission) as Submission);
    setTags(fixtures.request.submission.built_with.join(", "));
    setJob(undefined);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setJob(undefined);
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const deadline = window.setTimeout(() => controller.abort(), 120_000);
    try {
      const normalized = {
        ...submission,
        built_with: [
          ...new Set(
            tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ],
      };
      let next = await submitEvaluation(
        { contract_version: "1.0.0", submission: normalized },
        controller.signal,
      );
      setJob(next);
      while (next.status === "queued" || next.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 800));
        next = await getEvaluation(next.evaluation_id, controller.signal);
        setJob(next);
      }
      if (next.status === "failed")
        throw new Error(next.error?.message || "Evaluation failed.");
    } catch (err) {
      setError(
        controller.signal.aborted
          ? "Evaluation timed out. Please retry."
          : err instanceof Error
            ? err.message
            : "Evaluation failed.",
      );
    } finally {
      window.clearTimeout(deadline);
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="masthead">
        <a href="/" className="wordmark">
          Lenny<span>Roasts</span>
          <span className="asterisk">✳</span>
        </a>
        <span className="edition">KNIGHT HACKS IX / PRACTICE TABLE</span>
      </header>
      <section className="intro">
        <p className="eyebrow">BUILD SOMETHING. THEN PRESSURE-TEST IT.</p>
        <h1>
          Bring your hack.
          <br />
          <em>Find your footing.</em>
        </h1>
        <p className="lede">
          Practice against a simulated field. See where your write-up lands, one
          challenge at a time.
        </p>
      </section>
      <aside className="fixture-banner">
        <strong>Fixture integration demo</strong>
        <span>
          Results are fixed synthetic examples. This starter does not run Qwen
          or verify software.
        </span>
      </aside>
      <div className="workspace">
        <section className="input-panel">
          <div className="section-heading">
            <h2>
              <span>01</span> Your project
            </h2>
            <button
              type="button"
              className="text-button"
              onClick={loadSample}
              disabled={busy}
            >
              Load sample ↗
            </button>
          </div>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Project name
                <input
                  required
                  maxLength={100}
                  value={submission.name}
                  onChange={(e) =>
                    setSubmission({ ...submission, name: e.target.value })
                  }
                  placeholder="A name worth remembering"
                />
              </label>
              <label>
                Tagline
                <input
                  required
                  maxLength={139}
                  value={submission.tagline}
                  onChange={(e) =>
                    setSubmission({ ...submission, tagline: e.target.value })
                  }
                  placeholder="Your project in one line"
                />
              </label>
              {textFields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    required
                    maxLength={8000}
                    rows={3}
                    value={submission[key]}
                    onChange={(e) =>
                      setSubmission({ ...submission, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Built with
                <input
                  required
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="react, python, gemini"
                />
                <small>Separate technology tags with commas.</small>
              </label>
              <div className="tracks">
                <p className="field-label">Sponsor challenges</p>
                <div className="track-options">
                  {config?.challenges
                    .filter((track) => !track.automatic)
                    .map((track) => (
                      <label className="track" key={track.id}>
                        <input
                          type="checkbox"
                          checked={submission.challenges.includes(
                            track.id as Submission["challenges"][number],
                          )}
                          onChange={(e) =>
                            setSubmission({
                              ...submission,
                              challenges: e.target.checked
                                ? [
                                    ...submission.challenges,
                                    track.id as Submission["challenges"][number],
                                  ]
                                : submission.challenges.filter(
                                    (id) => id !== track.id,
                                  ),
                            })
                          }
                        />
                        {track.name}
                      </label>
                    ))}
                </div>
                <small>
                  Overall, AI, Game and Useful categories are automatic.
                </small>
              </div>
              <button
                className="submit-button"
                disabled={!config?.field_ready || busy}
              >
                {busy
                  ? "Checking the practice field…"
                  : "Run fixture evaluation"}{" "}
                <span>↗</span>
              </button>
            </fieldset>
          </form>
        </section>
        <section className="result-panel" aria-live="polite">
          <div className="section-heading">
            <h2>
              <span>02</span> The practice report
            </h2>
            <span className="status">
              {job?.status || "READY WHEN YOU ARE"}
            </span>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {config && !config.field_ready && (
            <p className="error">
              The scoring field is not ready. Start the explicit fixture backend
              to test this flow.
            </p>
          )}
          {!job && (
            <div className="empty-state">
              <span className="empty-mark">↗</span>
              <h3>
                A little perspective
                <br />
                before the pitch.
              </h3>
              <p>
                Load the sample and submit to exercise the shared API. The
                report will appear here.
              </p>
            </div>
          )}
          {busy && (
            <p className="progress">
              Following your evaluation: {job?.status || "submitting"}…
            </p>
          )}
          {job?.result?.challenge_results.map((result) => (
            <article className="result-card" key={result.challenge_id}>
              <div className="result-top">
                <h3>
                  {config?.challenges.find(
                    (track) => track.id === result.challenge_id,
                  )?.name || result.challenge_id}
                </h3>
                <span className="score">
                  {result.score_10.toFixed(1)}
                  <small>/10</small>
                </span>
              </div>
              <p className="placement">
                {result.placement
                  ? `Practice placement ${result.placement.best_rank}–${result.placement.worst_rank} of ${result.placement.field_size_including_user}`
                  : "Ineligible for this category"}
              </p>
              <p>{result.rationale}</p>
              {result.warnings.map((warning, index) => (
                <small className="warning" key={index}>
                  {warning}
                </small>
              ))}
            </article>
          ))}
        </section>
      </div>
      <footer>
        SIMULATED FIELD · TEXT-ONLY FEEDBACK · NO REAL WINNER PREDICTION
      </footer>
    </main>
  );
}
