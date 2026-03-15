import { NextResponse } from "next/server";
import { resolveCurrentWorkspaceId } from "../../../../../lib/current-user-workspace";
import { getServerSyncApi } from "../../../../../lib/server-sync";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      workspaceId?: string;
    };

    const resolved = await resolveCurrentWorkspaceId(request);
    const workspaceId = resolved.workspaceId ?? body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const api = getServerSyncApi();
    const result = await api.classifyInboxItem(workspaceId, id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown classify error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
