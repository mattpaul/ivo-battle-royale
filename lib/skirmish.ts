import type {
  Challenge,
  Competitor,
  Skirmish,
  SkirmishCompetitorResult
} from "./game-store";

export type CompetitorAttempt = Omit<SkirmishCompetitorResult, "eliminated">;

export type AttemptRunner = (
  competitor: Competitor,
  challenge: Challenge
) => CompetitorAttempt;

export type ResolvedSkirmish = Pick<Skirmish, "results" | "status" | "summary"> & {
  eliminatedIds: string[];
};

export function resolveSkirmishAttempts(
  attempts: CompetitorAttempt[]
): ResolvedSkirmish {
  const correctAttempts = attempts.filter((attempt) => attempt.answer === "correct");

  if (correctAttempts.length === 0) {
    return {
      eliminatedIds: [],
      results: attempts.map((attempt) => ({ ...attempt, eliminated: false })),
      status: "canceled",
      summary:
        "All selected competitors failed, so the skirmish was canceled and everyone was resurrected."
    };
  }

  if (correctAttempts.length === attempts.length) {
    const slowest = [...correctAttempts].sort(
      (a, b) => (b.responseTimeMs ?? 0) - (a.responseTimeMs ?? 0)
    )[0];

    return {
      eliminatedIds: [slowest.competitorId],
      results: attempts.map((attempt) => ({
        ...attempt,
        eliminated: attempt.competitorId === slowest.competitorId
      })),
      status: "resolved",
      summary: `${slowest.name} answered correctly, but was slowest and got eliminated.`
    };
  }

  const eliminatedIds = attempts
    .filter((attempt) => attempt.answer !== "correct")
    .map((attempt) => attempt.competitorId);

  return {
    eliminatedIds,
    results: attempts.map((attempt) => ({
      ...attempt,
      eliminated: eliminatedIds.includes(attempt.competitorId)
    })),
    status: "resolved",
    summary: `${eliminatedIds.length} competitor${eliminatedIds.length === 1 ? "" : "s"} failed the challenge and got eliminated.`
  };
}

export function createMockAttemptRunner(random = Math.random): AttemptRunner {
  return (competitor) => {
    const roll = random();

    if (roll < 0.18) {
      return {
        competitorId: competitor.id,
        name: competitor.name,
        answer: "timeout"
      };
    }

    if (roll < 0.38) {
      return {
        competitorId: competitor.id,
        name: competitor.name,
        answer: "incorrect",
        responseTimeMs: randomInteger(6_000, 58_000, random)
      };
    }

    return {
      competitorId: competitor.id,
      name: competitor.name,
      answer: "correct",
      responseTimeMs: randomInteger(4_000, 59_000, random)
    };
  };
}

function randomInteger(min: number, max: number, random: () => number) {
  return Math.floor(random() * (max - min + 1)) + min;
}
