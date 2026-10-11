import { isSponsorRoom, type SponsorRoomId } from "./classroomLayout.ts";

export type LocationState = { kind: "campus" | "atrium" | "awards" | "classroom"; building: "Engineering I" | "Engineering II"; sponsor?: SponsorRoomId };

export function sceneLocation(url: URL): LocationState {
  const room = url.searchParams.get("room");
  if (url.pathname === "/interior.html" && isSponsorRoom(room)) {
    return { kind: "classroom", building: url.searchParams.get("building") === "eng1" ? "Engineering I" : "Engineering II", sponsor: room };
  }
  return {
    kind: url.pathname === "/interior.html" ? "atrium" : url.searchParams.get("scene") === "awards" ? "awards" : "campus",
    building: url.searchParams.get("building") === "eng1" ? "Engineering I" : "Engineering II",
  };
}

export function scenePath(state: LocationState): string {
  if (state.kind === "campus") return "/";
  const building = state.building === "Engineering I" ? "eng1" : "eng2";
  if (state.kind === "classroom") return `/interior.html?building=${building}&room=${isSponsorRoom(state.sponsor) ? state.sponsor : "gemini"}`;
  return state.kind === "atrium" ? `/interior.html?building=${building}` : `/?scene=awards&building=${building}`;
}
