import { NextResponse } from "next/server";
import { resolveCurrentWorkspaceId } from "../../../../lib/current-user-workspace";
import { addRankedEntry, addTag, deleteRankedEntry, deleteTag } from "../../../../lib/setup-admin";

type SetupEntryType = "goals" | "projects" | "topics" | "tags";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      type?: SetupEntryType;
      value?: string;
    };

    const resolved = await resolveCurrentWorkspaceId(request);
    const workspaceId = resolved.workspaceId ?? body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!body.type || !body.value?.trim()) {
      return NextResponse.json({ error: "Type and value are required." }, { status: 400 });
    }

    if (body.type === "tags") {
      await addTag(workspaceId, body.value);
    } else {
      await addRankedEntry(workspaceId, body.type, body.value);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown add setup entry error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      type?: SetupEntryType;
      identifier?: {
        id?: string;
        label?: string;
      };
    };

    const resolved = await resolveCurrentWorkspaceId(request);
    const workspaceId = resolved.workspaceId ?? body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!body.type) {
      return NextResponse.json({ error: "Type is required." }, { status: 400 });
    }

    if (body.type === "tags") {
      if (!body.identifier?.label) {
        return NextResponse.json({ error: "Tag label is required." }, { status: 400 });
      }
      await deleteTag(workspaceId, body.identifier.label);
    } else {
      if (!body.identifier?.id) {
        return NextResponse.json({ error: "Entry id is required." }, { status: 400 });
      }
      await deleteRankedEntry(workspaceId, body.type, body.identifier.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delete setup entry error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
