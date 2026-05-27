import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/auth";
import { configureBattle, getPublicState } from "../../../../../lib/game-store";

export async function PATCH(request: NextRequest) {
  const { response } = requireAdmin(request);

  if (response) {
    return response;
  }

  const body = await request.json().catch(() => ({}));

  try {
    configureBattle(Number(body.competitorCount));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to configure battle." },
      { status: 400 }
    );
  }

  return NextResponse.json(getPublicState());
}
