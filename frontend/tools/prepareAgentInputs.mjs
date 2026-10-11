import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { agentRoster, AGENT_COUNTS, AGENT_SEED } from "../src/components/engineering/agentRoster.ts";

const pool = JSON.parse(readFileSync(new URL("../../contracts/mock/pool.json", import.meta.url), "utf8"));
// Only an authored synthetic input excerpt. Never package scores, personas or a real field.
const preview = {
  source: "Committed synthetic mock inputs; not live agent activity or judge results",
  pool_version: pool.pool_version,
  agents: pool.projects.map(({ project_id, submission }) => ({
    project_id, name: submission.name, input: `${submission.name}\n\n${submission.what_it_does}`,
  })),
};
if (preview.agents.length !== 200 || new Set(preview.agents.map((agent) => agent.project_id)).size !== 200) throw new Error("Expected 200 unique common mock projects");
const destination = new URL("../src/components/engineering/agentInputs.json", import.meta.url);
writeFileSync(destination, JSON.stringify(preview, null, 2) + "\n");
const assets = new URL("../public/assets/agents/", import.meta.url);
mkdirSync(assets, { recursive: true });
writeFileSync(new URL("appearances.json", assets), JSON.stringify({
  seed: AGENT_SEED, counts: AGENT_COUNTS,
  note: "Fictional art direction, not measured demographics. Appearance is independent of input and scoring.",
  agents: agentRoster.map((appearance, i) => ({ ...appearance, project_id: preview.agents[i].project_id })),
}, null, 2) + "\n");
console.log(`Saved ${preview.agents.length} distinct sample inputs to ${fileURLToPath(destination)}`);
