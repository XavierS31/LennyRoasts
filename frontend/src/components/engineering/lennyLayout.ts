// Scene mascots are decorative hosts, independent of judged projects/field counts.
export const lennySponsors = [
  { id: "mlh", name: "MLH", position: [-11, 4] },
  { id: "bny", name: "BNY", position: [11, 4] },
  { id: "elevenlabs", name: "ElevenLabs", position: [-11, -16] },
  { id: "databricks", name: "Databricks", position: [11, -16] },
] as const;

export type LennySponsor = typeof lennySponsors[number]["id"];

export const lennyPresenter = { position: [0, 1.26, -27.8], height: 5.4 } as const;
export const sponsorLennyHeight = 4.6;

export function sponsorView(id: string) {
  const sponsor = lennySponsors.find((entry) => entry.id === id);
  if (!sponsor) return undefined;
  const [x, z] = sponsor.position;
  return { position: [x, 3.8, z + 8.8], target: [x, 2.45, z] };
}
