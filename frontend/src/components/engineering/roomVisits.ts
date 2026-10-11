import type { ChallengeResult } from "../../api/client.ts";
import { sponsorRooms, type SponsorRoomId } from "./classroomLayout.ts";

export type VisitParticipant = { key: string; name: string; position: [number, number]; categories: string[] };
export type VisitPhase = "outbound" | "inside" | "returning";
export type RoomVisit = { key: string; name: string; room: SponsorRoomId; category: string; phase: VisitPhase; elapsed: number; travelSeconds: number; route: VisitPoint[] };
export type VisitPoint = [number, number, number];
export const ROOM_STAY_SECONDS = 10;
const categories = new Set(["gemini", "elevenlabs", "databricks", "bny", "overall", "best_ai", "best_game", "most_useful"]);

/** Only supplied identities establish category membership. Counts never do. */
export function visitCategories(key: string, results: ChallengeResult[], savedCategories: string[] = []) {
  const known = key === "user"
    ? results.map((result) => result.challenge_id)
    : results.filter((result) => result.rivals.some((rival) => rival.project_id === key)).map((result) => result.challenge_id);
  return [...new Set([...known, ...savedCategories].filter((id) => categories.has(id)).concat("overall"))];
}

export function visitRoom(category: string): SponsorRoomId {
  return sponsorRooms.find((room) => room.id === category)?.id ?? "overall";
}

/** Ground-level portals under the existing room pins, clear of wall desks. */
export function roomDoor(id: SponsorRoomId): VisitPoint {
  const room = sponsorRooms.find((room) => room.id === id)!;
  return [id === "overall" ? 0 : Math.max(-17.5, room.pin[0]), .6, id === "overall" ? -36 : room.pin[2]];
}

export function visitRoute(position: [number, number], room: SponsorRoomId): VisitPoint[] {
  const door = roomDoor(room);
  // Keep each avatar in its open floor lane; cross the hall at the glass end.
  const lane = Math.abs(position[0]) < 3 ? position[0] + (position[0] < 0 ? 1.2 : -1.2) : Math.max(-17.7, Math.min(22.9, position[0] + (position[0] < 0 ? -1.2 : 1.2)));
  const points: VisitPoint[] = [[position[0], .6, position[1]], [lane, .6, position[1]], [lane, .6, -36], [door[0], .6, -36], door];
  return points.filter((point, index) => index === 0 || Math.hypot(...point.map((n, axis) => n - points[index - 1][axis])) > .001);
}

export function routeLength(route: VisitPoint[]) {
  return route.slice(1).reduce((length, point, index) => length + Math.hypot(...point.map((n, axis) => n - route[index][axis])), 0);
}

export function visitPose(visit: RoomVisit, reducedMotion = false) {
  let distance = Math.max(0, Math.min(1, visit.elapsed / visit.travelSeconds)) * routeLength(visit.route);
  const points = visit.phase === "returning" ? [...visit.route].reverse() : visit.route;
  if (reducedMotion) distance = visit.phase === "returning" ? routeLength(points) : 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    const length = Math.hypot(...b.map((n, axis) => n - a[axis]));
    if (distance <= length || index === points.length - 1) {
      const t = length ? Math.min(1, distance / length) : 1;
      return { position: a.map((n, axis) => n + (b[axis] - n) * t) as VisitPoint, rotation: Math.atan2(b[0] - a[0], b[2] - a[2]) };
    }
    distance -= length;
  }
  return { position: points[0], rotation: 0 };
}

/** One occupant per physical room and one assignment at a time per avatar.
 * Lives above scene instances, so navigation cannot reset a visit or its clock. */
export class RoomVisitSimulation {
  playing = false;
  visits = new Map<SponsorRoomId, RoomVisit>();
  private cursors = new Map<SponsorRoomId, number>();
  private nextCategory = new Map<string, number>();
  participants: VisitParticipant[];
  constructor(participants: VisitParticipant[]) { this.participants = participants; }
  advance(delta: number, reducedMotion = false) {
    if (!this.playing) return;
    let remaining = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 1)) : 0;
    do {
      const elapsed = Math.min(remaining, .1);
      this.step(elapsed, reducedMotion);
      remaining -= elapsed;
    } while (remaining > .00001);
  }
  private step(elapsed: number, reducedMotion: boolean) {
    for (const [room, visit] of this.visits) {
      visit.elapsed += elapsed;
      const duration = visit.phase === "inside" ? ROOM_STAY_SECONDS : reducedMotion ? 0 : visit.travelSeconds;
      if (visit.elapsed < duration) continue;
      if (visit.phase === "returning") {
        this.visits.delete(room);
        const participant = this.participants.find((entry) => entry.key === visit.key)!;
        this.nextCategory.set(visit.key, ((this.nextCategory.get(visit.key) ?? 0) + 1) % participant.categories.length);
      } else { visit.phase = visit.phase === "outbound" ? "inside" : "returning"; visit.elapsed = 0; }
    }
    const busy = new Set([...this.visits.values()].map((visit) => visit.key));
    for (const room of sponsorRooms) {
      if (this.visits.has(room.id)) continue;
      const count = this.participants.length;
      for (let offset = 0; offset < count; offset++) {
        const index = ((this.cursors.get(room.id) ?? 0) + offset) % count;
        const participant = this.participants[index];
        const category = participant.categories[this.nextCategory.get(participant.key) ?? 0];
        if (!category || busy.has(participant.key) || visitRoom(category) !== room.id) continue;
        const route = visitRoute(participant.position, room.id);
        this.visits.set(room.id, { key: participant.key, name: participant.name, room: room.id, category, phase: "outbound", elapsed: 0, travelSeconds: Math.max(2, routeLength(route) / 7), route });
        this.cursors.set(room.id, (index + 1) % count); busy.add(participant.key); break;
      }
    }
  }
  snapshot() { return [...this.visits.values()].map((visit) => ({ ...visit })); }
}
