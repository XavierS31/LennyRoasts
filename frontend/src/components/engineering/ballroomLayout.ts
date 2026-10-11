// Photo-derived proportions, not surveyed dimensions. The screen/stage wall is
// at -Z. All banquet chairs face -Z on one flat ballroom floor.
export const BALLROOM = { halfWidth: 24, halfLength: 34, height: 19, rows: 13, seatsPerBlock: 8 } as const;

export const ballroomViews = {
  overview: { position: [0, 6.5, 29], target: [0, 8, -30] },
  floor: { position: [0, 3.9, 19], target: [0, 7.5, -31] },
  stage: { position: [-8, 4.6, -16], target: [0, 5.6, -31] },
  ceiling: { position: [0, 7, 19], target: [0, 18, -8] },
  iso: { position: [40, 37, 48], target: [0, 4, -3] },
  top: { position: [0, 84, .1], target: [0, 0, 0] },
} satisfies Record<string, { position: number[]; target: number[] }>;
