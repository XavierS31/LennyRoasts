import type { ChallengeResult } from "../../api/client.ts";

export const ceremonyCategories = [
  { id: "gemini", name: "Gemini" }, { id: "elevenlabs", name: "ElevenLabs" },
  { id: "overall", name: "Overall Judging" }, { id: "databricks", name: "Databricks" }, { id: "bny", name: "BNY" },
] as const;

// A range overlapping the top three does not confirm a top-three finish.
export function confirmedTopThree(result: ChallengeResult | undefined) {
  return Boolean(result?.eligible && result.placement && result.placement.best_rank >= 1 && result.placement.worst_rank >= result.placement.best_rank && result.placement.worst_rank <= 3);
}

/** Presentation order only; preserve the backend's leader order and scores. */
export function ceremonyLeaders(result: ChallengeResult | undefined) {
  return result ? [...result.rivals].reverse() : [];
}
