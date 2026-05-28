import assert from "node:assert/strict";
import test from "node:test";
import {
  createMockAttemptRunner,
  resolveSkirmishAttempts,
  type CompetitorAttempt
} from "./skirmish.ts";
import {
  createConfiguredAttemptRunner,
  createCompetitorModelConfig,
  type Competitor
} from "./game-store.ts";

const competitors: Competitor[] = [
  competitor("ada", "Ada Lambda"),
  competitor("grace", "Grace Hopperbot"),
  competitor("linus", "Linus Loop")
];

test("cancels the skirmish when every competitor fails", () => {
  const result = resolveSkirmishAttempts([
    attempt("ada", "Ada Lambda", "incorrect", 12_000),
    attempt("grace", "Grace Hopperbot", "timeout")
  ]);

  assert.equal(result.status, "canceled");
  assert.deepEqual(result.eliminatedIds, []);
  assert.deepEqual(
    result.results.map((entry) => entry.eliminated),
    [false, false]
  );
});

test("eliminates incorrect and timed out competitors when at least one answer is correct", () => {
  const result = resolveSkirmishAttempts([
    attempt("ada", "Ada Lambda", "correct", 12_000),
    attempt("grace", "Grace Hopperbot", "incorrect", 10_000),
    attempt("linus", "Linus Loop", "timeout")
  ]);

  assert.equal(result.status, "resolved");
  assert.deepEqual(result.eliminatedIds, ["grace", "linus"]);
  assert.deepEqual(
    result.results.map((entry) => [entry.competitorId, entry.eliminated]),
    [
      ["ada", false],
      ["grace", true],
      ["linus", true]
    ]
  );
});

test("eliminates the slowest competitor when every answer is correct", () => {
  const result = resolveSkirmishAttempts([
    attempt("ada", "Ada Lambda", "correct", 12_000),
    attempt("grace", "Grace Hopperbot", "correct", 32_000),
    attempt("linus", "Linus Loop", "correct", 16_000)
  ]);

  assert.equal(result.status, "resolved");
  assert.deepEqual(result.eliminatedIds, ["grace"]);
  assert.equal(result.results.find((entry) => entry.competitorId === "grace")?.eliminated, true);
});

test("preserves the previous mock timeout threshold", () => {
  const runner = createMockAttemptRunner(sequence([0.17]));
  const result = runner(competitors[0], sampleChallenge());

  assert.deepEqual(result, {
    competitorId: "ada",
    name: "Ada Lambda",
    answer: "timeout"
  });
});

test("preserves the previous mock incorrect threshold and response-time range", () => {
  const runner = createMockAttemptRunner(sequence([0.18, 0]));
  const result = runner(competitors[1], sampleChallenge());

  assert.deepEqual(result, {
    competitorId: "grace",
    name: "Grace Hopperbot",
    answer: "incorrect",
    responseTimeMs: 6_000
  });
});

test("preserves the previous mock correct threshold and response-time range", () => {
  const runner = createMockAttemptRunner(sequence([0.38, 0]));
  const result = runner(competitors[2], sampleChallenge());

  assert.deepEqual(result, {
    competitorId: "linus",
    name: "Linus Loop",
    answer: "correct",
    responseTimeMs: 4_000
  });
});

test("configures OpenAI competitors from environment without exposing the API key", () => {
  withEnv(
    {
      BATTLE_ROYALE_AGENT_PROVIDER: "openai",
      OPENAI_API_KEY: "test-secret-key",
      OPENAI_MODEL: "gpt-5",
      OPENAI_TEMPERATURE: "0.1",
      OPENAI_MAX_OUTPUT_TOKENS: "4096"
    },
    () => {
      const config = createCompetitorModelConfig("01");

      assert.deepEqual(config, {
        provider: "openai",
        model: "gpt-5",
        temperature: 0.1,
        maxOutputTokens: 4_096,
        apiKeyEnvVar: "OPENAI_API_KEY",
        configured: true
      });
      assert.equal(JSON.stringify(config).includes("test-secret-key"), false);
    }
  );
});

test("marks OpenAI competitors unconfigured when the API key is missing", () => {
  withEnv(
    {
      BATTLE_ROYALE_AGENT_PROVIDER: "openai",
      OPENAI_API_KEY: undefined,
      OPENAI_MODEL: undefined,
      OPENAI_TEMPERATURE: undefined,
      OPENAI_MAX_OUTPUT_TOKENS: undefined
    },
    () => {
      const config = createCompetitorModelConfig("01");

      assert.equal(config.provider, "openai");
      assert.equal(config.model, "gpt-5");
      assert.equal(config.configured, false);
      assert.equal(config.apiKeyEnvVar, "OPENAI_API_KEY");
    }
  );
});

test("does not fall back to mock attempts for OpenAI competitors", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: undefined
    },
    async () => {
      const openAICompetitor = competitor("openai", "OpenAI Agent");
      openAICompetitor.model = {
        provider: "openai",
        model: "gpt-5",
        temperature: 0.2,
        maxOutputTokens: 2_048,
        apiKeyEnvVar: "OPENAI_API_KEY",
        configured: false
      };

      const attemptRunner = createConfiguredAttemptRunner();
      const result = await attemptRunner(openAICompetitor, sampleChallenge());

      assert.deepEqual(result, {
        competitorId: "openai",
        name: "OpenAI Agent",
        answer: "timeout"
      });
    }
  );
});

test("returns mock attempts only for mock competitors", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: undefined
    },
    async () => {
      const attemptRunner = createConfiguredAttemptRunner();
      const result = await attemptRunner(competitors[0], sampleChallenge());

      assert.equal(result.competitorId, "ada");
      assert.match(result.answer, /correct|incorrect|timeout/);
    }
  );
});

function attempt(
  competitorId: string,
  name: string,
  answer: CompetitorAttempt["answer"],
  responseTimeMs?: number
): CompetitorAttempt {
  return {
    competitorId,
    name,
    answer,
    responseTimeMs
  };
}

function sampleChallenge() {
  return {
    id: "challenge-1",
    prompt: "Write FizzBuzz.",
    submittedBy: "Spectator",
    target: "active" as const,
    createdAt: new Date(0).toISOString()
  };
}

function sequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

function competitor(id: string, name: string): Competitor {
  return {
    id,
    name,
    status: "active",
    profile: {
      handle: id,
      tagline: "Test competitor",
      temperament: "Deterministic",
      strategy: "Return controlled mock attempts.",
      strengths: ["tests"],
      accentColor: "#0f766e"
    },
    model: {
      provider: "mock",
      model: "mock-code-agent-test",
      temperature: 0,
      maxOutputTokens: 1_024,
      configured: true
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
      workingDirectory: `/tmp/battle-royale/${id}`,
      network: "disabled",
      filesystem: "ephemeral"
    },
    answerHistory: []
  };
}

async function withEnv(
  overrides: Record<string, string | undefined>,
  callback: () => void | Promise<void>
) {
  const previous = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]])
  );

  try {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    await callback();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}
