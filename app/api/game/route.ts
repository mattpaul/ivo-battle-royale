import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "../../../lib/auth";
import { getPublicState } from "../../../lib/game-store";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    viewer: getViewer(request),
    ...getPublicState()
  });
}
