// One photo-based classroom, reused by every sponsor. Dimensions are inferred,
// not a measured reconstruction of either photographed school room.
export const CLASSROOM = { width: 14, depth: 18, height: 4.6, seats: 32 } as const;

export const sponsorRooms = [
  { id: "gemini", name: "Gemini", host: "MLH · Gemini", lenny: "mlh", color: "#526ee8", pin: [-22, 12, -25], landmark: "Window gallery" },
  { id: "elevenlabs", name: "ElevenLabs", host: "ElevenLabs", lenny: "elevenlabs", color: "#8846bf", pin: [-22, 12, 14], landmark: "Window walkway" },
  { id: "databricks", name: "Databricks", host: "Databricks", lenny: "databricks", color: "#c63e32", pin: [21, 12, -18], landmark: "Opposite gallery" },
  { id: "bny", name: "BNY", host: "BNY", lenny: "bny", color: "#997014", pin: [17, 18, 24], landmark: "Stair landing" },
] as const;

export type SponsorRoomId = typeof sponsorRooms[number]["id"];
export function isSponsorRoom(id: string | null | undefined): id is SponsorRoomId {
  return sponsorRooms.some((room) => room.id === id);
}
export function sponsorRoom(id: string | undefined) {
  return sponsorRooms.find((room) => room.id === id) ?? sponsorRooms[0];
}

export const classroomViews = {
  overview: { position: [1, 2.7, 7.7], target: [0, 1.8, -5.3] },
  iso: { position: [13, 10, 14], target: [0, 1.2, -1] },
  top: { position: [0, 24, .1], target: [0, 0, 0] },
  floor: { position: [0, 1.8, -.6], target: [2.1, 1.6, -6.8] },
  front: { position: [-1.5, 2.2, -2.6], target: [3.7, 1.3, -6.7] },
  entrance: { position: [-2.2, 2, -3], target: [-5.45, 1.4, -8.6] },
  ceiling: { position: [0, 1.4, 4], target: [0, 4.3, -1] },
} satisfies Record<string, { position: number[]; target: number[] }>;
