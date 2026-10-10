import type { components } from "./contract";

export type Submission = components["schemas"]["Submission"];
export type EvaluationJob = components["schemas"]["EvaluationJob"];
export type ChallengeList = components["schemas"]["ChallengeList"];
export type EvaluationRequest = components["schemas"]["EvaluationRequest"];
export type APIError = components["schemas"]["APIError"];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) {
    const error = (await response.json()) as APIError;
    throw new Error(error.message || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const getChallenges = (signal?: AbortSignal) =>
  request<ChallengeList>("/api/challenges", { signal });
export const submitEvaluation = (
  body: EvaluationRequest,
  signal?: AbortSignal,
) =>
  request<EvaluationJob>("/api/evaluations", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
export const getEvaluation = (id: string, signal?: AbortSignal) =>
  request<EvaluationJob>(`/api/evaluations/${encodeURIComponent(id)}`, {
    signal,
  });
