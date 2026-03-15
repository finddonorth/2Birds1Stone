import { NextResponse } from "next/server";
import { resolveCurrentWorkspaceId } from "../../../lib/current-user-workspace";
import { getServerSyncApi } from "../../../lib/server-sync";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const resolved = await resolveCurrentWorkspaceId(request);
    const workspaceId = resolved.workspaceId ?? searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const api = getServerSyncApi();
    const snapshot = await api.getWorkspaceSnapshot(workspaceId);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workspace fetch error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
