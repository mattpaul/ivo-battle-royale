import { randomUUID } from "crypto";
import {
  AttemptRunner,
  createMockAttemptRunner,
  resolveSkirmishAttempts
} from "./skirmish";
import { DEFAULT_COMPETITOR_COUNT } from "./game-config";

export type BattleStatus = "lobby" | "active" | "complete";
export type ChallengeTarget = "active" | "next";

export type Competitor = {
  id: string;
  name: string;
  status: "active" | "eliminated" | "winner";
  profile: CompetitorProfile;
  model: CompetitorModelConfig;
  executionLimits: CompetitorExecutionLimits;
  runState: CompetitorRunState;
  sandbox: CompetitorSandboxMetadata;
  answerHistory: CompetitorAnswerHistoryEntry[];
};

export type CompetitorProfile = {
  handle: string;
  tagline: string;
  temperament: string;
  strategy: string;
  strengths: string[];
  accentColor: string;
};

export type CompetitorModelConfig = {
  provider: "mock" | "openai" | "anthropic" | "local";
  model: string;
  temperature: number;
  maxOutputTokens: number;
};

export type CompetitorExecutionLimits = {
  challengeTimeoutMs: number;
  maxCpuMs: number;
  maxMemoryMb: number;
  maxSourceBytes: number;
};

export type CompetitorRunState = {
  status: "idle" | "selected" | "running" | "answered" | "eliminated" | "winner";
  currentSkirmishId?: string;
  currentChallengeId?: string;
  lastSkirmishId?: string;
  lastChallengeId?: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
};

export type CompetitorSandboxMetadata = {
  runtime: "nodejs";
  image: string;
  workingDirectory: string;
  network: "disabled" | "restricted";
  filesystem: "ephemeral";
};

export type CompetitorAnswerHistoryEntry = {
  challengeId: string;
  skirmishId: string;
  outcome: SkirmishCompetitorResult["answer"];
  responseTimeMs?: number;
  eliminated: boolean;
  recordedAt: string;
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

const competitorProfiles: CompetitorProfile[] = [
  {
    handle: "ada-lambda",
    tagline: "Elegant recursive problem solver",
    temperament: "Careful and terse",
    strategy: "Builds small proofs before writing code.",
    strengths: ["math", "recursion", "edge cases"],
    accentColor: "#0f766e"
  },
  {
    handle: "grace-hopperbot",
    tagline: "Pragmatic debugger with stopwatch energy",
    temperament: "Fast and skeptical",
    strategy: "Writes runnable checks early and trusts failing tests.",
    strengths: ["debugging", "parsing", "systems"],
    accentColor: "#7c3aed"
  },
  {
    handle: "linus-loop",
    tagline: "Low-level optimizer with sharp elbows",
    temperament: "Direct and performance-minded",
    strategy: "Reduces problems to tight loops and explicit invariants.",
    strengths: ["performance", "bit math", "data structures"],
    accentColor: "#b45309"
  },
  {
    handle: "margaret-stack",
    tagline: "Mission-control planner for messy specs",
    temperament: "Methodical and resilient",
    strategy: "Turns vague prompts into checklists before coding.",
    strengths: ["planning", "validation", "integration"],
    accentColor: "#be123c"
  },
  {
    handle: "katherine-kernel",
    tagline: "Numerical analyst with orbital calm",
    temperament: "Precise and patient",
    strategy: "Normalizes inputs, proves bounds, then computes.",
    strengths: ["number theory", "precision", "simulation"],
    accentColor: "#2563eb"
  },
  {
    handle: "donald-knuthread",
    tagline: "Algorithm archivist with a taste for rigor",
    temperament: "Scholarly and exacting",
    strategy: "Names the algorithm before implementing it.",
    strengths: ["algorithms", "complexity", "combinatorics"],
    accentColor: "#4d7c0f"
  },
  {
    handle: "barbara-liskovite",
    tagline: "Contract-first object modeler",
    temperament: "Principled and steady",
    strategy: "Defines interfaces and invariants before filling behavior.",
    strengths: ["abstractions", "types", "correctness"],
    accentColor: "#0891b2"
  },
  {
    handle: "edsger-dijkstrap",
    tagline: "Graph tactician who distrusts magic",
    temperament: "Minimal and formal",
    strategy: "Finds the invariant hiding under the story.",
    strengths: ["graphs", "proofs", "shortest paths"],
    accentColor: "#4338ca"
  }
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
    (_, index) => createCompetitor(index)
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
  const skirmishId = randomUUID();
  const selectedAt = new Date().toISOString();

  selected.forEach((competitor) => {
    competitor.runState = {
      status: "selected",
      currentSkirmishId: skirmishId,
      currentChallengeId: challenge.id,
      startedAt: selectedAt
    };
  });

  const { eliminatedIds, results, status, summary } = runSkirmishAttempts(
    challenge,
    selected,
    createMockAttemptRunner()
  );

  eliminatedIds.forEach(eliminateCompetitor);
  recordAnswerHistory(skirmishId, challenge, results);

  store.battle.skirmishes.unshift({
    id: skirmishId,
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
    competitor.runState.status = "eliminated";
  }
}

function crownWinnerIfReady() {
  const activeCompetitors = store.battle.competitors.filter(
    (competitor) => competitor.status === "active"
  );

  if (store.battle.status === "active" && activeCompetitors.length === 1) {
    activeCompetitors[0].status = "winner";
    activeCompetitors[0].runState.status = "winner";
    activeCompetitors[0].runState.completedAt = new Date().toISOString();
    store.battle.status = "complete";
    store.battle.winnerId = activeCompetitors[0].id;
    store.battle.completedAt = new Date().toISOString();
  }
}

function createCompetitor(index: number): Competitor {
  const profile = competitorProfiles[index % competitorProfiles.length];
  const displayNumber = String(index + 1).padStart(2, "0");

  return {
    id: `agent-${displayNumber}-${profile.handle}`,
    name: toDisplayName(profile.handle),
    status: "active",
    profile,
    model: {
      provider: "mock",
      model: `mock-code-agent-${displayNumber}`,
      temperature: 0.2,
      maxOutputTokens: 2_048
    },
    executionLimits: {
      challengeTimeoutMs: 60_000,
      maxCpuMs: 10_000,
      maxMemoryMb: 256,
      maxSourceBytes: 20_000
    },
    runState: {
      status: "idle"
    },
    sandbox: {
      runtime: "nodejs",
      image: "node:24-slim",
      workingDirectory: `/tmp/battle-royale/${profile.handle}`,
      network: "disabled",
      filesystem: "ephemeral"
    },
    answerHistory: []
  };
}

function recordAnswerHistory(
  skirmishId: string,
  challenge: Challenge,
  results: SkirmishCompetitorResult[]
) {
  const recordedAt = new Date().toISOString();

  results.forEach((result) => {
    const competitor = store.battle.competitors.find(
      (entry) => entry.id === result.competitorId
    );

    if (!competitor) {
      return;
    }

    competitor.answerHistory.unshift({
      challengeId: challenge.id,
      skirmishId,
      outcome: result.answer,
      responseTimeMs: result.responseTimeMs,
      eliminated: result.eliminated,
      recordedAt
    });

    competitor.runState = {
      status: result.eliminated ? "eliminated" : "idle",
      lastSkirmishId: skirmishId,
      lastChallengeId: challenge.id,
      completedAt: recordedAt
    };
  });
}

function toDisplayName(handle: string) {
  return handle
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
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
