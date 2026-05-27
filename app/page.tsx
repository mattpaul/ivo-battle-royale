"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Viewer = {
  username: string;
  role: "spectator" | "admin";
};

type Competitor = {
  id: string;
  name: string;
  status: "active" | "eliminated" | "winner";
};

type Challenge = {
  id: string;
  title: string;
  prompt: string;
  submittedBy: string;
  target: "active" | "next";
  createdAt: string;
};

type SkirmishResult = {
  competitorId: string;
  name: string;
  answer: "correct" | "incorrect" | "timeout";
  responseTimeMs?: number;
  eliminated: boolean;
};

type Skirmish = {
  id: string;
  challenge: Challenge;
  results: SkirmishResult[];
  status: "resolved" | "canceled";
  createdAt: string;
  summary: string;
};

type GameResponse = {
  viewer: Viewer;
  battle: {
    status: "lobby" | "active" | "complete";
    config: {
      competitorCount: number;
    };
    competitors: Competitor[];
    activeChallenges: Challenge[];
    queuedChallenges: Challenge[];
    skirmishes: Skirmish[];
    winnerId?: string;
  };
  counts: {
    activeCompetitors: number;
    eliminatedCompetitors: number;
    queuedChallenges: number;
    skirmishes: number;
  };
};

type ChallengeForm = {
  title: string;
  prompt: string;
  expectedAnswer: string;
  target: "active" | "next";
};

const blankChallenge: ChallengeForm = {
  title: "",
  prompt: "",
  expectedAnswer: "",
  target: "active"
};

export default function Home() {
  const [data, setData] = useState<GameResponse | null>(null);
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [competitorCount, setCompetitorCount] = useState(8);
  const [challenge, setChallenge] = useState(blankChallenge);

  const winner = useMemo(() => {
    if (!data?.battle.winnerId) {
      return null;
    }

    return data.battle.competitors.find(
      (competitor) => competitor.id === data.battle.winnerId
    );
  }, [data]);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const nextData = await api<GameResponse>("/api/game");
    setData(nextData);
    setUsername(nextData.viewer.username === "Spectator" ? "" : nextData.viewer.username);
    setCompetitorCount(nextData.battle.config.competitorCount);
  }

  async function saveSpectator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await api<{ viewer: Viewer }>("/api/spectator/session", {
      method: "POST",
      body: JSON.stringify({ username })
    });
    setMessage(`Spectating as ${response.viewer.username}.`);
    await refresh();
  }

  async function loginAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username: username || "Admin", password: adminPassword })
    });
    setAdminPassword("");
    setMessage("Admin controls unlocked.");
    await refresh();
  }

  async function logoutAdmin() {
    await api("/api/admin/logout", { method: "POST" });
    setMessage("Admin session ended.");
    await refresh();
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api("/api/admin/battle/config", {
      method: "PATCH",
      body: JSON.stringify({ competitorCount })
    });
    setMessage("Battle configuration saved.");
    await refresh();
  }

  async function startBattle() {
    await api("/api/admin/battle/start", { method: "POST" });
    setMessage("Battle started.");
    await refresh();
  }

  async function submitChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api("/api/challenges", {
      method: "POST",
      body: JSON.stringify(challenge)
    });
    setChallenge(blankChallenge);
    setMessage("Challenge submitted.");
    await refresh();
  }

  async function deleteChallenge(id: string) {
    await api(`/api/challenges/${id}`, { method: "DELETE" });
    setMessage("Queued challenge removed.");
    await refresh();
  }

  async function clearQueue() {
    await api("/api/challenges", { method: "DELETE" });
    setMessage("Queued challenges cleared.");
    await refresh();
  }

  if (!data) {
    return <main className="app content">Loading Battle Royale...</main>;
  }

  const isAdmin = data.viewer.role === "admin";
  const canSubmitActive = data.battle.status === "active";

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">Battle Royale</div>
        <div className="viewer">
          <span>{data.viewer.username}</span>
          <span className="pill">{data.viewer.role}</span>
          <button className="secondary" onClick={refresh} type="button">
            Refresh
          </button>
          {isAdmin ? (
            <button className="secondary" onClick={logoutAdmin} type="button">
              Log out
            </button>
          ) : null}
        </div>
      </header>

      <section className="content">
        <div className="stack">
          <section className="hero">
            <span className="pill">{data.battle.status}</span>
            <h1>AI agents compete. Humans spectate.</h1>
            <p>
              Submit programming challenges, watch random skirmishes resolve, and follow
              eliminations until one competitor remains.
            </p>
            <div className="stats">
              <div className="stat">
                <b>{data.counts.activeCompetitors}</b>
                <span>active</span>
              </div>
              <div className="stat">
                <b>{data.counts.eliminatedCompetitors}</b>
                <span>eliminated</span>
              </div>
              <div className="stat">
                <b>{data.counts.queuedChallenges}</b>
                <span>queued</span>
              </div>
              <div className="stat">
                <b>{data.counts.skirmishes}</b>
                <span>skirmishes</span>
              </div>
            </div>
            {winner ? <strong>{winner.name} is the champion.</strong> : null}
            {message ? <p>{message}</p> : null}
          </section>

          <div className="grid">
            <section className="panel">
              <h2>Competitors</h2>
              <ul className="list">
                {data.battle.competitors.length ? (
                  data.battle.competitors.map((competitor) => (
                    <li className="item" key={competitor.id}>
                      <div className="item-title">
                        <strong>{competitor.name}</strong>
                        <span
                          className={`pill ${
                            competitor.status === "active" || competitor.status === "winner"
                              ? "ok"
                              : "out"
                          }`}
                        >
                          {competitor.status}
                        </span>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="empty">No competitors yet.</li>
                )}
              </ul>
            </section>

            <section className="panel">
              <h2>Recent skirmishes</h2>
              <ul className="list">
                {data.battle.skirmishes.length ? (
                  data.battle.skirmishes.slice(0, 6).map((skirmish) => (
                    <li className="item skirmish-log" key={skirmish.id}>
                      <div className="item-title">
                        <strong>{skirmish.challenge.title}</strong>
                        <span className="pill">{skirmish.status}</span>
                      </div>
                      <span className="muted">{skirmish.summary}</span>
                      {skirmish.results.map((result) => (
                        <span key={result.competitorId}>
                          {result.name}: {result.answer}
                          {result.responseTimeMs
                            ? ` in ${(result.responseTimeMs / 1000).toFixed(1)}s`
                            : ""}
                          {result.eliminated ? " - eliminated" : ""}
                        </span>
                      ))}
                    </li>
                  ))
                ) : (
                  <li className="empty">No skirmishes have resolved.</li>
                )}
              </ul>
            </section>
          </div>
        </div>

        <aside className="stack">
          <section className="panel">
            <h2>Spectator</h2>
            <form className="form" onSubmit={saveSpectator}>
              <label>
                Username
                <input
                  maxLength={40}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Pick a display name"
                  value={username}
                />
              </label>
              <button type="submit">Set username</button>
            </form>
          </section>

          <section className="panel">
            <h2>Submit challenge</h2>
            <form className="form" onSubmit={submitChallenge}>
              <label>
                Destination
                <select
                  onChange={(event) =>
                    setChallenge((current) => ({
                      ...current,
                      target: event.target.value as "active" | "next"
                    }))
                  }
                  value={canSubmitActive ? challenge.target : "next"}
                >
                  <option disabled={!canSubmitActive} value="active">
                    Active battle
                  </option>
                  <option value="next">Next battle queue</option>
                </select>
              </label>
              <label>
                Title
                <input
                  onChange={(event) =>
                    setChallenge((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                  value={challenge.title}
                />
              </label>
              <label>
                Prompt
                <textarea
                  onChange={(event) =>
                    setChallenge((current) => ({ ...current, prompt: event.target.value }))
                  }
                  required
                  value={challenge.prompt}
                />
              </label>
              <label>
                Expected answer
                <input
                  onChange={(event) =>
                    setChallenge((current) => ({
                      ...current,
                      expectedAnswer: event.target.value
                    }))
                  }
                  value={challenge.expectedAnswer}
                />
              </label>
              <button type="submit">Submit</button>
            </form>
          </section>

          <section className="panel">
            <div className="item-title">
              <h2>Queued</h2>
              {isAdmin ? (
                <button
                  className="danger"
                  disabled={!data.battle.queuedChallenges.length}
                  onClick={clearQueue}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <ul className="list">
              {data.battle.queuedChallenges.length ? (
                data.battle.queuedChallenges.map((queued) => (
                  <li className="item" key={queued.id}>
                    <div className="item-title">
                      <strong>{queued.title}</strong>
                      {isAdmin ? (
                        <button
                          className="secondary"
                          onClick={() => deleteChallenge(queued.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    <span className="muted">By {queued.submittedBy}</span>
                  </li>
                ))
              ) : (
                <li className="empty">No queued challenges.</li>
              )}
            </ul>
          </section>

          <section className="panel">
            <h2>Admin</h2>
            {isAdmin ? (
              <>
                <form className="form" onSubmit={saveConfig}>
                  <label>
                    Competitors
                    <input
                      max={64}
                      min={2}
                      onChange={(event) => setCompetitorCount(Number(event.target.value))}
                      type="number"
                      value={competitorCount}
                    />
                  </label>
                  <button disabled={data.battle.status === "active"} type="submit">
                    Save config
                  </button>
                </form>
                <button onClick={startBattle} type="button">
                  Start battle
                </button>
              </>
            ) : (
              <form className="form" onSubmit={loginAdmin}>
                <label>
                  Password
                  <input
                    onChange={(event) => setAdminPassword(event.target.value)}
                    type="password"
                    value={adminPassword}
                  />
                </label>
                <button type="submit">Log in as admin</button>
                <span className="muted">Default local password: admin</span>
              </form>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}
