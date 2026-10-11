"""Run one prepared batch through GPT-6 Luna with the Codex CLI (plan section 4.8).

Codex runs non-interactively in a read-only sandbox with an output schema; the
answer and run provenance are saved beside the batch for ingest.
"""
import subprocess
from datetime import datetime, timezone

from offline import config
from offline.config import load_json, write_json

NO_TOOLS = ("Answer from this prompt alone. Do not run commands, read files or browse; "
            "reply with the JSON object only.\n\n")


def codex_version():
    return subprocess.run(["codex", "--version"], capture_output=True, text=True, check=True).stdout.strip()


def run_batch(field_id, batch_id, generator):
    """Generate a batch answer with Codex; returns the answer path. Never reruns a saved answer."""
    folder = config.require_local(config.field_dir(field_id) / "batches" / batch_id)
    answer = folder / "answer.json"
    if answer.exists():
        raise SystemExit(f"{answer} already exists; ingest it instead of regenerating accepted work.")
    prompt = (folder / "prompt.md").read_text(encoding="utf-8")
    command = ["codex", "exec", "--model", generator["model"],
               "-c", f'model_reasoning_effort="{generator["reasoning_effort"]}"',
               "--sandbox", "read-only", "--ephemeral", "--skip-git-repo-check", "--color", "never",
               "--cd", str(folder), "--output-schema", str(folder / "output_schema.json"),
               "--output-last-message", str(answer), "-"]
    started = datetime.now(timezone.utc)
    result = subprocess.run(command, input=NO_TOOLS + prompt, capture_output=True, text=True,
                            timeout=generator["timeout_seconds"])
    finished = datetime.now(timezone.utc)
    (folder / "codex_stderr.log").write_text(result.stderr, encoding="utf-8")
    write_json(folder / "provenance.json", {
        "batch_id": batch_id,
        "requested_model": generator["model"],
        "reasoning_effort": generator["reasoning_effort"],
        "route": "codex exec (read-only sandbox, ephemeral, output schema)",
        "codex_version": codex_version(),
        "prompt_version": load_json(folder / "request.json")["prompt_version"],
        "started_at": started.isoformat(timespec="seconds"),
        "seconds": round((finished - started).total_seconds(), 1),
        "exit_code": result.returncode,
    })
    if result.returncode != 0 or not answer.exists():
        answer.unlink(missing_ok=True)
        raise SystemExit(f"Codex failed (exit {result.returncode}); see {folder / 'codex_stderr.log'}")
    return answer
