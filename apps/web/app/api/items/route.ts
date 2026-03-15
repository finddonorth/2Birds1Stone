import { NextResponse } from "next/server";
import { resolveCurrentWorkspaceId } from "../../../lib/current-user-workspace";
import { getServerSyncApi } from "../../../lib/server-sync";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      input?: {
        kind: "idea" | "task";
        title: string;
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
        attachments?: {
          fileName: string;
          mimeType?: string;
          url: string;
        }[];
      };
    };

    if (!body.input?.title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const resolved = await resolveCurrentWorkspaceId(request);
    const workspaceId = resolved.workspaceId ?? body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const api = getServerSyncApi();
    const item = await api.createInboxItem(workspaceId, body.input);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown create item error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
