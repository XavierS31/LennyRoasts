import type { Submission } from "./api/client";

export const MAX_IDEA_LENGTH = 8000;

// Keep the shared Devpost wire format for the offline field and existing API.
// Only the user's text contains project claims; absent details stay undescribed.
export function ideaSubmission(
  idea: string,
  challenges: Submission["challenges"],
): Submission {
  const text = idea.trim();
  const title = text.split(/\r?\n/, 1)[0] || "Idea draft";
  return {
    name: Array.from(title).slice(0, 100).join(""),
    tagline: "Idea-stage hackathon proposal",
    inspiration: "not described",
    what_it_does: text,
    how_we_built_it: "not described",
    challenges_we_ran_into: "Idea-stage proposal; implementation status is not described.",
    accomplishments: "not described",
    what_we_learned: "not described",
    whats_next: "Features in the idea text are planned unless explicitly described as already working.",
    built_with: ["not described"],
    challenges: [...challenges],
  };
}

export function ideaError(idea: string): string | undefined {
  if (!idea.trim()) return "Describe your idea to get started.";
  if (Array.from(idea).length > MAX_IDEA_LENGTH) return "Use 8,000 characters or fewer.";
}
