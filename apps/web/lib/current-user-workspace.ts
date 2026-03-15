import { createSupabaseServerClient } from "@two-birds/api";
import { env, hasServerSyncEnv } from "./env";
import { createSupabaseServerAuthClient } from "./supabase/server";
import { ensureWorkspaceForUser } from "./workspaces";

export async function resolveCurrentWorkspaceId(request?: Request) {
  if (!hasServerSyncEnv()) {
    return {
      workspaceId: env.defaultWorkspaceId,
      userId: undefined
    };
  }

  const authHeader = request?.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (bearerToken && env.supabaseUrl && env.supabaseServiceRoleKey) {
    const serviceClient = createSupabaseServerClient({
      url: env.supabaseUrl,
      serviceRoleKey: env.supabaseServiceRoleKey
    });
    const {
      data: { user },
      error
    } = await serviceClient.auth.getUser(bearerToken);

    if (error) {
      throw error;
    }

    if (user) {
      const workspaceId = await ensureWorkspaceForUser(user.id);
      return {
        workspaceId,
        userId: user.id
      };
    }
  }

  const supabase = await createSupabaseServerAuthClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      workspaceId: undefined,
      userId: undefined
    };
  }

  const workspaceId = await ensureWorkspaceForUser(user.id);
  return {
    workspaceId,
    userId: user.id
  };
}
