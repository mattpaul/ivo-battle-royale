import { randomUUID } from "crypto";
import {
  AttemptRunner,
  createMockAttemptRunner,
  resolveSkirmishAttempts
} from "./skirmish";

export type BattleStatus = "lobby" | "active" | "complete";
export type ChallengeTarget = "active" | "next";

export type Competitor = {
  id: string;
  name: string;
  status: "active" | "eliminated" | "winner";
};

export type Challenge = {
  id: string;
  prompt: string;
  expectedAnswer?: string;
  submittedBy: string;
  target: ChallengeTarget;
  createdAt: string;
};

export type SkirmishCompetitorResult = {
  competitorId: string;
  name: string;
  answer: "correct" | "incorrect" | "timeout";
  responseTimeMs?: number;
  eliminated: boolean;
};

export type Skirmish = {
  id: string;
  challenge: Challenge;
  competitorIds: string[];
  results: SkirmishCompetitorResult[];
  status: "resolved" | "canceled";
  createdAt: string;
  summary: string;
};

export type BattleConfig = {
  competitorCount: number;
};

export type BattleState = {
  status: BattleStatus;
  config: BattleConfig;
  competitors: Competitor[];
  activeChallenges: Challenge[];
  queuedChallenges: Challenge[];
  skirmishes: Skirmish[];
  winnerId?: string;
  startedAt?: string;
  completedAt?: string;
};

type Store = {
  battle: BattleState;
  adminSessions: Set<string>;
};

export const DEFAULT_COMPETITOR_COUNT = 4;

const competitorNames = [
  "Ada Lambda",
  "Grace Hopperbot",
  "Linus Loop",
  "Margaret Stack",
  "Katherine Kernel",
  "Donald Knuthread",
  "Barbara Liskovite",
  "Edsger Dijkstrap",
  "Frances Allenby",
  "Ken Thompsonic",
  "Radia Perlmanence",
  "Leslie Lamportal",
  "Anita Borgbase",
  "Tim Berners-Leefer",
  "Guido van Rossumware",
  "Sophie Wilsonic"
];

const defaultBattle = (): BattleState => ({
  status: "lobby",
  config: {
    competitorCount: DEFAULT_COMPETITOR_COUNT
  },
  competitors: [],
  activeChallenges: [],
  queuedChallenges: [],
  skirmishes: []
});

const globalStore = globalThis as typeof globalThis & {
  battleRoyaleStore?: Store;
};

export const store: Store =
  globalStore.battleRoyaleStore ??
  (globalStore.battleRoyaleStore = {
    battle: defaultBattle(),
    adminSessions: new Set<string>()
  });

export function getPublicState() {
  const activeCount = store.battle.competitors.filter(
    (competitor) => competitor.status === "active" || competitor.status === "winner"
  ).length;

  return {
    battle: store.battle,
    counts: {
      activeCompetitors: activeCount,
      eliminatedCompetitors: store.battle.competitors.filter(
        (competitor) => competitor.status === "eliminated"
      ).length,
      queuedChallenges: store.battle.queuedChallenges.length,
      skirmishes: store.battle.skirmishes.length
    }
  };
}

export function configureBattle(competitorCount: number) {
  if (store.battle.status === "active") {
    throw new Error("Cannot configure a battle while it is active.");
  }

  store.battle.config.competitorCount = clamp(Math.round(competitorCount), 2, 64);
}

export function startBattle() {
  const competitors = Array.from(
    { length: store.battle.config.competitorCount },
    (_, index) => ({
      id: randomUUID(),
      name:
        competitorNames[index] ??
        `Agent ${String(index + 1).padStart(2, "0")}`,
      status: "active" as const
    })
  );

  store.battle = {
    ...defaultBattle(),
    status: "active",
    config: { ...store.battle.config },
    competitors,
    activeChallenges: store.battle.queuedChallenges.map((challenge) => ({
      ...challenge,
      target: "active" as const
    })),
    queuedChallenges: [],
    startedAt: new Date().toISOString()
  };
}

export function submitChallenge(input: {
  id: string;
  prompt: string;
  expectedAnswer?: string;
  submittedBy: string;
  target: ChallengeTarget;
}) {
  const challenge: Challenge = {
    id: input.id.trim(),
    prompt: input.prompt.trim(),
    expectedAnswer: input.expectedAnswer?.trim() || undefined,
    submittedBy: input.submittedBy,
    target: input.target,
    createdAt: new Date().toISOString()
  };

  if (!challenge.id || !challenge.prompt) {
    throw new Error("Challenge id and prompt are required.");
  }

  if (challenge.target === "active" && store.battle.status === "active") {
    store.battle.activeChallenges.unshift(challenge);
    resolveSkirmish(challenge);
  } else {
    store.battle.queuedChallenges.unshift({ ...challenge, target: "next" });
  }

  return challenge;
}

export function deleteQueuedChallenge(challengeId: string) {
  store.battle.queuedChallenges = store.battle.queuedChallenges.filter(
    (challenge) => challenge.id !== challengeId
  );
}

export function clearQueuedChallenges() {
  store.battle.queuedChallenges = [];
}

function resolveSkirmish(challenge: Challenge) {
  const activeCompetitors = store.battle.competitors.filter(
    (competitor) => competitor.status === "active"
  );

  if (activeCompetitors.length <= 1) {
    crownWinnerIfReady();
    return;
  }

  const skirmishSize = clamp(
    randomInteger(2, 4),
    2,
    Math.min(4, activeCompetitors.length)
  );
  const selected = shuffle(activeCompetitors).slice(0, skirmishSize);
  const { eliminatedIds, results, status, summary } = runSkirmishAttempts(
    challenge,
    selected,
    createMockAttemptRunner()
  );

  eliminatedIds.forEach(eliminateCompetitor);

  store.battle.skirmishes.unshift({
    id: randomUUID(),
    challenge,
    competitorIds: selected.map((competitor) => competitor.id),
    results,
    status,
    createdAt: new Date().toISOString(),
    summary
  });

  crownWinnerIfReady();
}

function runSkirmishAttempts(
  challenge: Challenge,
  competitors: Competitor[],
  attemptRunner: AttemptRunner
) {
  const attempts = competitors.map((competitor) => attemptRunner(competitor, challenge));
  return resolveSkirmishAttempts(attempts);
}

function eliminateCompetitor(competitorId: string) {
  const competitor = store.battle.competitors.find((entry) => entry.id === competitorId);
  if (competitor) {
    competitor.status = "eliminated";
  }
}

function crownWinnerIfReady() {
  const activeCompetitors = store.battle.competitors.filter(
    (competitor) => competitor.status === "active"
  );

  if (store.battle.status === "active" && activeCompetitors.length === 1) {
    activeCompetitors[0].status = "winner";
    store.battle.status = "complete";
    store.battle.winnerId = activeCompetitors[0].id;
    store.battle.completedAt = new Date().toISOString();
  }
}

function randomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
