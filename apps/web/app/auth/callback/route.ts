import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "../../../lib/supabase/server";
import { ensureWorkspaceForUser } from "../../../lib/workspaces";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  try {
    if (code) {
      const supabase = await createSupabaseServerAuthClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (user) {
          await ensureWorkspaceForUser(user.id);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish sign-in.";
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", message);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL("/", request.url));
}
