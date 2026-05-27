import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { store } from "./game-store";

export type Viewer = {
  username: string;
  role: "spectator" | "admin";
};

const spectatorCookie = "br_spectator";
const adminCookie = "br_admin_session";
const defaultAdminPassword = "admin";

export function getViewer(request: NextRequest): Viewer {
  const adminSessionId = request.cookies.get(adminCookie)?.value;
  const spectatorName = request.cookies.get(spectatorCookie)?.value;

  if (adminSessionId && store.adminSessions.has(adminSessionId)) {
    return {
      username: decodeCookieValue(spectatorName) || "Admin",
      role: "admin"
    };
  }

  return {
    username: decodeCookieValue(spectatorName) || "Spectator",
    role: "spectator"
  };
}

export function requireAdmin(request: NextRequest) {
  const viewer = getViewer(request);

  if (viewer.role !== "admin") {
    return {
      viewer,
      response: NextResponse.json(
        { error: "Admin permission required." },
        { status: 403 }
      )
    };
  }

  return { viewer, response: null };
}

export function createSpectatorResponse(username: string) {
  const response = NextResponse.json({
    viewer: {
      username,
      role: "spectator"
    }
  });

  response.cookies.set(spectatorCookie, encodeCookieValue(username), {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}

export function createAdminLoginResponse(username: string, password: string) {
  const expectedPassword = process.env.ADMIN_PASSWORD || defaultAdminPassword;

  if (password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  }

  const sessionId = randomUUID();
  store.adminSessions.add(sessionId);

  const response = NextResponse.json({
    viewer: {
      username,
      role: "admin"
    }
  });

  response.cookies.set(adminCookie, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  response.cookies.set(spectatorCookie, encodeCookieValue(username), {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}

export function createLogoutResponse(request: NextRequest) {
  const sessionId = request.cookies.get(adminCookie)?.value;

  if (sessionId) {
    store.adminSessions.delete(sessionId);
  }

  const response = NextResponse.json({
    viewer: getViewer(request)
  });
  response.cookies.delete(adminCookie);
  return response;
}

function encodeCookieValue(value: string) {
  return encodeURIComponent(value);
}

function decodeCookieValue(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
