import { NextRequest, NextResponse } from "next/server";
import { getViewer, requireAdmin } from "../../../lib/auth";
import {
  ChallengeTarget,
  clearQueuedChallenges,
  getPublicState,
  submitChallenge
} from "../../../lib/game-store";

export async function POST(request: NextRequest) {
  const viewer = getViewer(request);
  const body = await request.json().catch(() => ({}));
  const target = body.target === "active" ? "active" : "next";

  try {
    const challenge = submitChallenge({
      id: String(body.id || ""),
      prompt: String(body.prompt || ""),
      expectedAnswer: body.expectedAnswer ? String(body.expectedAnswer) : undefined,
      submittedBy: viewer.username,
      target: target as ChallengeTarget
    });

    return NextResponse.json({
      challenge,
      ...getPublicState()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit challenge." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { response } = requireAdmin(request);

  if (response) {
    return response;
  }

  clearQueuedChallenges();
  return NextResponse.json(getPublicState());
}
