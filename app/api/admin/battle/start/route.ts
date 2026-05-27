import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/auth";
import { getPublicState, startBattle } from "../../../../../lib/game-store";

export async function POST(request: NextRequest) {
  const { response } = requireAdmin(request);

  if (response) {
    return response;
  }

  startBattle();
  return NextResponse.json(getPublicState());
}
