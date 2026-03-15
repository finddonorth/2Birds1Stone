import { NextResponse } from "next/server";
import { resolveCurrentWorkspaceId } from "../../../../lib/current-user-workspace";
import { moveRankedEntry } from "../../../../lib/setup-admin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      type?: "goals" | "projects" | "topics";
      id?: string;
      direction?: "up" | "down";
    };

    const resolved = await resolveCurrentWorkspaceId(request);
    const workspaceId = resolved.workspaceId ?? body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!body.type || !body.id || !body.direction) {
      return NextResponse.json({ error: "Type, id, and direction are required." }, { status: 400 });
    }

    await moveRankedEntry(workspaceId, body.type, body.id, body.direction);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reorder setup entry error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
