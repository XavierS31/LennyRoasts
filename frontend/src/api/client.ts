import type { components } from "./contract";

export type Submission = components["schemas"]["Submission"];
export type EvaluationJob = components["schemas"]["EvaluationJob"];
export type ChallengeList = components["schemas"]["ChallengeList"];
export type Challenge = components["schemas"]["Challenge"];
export type ChallengeResult = components["schemas"]["ChallengeResult"];
export type RunScore = components["schemas"]["RunScore"];
export type EvaluationRequest = components["schemas"]["EvaluationRequest"];
export type APIError = components["schemas"]["APIError"];

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly apiError: APIError | undefined,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const bodyText = await response.text();
  let body: unknown;
  try {
    body = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const apiError = isAPIError(body) ? body : undefined;
    throw new ApiRequestError(
      response.status,
      apiError,
      apiError?.message || `Request failed (${response.status}).`,
    );
  }
  if (body === undefined) {
    throw new Error("The API returned an unreadable response.");
  }
  return body as T;
}

function isAPIError(value: unknown): value is APIError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<APIError>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    Array.isArray(candidate.details) &&
    candidate.details.every((detail) => typeof detail === "string")
  );
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
