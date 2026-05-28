export type SlotPosition = "GK" | "DEF" | "MID" | "T" | "ATT";

export type LineupPlayerInput = {
  playerId: number;
  slotPosition: SlotPosition;
  slotIndex: number;
  isStarter: boolean;
  benchOrder?: number | null;
};

export type ScoringInput = {
  lineup: {
    module: string;
    captainPlayerId: number | null;
    players: LineupPlayerInput[];
  };
  playerVoti: Map<number, number | null>;
  playerRoles: Map<number, SlotPosition>;
  config: { captainMultiplier: number };
};

export type EffectivePlayer = {
  playerId: number;
  voto: number;
  wasSubstitute: boolean;
  replacedPlayerId?: number;
};

export type ScoringResult = {
  effectiveEleven: EffectivePlayer[];
  substitutions: Array<{ out: number; inId: number }>;
  captainBonus: number;
  totalScore: number;
};

function roleGroup(pos: SlotPosition): string {
  if (pos === "MID" || pos === "T") return "MID";
  return pos;
}

export function computeFantaTeamScore(input: ScoringInput): ScoringResult {
  const { lineup, playerVoti, config } = input;
  const { captainPlayerId, players } = lineup;
  const { captainMultiplier } = config;

  const starters = players
    .filter((p) => p.isStarter)
    .sort((a, b) => a.slotIndex - b.slotIndex);

  const bench = players
    .filter((p) => !p.isStarter)
    .sort((a, b) => (a.benchOrder ?? 999) - (b.benchOrder ?? 999));

  const effectiveEleven: EffectivePlayer[] = [];
  const substitutions: Array<{ out: number; inId: number }> = [];
  const usedSubIds = new Set<number>();

  for (const starter of starters) {
    const voto = playerVoti.get(starter.playerId) ?? null;

    if (voto !== null) {
      effectiveEleven.push({
        playerId: starter.playerId,
        voto,
        wasSubstitute: false,
      });
    } else {
      const group = roleGroup(starter.slotPosition);
      const sub = bench.find(
        (b) =>
          roleGroup(b.slotPosition) === group &&
          !usedSubIds.has(b.playerId) &&
          (playerVoti.get(b.playerId) ?? null) !== null,
      );

      if (sub) {
        const subVoto = playerVoti.get(sub.playerId) as number;
        effectiveEleven.push({
          playerId: sub.playerId,
          voto: subVoto,
          wasSubstitute: true,
          replacedPlayerId: starter.playerId,
        });
        substitutions.push({ out: starter.playerId, inId: sub.playerId });
        usedSubIds.add(sub.playerId);
      } else {
        effectiveEleven.push({
          playerId: starter.playerId,
          voto: 0,
          wasSubstitute: false,
        });
      }
    }
  }

  const baseSum = effectiveEleven.reduce((acc, p) => acc + p.voto, 0);

  let captainBonus = 0;
  if (captainPlayerId !== null) {
    const captainVoto = playerVoti.get(captainPlayerId) ?? null;
    if (captainVoto !== null) {
      captainBonus = captainVoto * (captainMultiplier - 1);
    }
  }

  return {
    effectiveEleven,
    substitutions,
    captainBonus,
    totalScore: baseSum + captainBonus,
  };
}
