// Inferred spatial relationship, not surveyed dimensions. Looking toward the
// glass entrance: brick is on the left, cream on the right, stairs behind you.
export const ATRIUM = { halfWidth: 24, halfLength: 42, height: 32 } as const;
export const columnRows = [-27, -9, 9, 27] as const;
export const tableRows = [-28, -14, 0, 14, 28] as const;

export function projectStation(index: number): [number, number] {
  // Named API projects occupy real table bays rather than a row of floating bars.
  const stations: [number, number][] = [[-6, 28], [6, 14], [-6, 0], [6, -14], [-6, -28], [6, 28], [-6, 14], [6, 0], [-6, -14], [6, -28]];
  return stations[index % stations.length];
}

export const atriumViews = {
  overview: { position: [0, 24, 30], target: [0, 11, -10] },
  floor: { position: [0, 5, 33], target: [0, 9, -24] },
  stairs: { position: [-8, 7, -30], target: [0, 13, 35] },
  ceiling: { position: [0, 9, 17], target: [0, 30, -5] },
  entrance: { position: [8, 8, 20], target: [0, 14, -40] },
  top: { position: [0, 85, 0.1], target: [0, 0, 0] },
} satisfies Record<string, { position: number[]; target: number[] }>;
