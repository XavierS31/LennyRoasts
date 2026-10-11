import type { ChallengeResult } from "../../api/client.ts";

export const sponsorCategories = [
  { id: "gemini", name: "Gemini", logo: "/assets/sponsors/gemini.png" },
  { id: "elevenlabs", name: "ElevenLabs", logo: "/assets/sponsors/elevenlabs.png" },
  { id: "databricks", name: "Databricks", logo: "/assets/sponsors/databricks.png" },
  { id: "bny", name: "BNY", logo: "/assets/sponsors/bny.png" },
] as const;

export const generalCategories = [
  { id: "overall", name: "Best Hack" }, { id: "best_ai", name: "Best AI" },
  { id: "best_game", name: "Best Game" }, { id: "most_useful", name: "Most Useful" },
] as const;

export const ceremonyCategories = [...sponsorCategories, ...generalCategories] as const;

// A range overlapping the top three does not confirm a top-three finish.
export function confirmedTopThree(result: ChallengeResult | undefined) {
  return Boolean(result?.eligible && result.placement && result.placement.best_rank >= 1 && result.placement.worst_rank >= result.placement.best_rank && result.placement.worst_rank <= 3);
}

// A higher average does not override the API's placement across judging runs.
export function ceremonyComparison(result: ChallengeResult | undefined) {
  return {
    confirmedTopThree: confirmedTopThree(result),
    aboveCachedLeaders: Boolean(result?.eligible && result.rivals.length && result.rivals.every((rival) => result.score_10 > rival.score_10)),
  };
}

/** Presentation order only; preserve the backend's leader order and scores. */
export function ceremonyLeaders(result: ChallengeResult | undefined) {
  return result ? [...result.rivals].reverse() : [];
}
