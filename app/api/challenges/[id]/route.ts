import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth";
import { deleteQueuedChallenge, getPublicState } from "../../../../lib/game-store";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = requireAdmin(request);

  if (response) {
    return response;
  }

  const { id } = await params;
  deleteQueuedChallenge(id);
  return NextResponse.json(getPublicState());
}
