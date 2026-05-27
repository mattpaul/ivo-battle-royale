import { NextRequest } from "next/server";
import { createAdminLoginResponse } from "../../../../lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "Admin").trim().slice(0, 40) || "Admin";
  const password = String(body.password || "");

  return createAdminLoginResponse(username, password);
}
