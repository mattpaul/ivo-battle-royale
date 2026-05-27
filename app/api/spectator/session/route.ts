import { NextRequest } from "next/server";
import { createSpectatorResponse } from "../../../../lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "").trim().slice(0, 40);

  if (!username) {
    return Response.json({ error: "Username is required." }, { status: 400 });
  }

  return createSpectatorResponse(username);
}
