import { NextResponse } from "next/server";
import { resolveCurrentWorkspaceId } from "../../../../lib/current-user-workspace";
import { getServerSyncApi } from "../../../../lib/server-sync";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      workspaceId?: string;
      manualRank?: number;
      input?: {
        kind?: "idea" | "task";
        status?: "open" | "done" | "archived";
        title?: string;
        notes?: string;
        relativePriority?: "p1" | "p2" | "p3" | "p4";
        tags?: string[];
        projectId?: string;
        topicId?: string;
        isMultiDay?: boolean;
        startAt?: string;
        dueAt?: string;
        followUpContact?: {
          fullName: string;
          email?: string;
          phone?: string;
        };
      };
    };

    const resolved = await resolveCurrentWorkspaceId(request);
    const workspaceId = resolved.workspaceId ?? body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const api = getServerSyncApi();
    if (typeof body.manualRank === "number") {
      await api.reorderInboxItem(workspaceId, id, body.manualRank);
      return NextResponse.json({ ok: true });
    }

    if (body.input) {
      await api.updateInboxItem(workspaceId, id, body.input);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "manualRank or input is required." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reorder error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
