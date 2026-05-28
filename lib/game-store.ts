import { randomUUID } from "crypto";
import {
  createMockAttemptRunner,
  resolveSkirmishAttempts
} from "./skirmish.ts";
import type { AttemptRunner } from "./skirmish.ts";
import { DEFAULT_COMPETITOR_COUNT } from "./game-config.ts";

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
  apiKeyEnvVar?: string;
  configured: boolean;
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
  submittedAnswer?: string;
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

export async function startBattle() {
  const queuedChallenges = store.battle.queuedChallenges.map((challenge) => ({
    ...challenge,
    target: "active" as const
  }));
  const competitors = Array.from(
    { length: store.battle.config.competitorCount },
    (_, index) => createCompetitor(index)
  );

  store.battle = {
    ...defaultBattle(),
    status: "active",
    config: { ...store.battle.config },
    competitors,
    activeChallenges: queuedChallenges,
    queuedChallenges: [],
    startedAt: new Date().toISOString()
  };

  debugLog(
    `battle started competitors=${competitors.length} queuedChallenges=${queuedChallenges.length}`
  );
  competitors.forEach((competitor) => {
    debugLog(
      `competitor configured id=${competitor.id} provider=${competitor.model.provider} model=${competitor.model.model} configured=${competitor.model.configured}`
    );
  });

  for (const challenge of queuedChallenges) {
    debugLog(`processing queued challenge id=${challenge.id}`);
    await resolveSkirmish(challenge);
  }
}

export async function submitChallenge(input: {
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
    await resolveSkirmish(challenge);
  } else {
    store.battle.queuedChallenges.unshift({ ...challenge, target: "next" });
    debugLog(`challenge queued id=${challenge.id} submittedBy=${challenge.submittedBy}`);
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

async function resolveSkirmish(challenge: Challenge) {
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
  debugLog(
    `skirmish created id=${skirmishId} challenge=${challenge.id} competitors=${selected.map((competitor) => competitor.id).join(",")}`
  );

  selected.forEach((competitor) => {
    competitor.runState = {
      status: "running",
      currentSkirmishId: skirmishId,
      currentChallengeId: challenge.id,
      startedAt: selectedAt
    };
  });

  const { eliminatedIds, results, status, summary } = await runSkirmishAttempts(
    challenge,
    selected,
    createConfiguredAttemptRunner()
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
  debugLog(`skirmish resolved id=${skirmishId} status=${status} summary="${summary}"`);
}

async function runSkirmishAttempts(
  challenge: Challenge,
  competitors: Competitor[],
  attemptRunner: AttemptRunner
) {
  const attempts = await Promise.all(
    competitors.map((competitor) => attemptRunner(competitor, challenge))
  );
  return resolveSkirmishAttempts(attempts);
}

export function createConfiguredAttemptRunner(): AttemptRunner {
  return async (competitor, challenge) => {
    switch (competitor.model.provider) {
      case "mock": {
        debugLog(
          `mock attempt competitor=${competitor.id} challenge=${challenge.id} model=${competitor.model.model}`
        );
        return createMockAttemptRunner()(competitor, challenge);
      }
      case "openai":
        return runOpenAIAttempt(competitor, challenge);
      default:
        debugLog(
          `attempt unsupported competitor=${competitor.id} challenge=${challenge.id} provider=${competitor.model.provider}`
        );
        return {
          competitorId: competitor.id,
          name: competitor.name,
          answer: "incorrect"
        };
    }
  };
}

async function runOpenAIAttempt(
  competitor: Competitor,
  challenge: Challenge
): Promise<Omit<SkirmishCompetitorResult, "eliminated">> {
  const startedAt = Date.now();

  if (!process.env.OPENAI_API_KEY) {
    debugLog(
      `openai attempt skipped competitor=${competitor.id} challenge=${challenge.id} missing OPENAI_API_KEY`
    );
    return {
      competitorId: competitor.id,
      name: competitor.name,
      answer: "timeout"
    };
  }

  debugLog(
    `openai attempt start competitor=${competitor.id} challenge=${challenge.id} model=${competitor.model.model} promptChars=${challenge.prompt.length}`
  );

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    competitor.executionLimits.challengeTimeoutMs
  );

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: competitor.model.model,
        input: [
          {
            role: "developer",
            content:
              "You are competing in Battle Royale as an AI coding agent. Solve the challenge and return only the final answer, with no explanation."
          },
          {
            role: "user",
            content: challenge.prompt
          }
        ],
        max_output_tokens: competitor.model.maxOutputTokens
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      debugLog(
        `openai attempt error competitor=${competitor.id} challenge=${challenge.id} status=${response.status} body=${JSON.stringify(payload).slice(0, 500)}`
      );
      return {
        competitorId: competitor.id,
        name: competitor.name,
        answer: "incorrect",
        responseTimeMs: Date.now() - startedAt
      };
    }

    const submittedAnswer = extractOpenAIText(payload);
    const isCorrect = isCorrectAnswer(submittedAnswer, challenge.expectedAnswer);
    const responseTimeMs = Date.now() - startedAt;

    debugLog(
      `openai attempt complete competitor=${competitor.id} challenge=${challenge.id} responseTimeMs=${responseTimeMs} correct=${isCorrect} submitted="${submittedAnswer.slice(0, 160)}"`
    );

    return {
      competitorId: competitor.id,
      name: competitor.name,
      answer: isCorrect ? "correct" : "incorrect",
      responseTimeMs,
      submittedAnswer
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    debugLog(
      `openai attempt ${isAbort ? "timeout" : "failure"} competitor=${competitor.id} challenge=${challenge.id} error=${error instanceof Error ? error.message : String(error)}`
    );
    return {
      competitorId: competitor.id,
      name: competitor.name,
      answer: isAbort ? "timeout" : "incorrect",
      responseTimeMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeout);
  }
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
    model: createCompetitorModelConfig(displayNumber),
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

export function createCompetitorModelConfig(
  displayNumber: string
): CompetitorModelConfig {
  const provider = process.env.BATTLE_ROYALE_AGENT_PROVIDER ?? "mock";

  if (provider === "openai") {
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-5",
      temperature: parseNumber(process.env.OPENAI_TEMPERATURE, 0.2),
      maxOutputTokens: parseInteger(process.env.OPENAI_MAX_OUTPUT_TOKENS, 2_048),
      apiKeyEnvVar: "OPENAI_API_KEY",
      configured: Boolean(process.env.OPENAI_API_KEY)
    };
  }

  return {
    provider: "mock",
    model: `mock-code-agent-${displayNumber}`,
    temperature: 0.2,
    maxOutputTokens: 2_048,
    configured: true
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

function parseInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractOpenAIText(payload: unknown) {
  if (!isRecord(payload) || payload.status !== "completed") {
    debugLog(`openai payload=${JSON.stringify(payload).slice(0, 2_000)}`);
  }

  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }

  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => {
      if (!isRecord(item) || !Array.isArray(item.content)) {
        return [];
      }

      return item.content.map((content) => {
        if (isRecord(content) && typeof content.text === "string") {
          return content.text;
        }

        return "";
      });
    })
    .join("")
    .trim();
}

function isCorrectAnswer(submittedAnswer: string, expectedAnswer?: string) {
  if (!expectedAnswer) {
    return false;
  }

  const submitted = normalizeAnswer(submittedAnswer);
  const expected = normalizeAnswer(expectedAnswer);

  return submitted === expected || submitted.includes(expected);
}

function normalizeAnswer(answer: string) {
  return answer
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim()
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function debugLog(message: string) {
  console.info(`[battle-royale] ${message}`);
}
