export type LocationState = { kind: "campus" | "atrium" | "awards"; building: "Engineering I" | "Engineering II" };

export function sceneLocation(url: URL): LocationState {
  return {
    kind: url.pathname === "/interior.html" ? "atrium" : url.searchParams.get("scene") === "awards" ? "awards" : "campus",
    building: url.searchParams.get("building") === "eng1" ? "Engineering I" : "Engineering II",
  };
}

export function scenePath(state: LocationState): string {
  if (state.kind === "campus") return "/";
  const building = state.building === "Engineering I" ? "eng1" : "eng2";
  return state.kind === "atrium" ? `/interior.html?building=${building}` : `/?scene=awards&building=${building}`;
}
