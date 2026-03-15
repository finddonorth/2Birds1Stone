import { NextResponse } from "next/server";
import { sendReminderEmails } from "../../../../lib/notifications";
import { resolveCurrentWorkspaceId } from "../../../../lib/current-user-workspace";
import { env } from "../../../../lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorizedCronRequest(request: Request) {
  if (!env.notificationCronSecret) {
    return false;
  }

  const cronSecret = request.headers.get("x-cron-secret");
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  return cronSecret === env.notificationCronSecret || bearerToken === env.notificationCronSecret;
}

async function handleSend(request: Request) {
  try {
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest) {
      const resolved = await resolveCurrentWorkspaceId(request);
      if (!resolved.workspaceId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const result = await sendReminderEmails({
        workspaceId: resolved.workspaceId,
        windowMinutes: 60
      });

      return NextResponse.json({
        ok: true,
        scope: "workspace",
        ...result
      });
    }

    const result = await sendReminderEmails();
    return NextResponse.json({
      ok: true,
      scope: "all-workspaces",
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send reminder emails.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleSend(request);
}

export async function GET(request: Request) {
  return handleSend(request);
}
