import { useRef, useState, type ChangeEvent } from "react";
import { PaperclipIcon } from "@phosphor-icons/react";
import { extractIdeaFile, mergeIdeaText } from "../documentImport";
import { MAX_IDEA_LENGTH } from "../ideaSubmission";

type Props = {
  idea: string;
  disabled: boolean;
  onImport: (text: string) => void;
  onBusyChange: (busy: boolean) => void;
};

export default function IdeaFileImport({ idea, disabled, onImport, onBusyChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ name: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const previewInput = useRef<HTMLTextAreaElement>(null);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // Allow choosing the same file again after an error.
    if (!file || disabled || busy) return;
    setError("");
    setDraft(null);
    setStatus(`Reading ${file.name}…`);
    setBusy(true);
    onBusyChange(true);
    try {
      const text = await extractIdeaFile(file);
      setDraft({ name: file.name, text });
      setStatus(`Text extracted from ${file.name}. Review it before adding it to your idea.`);
      window.requestAnimationFrame(() => previewInput.current?.focus());
    } catch (cause) {
      setStatus("");
      setError(cause instanceof Error ? cause.message : "This file could not be read. Try another file or paste your text.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  function apply(append: boolean) {
    if (!draft || disabled || busy) return;
    try {
      onImport(mergeIdeaText(idea, draft.text, append));
      setStatus(`Text from ${draft.name} added to your idea. You can edit it below.`);
      setDraft(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Shorten the text before adding it.");
    }
  }

  const count = Array.from(draft?.text ?? "").length;
  return <div className="idea-file-import">
    <div className="file-import-heading">
      <button type="button" className="secondary-button" disabled={disabled || busy}
        onClick={() => fileInput.current?.click()} aria-describedby="file-import-hint">
        <PaperclipIcon size={18} weight="light" aria-hidden="true" /> {busy ? "Reading…" : "Import notes"}
      </button>
      <small id="file-import-hint">PDF · MD · Markdown · 10 MB</small>
    </div>
    <input ref={fileInput} type="file" hidden accept=".pdf,.md,.markdown,application/pdf,text/markdown"
      aria-label="Choose a PDF or Markdown file" disabled={disabled || busy} onChange={(event) => void readFile(event)} />
    <p className="file-import-status" role="status">{status}</p>
    {draft && <div className="file-import-preview form-field">
      <label htmlFor="document-preview">Review extracted text <span className="required-label">{draft.name}</span></label>
      <textarea ref={previewInput} id="document-preview" rows={6} value={draft.text} disabled={disabled}
        onChange={(event) => { setDraft({ ...draft, text: event.target.value }); setError(""); }}
        aria-describedby="document-preview-hint" aria-invalid={count > MAX_IDEA_LENGTH} />
      <div className="field-meta">
        <small id="document-preview-hint">{count > MAX_IDEA_LENGTH ? "Shorten this text to 8,000 characters before using it. Nothing has been cut." : "Check the wording and reading order before using it."}</small>
        <span>{count.toLocaleString()} / {MAX_IDEA_LENGTH.toLocaleString()}</span>
      </div>
      <div className="file-import-actions">
        <button type="button" className="secondary-button" disabled={disabled || !draft.text.trim() || count > MAX_IDEA_LENGTH} onClick={() => apply(false)}>
          {idea.trim() ? "Replace idea text" : "Use this text"}
        </button>
        {idea.trim() && <button type="button" className="secondary-button" disabled={disabled || !draft.text.trim() || count > MAX_IDEA_LENGTH} onClick={() => apply(true)}>Append to idea</button>}
        <button type="button" className="text-button" disabled={disabled} onClick={() => { setDraft(null); setError(""); setStatus("Import discarded. Your idea text is unchanged."); }}>Discard</button>
      </div>
    </div>}
    {error && <p className="field-error" role="alert">{error} Your idea text is unchanged.</p>}
  </div>;
}
