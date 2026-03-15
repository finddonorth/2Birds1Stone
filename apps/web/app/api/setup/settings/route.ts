import { NextResponse } from "next/server";
import { resolveCurrentWorkspaceId } from "../../../../lib/current-user-workspace";
import { updateWorkspaceSettings } from "../../../../lib/setup-admin";

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      input?: {
        priorityGuidance?: string;
        p1Label?: string;
        p2Label?: string;
        p3Label?: string;
        p4Label?: string;
        gentleLockEnabled?: boolean;
      };
    };

    const resolved = await resolveCurrentWorkspaceId(request);
    const workspaceId = resolved.workspaceId ?? body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await updateWorkspaceSettings(workspaceId, {
      priorityGuidance: body.input?.priorityGuidance ?? "",
      p1Label: body.input?.p1Label ?? "",
      p2Label: body.input?.p2Label ?? "",
      p3Label: body.input?.p3Label ?? "",
      p4Label: body.input?.p4Label ?? "",
      gentleLockEnabled: Boolean(body.input?.gentleLockEnabled)
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown setup settings error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
