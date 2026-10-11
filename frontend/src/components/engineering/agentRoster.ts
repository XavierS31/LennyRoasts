export type AgentAppearance = {
  id: string;
  gender: "man" | "woman";
  background: "white" | "east_asian" | "south_asian" | "southeast_asian" | "black";
  skin: string;
  hair: string;
  shirt: string;
  accent: string;
  hairstyle: "crop" | "quiff" | "curls" | "bob" | "bun" | "long";
  glasses: boolean;
  clothing: "tee" | "hoodie" | "jacket";
  scale: number;
  phase: number;
};

// Fictional art direction requested by the user, not measured demographics.
export const AGENT_COUNTS = { men: 150, women: 50, white: 60, asian: 79, black: 61 } as const;
export const AGENT_SEED = 109200;

function randomGenerator(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function createAgentRoster(seed = AGENT_SEED): AgentAppearance[] {
  const random = randomGenerator(seed);
  const pick = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)];
  const shuffle = <T,>(values: T[]) => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  };
  const genders = shuffle(Array.from({ length: 200 }, (_, i) => i < 150 ? "man" as const : "woman" as const));
  const backgrounds = shuffle(Array.from({ length: 200 }, (_, i): AgentAppearance["background"] =>
    i < 60 ? "white" : i < 87 ? "east_asian" : i < 113 ? "south_asian" : i < 139 ? "southeast_asian" : "black"));
  const skinPalette = {
    white: ["#f4d7bf", "#e8bd99", "#d7a782", "#c79870"],
    east_asian: ["#edc6a5", "#dcb08a", "#bd8b63", "#a87250"],
    south_asian: ["#d7a782", "#bf8a61", "#9a633f", "#79472f"],
    southeast_asian: ["#ddb18a", "#c18e62", "#a16b44", "#835136"],
    black: ["#ab7650", "#8e583b", "#70422d", "#542f23", "#3f241d"],
  } as const;
  return backgrounds.map((background, i) => ({
    id: `agent-${String(i + 1).padStart(3, "0")}`,
    gender: genders[i], background, skin: pick(skinPalette[background]),
    // Clothes, hair shapes, glasses and expression are independent of background.
    hair: pick(["#221b20", "#433029", "#73503a", "#ba8b44", "#e1c16e", "#934635", "#aaa3a0"]),
    shirt: pick(["#214b8d", "#e26143", "#e1c697", "#226b64", "#593967", "#c68d29", "#34493a", "#a4718c", "#77402b", "#2a303b"]),
    accent: pick(["#ffe6a3", "#83d8d2", "#efe5d7", "#cf7060"]),
    hairstyle: pick(["crop", "quiff", "curls", "bob", "bun", "long"] as const),
    glasses: random() < .3, clothing: pick(["tee", "hoodie", "jacket"] as const),
    scale: .92 + random() * .16, phase: random() * Math.PI * 2,
  }));
}

export const agentRoster = createAgentRoster();

export function appearanceForProject(id: string): AgentAppearance {
  const mockIndex = /^mock-project-(\d{3})$/.exec(id);
  if (mockIndex && Number(mockIndex[1]) >= 1 && Number(mockIndex[1]) <= 200) return agentRoster[Number(mockIndex[1]) - 1];
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return agentRoster[(hash >>> 0) % agentRoster.length];
}

export function agentStation(index: number): [number, number] {
  // Eight open floor lanes: clear the tables, workstation chairs, columns and stairs.
  const lanes = [-16.5, -11, -2.2, 2.2, 11, 17, 19.7, 22];
  return [lanes[index % lanes.length], -33 + Math.floor(index / lanes.length) * 2.7];
}
