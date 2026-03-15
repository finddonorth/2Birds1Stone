import { demoWorkspaceSnapshot } from "@two-birds/shared";
import { createSupabaseServerClient } from "@two-birds/api";
import { env } from "./env";

function requireServiceEnv() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function createWorkspaceSlug(userId: string) {
  return `workspace-${userId}`;
}

export async function ensureWorkspaceForUser(userId: string) {
  requireServiceEnv();

  const client = createSupabaseServerClient({
    url: env.supabaseUrl!,
    serviceRoleKey: env.supabaseServiceRoleKey!
  });

  const existingMembership = await client
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingMembership.error) {
    throw existingMembership.error;
  }

  if (existingMembership.data?.workspace_id) {
    return existingMembership.data.workspace_id;
  }

  const workspaceId = createWorkspaceSlug(userId);

  const workspaceInsert = await client
    .from("workspaces")
    .insert({
      id: workspaceId,
      name: "My 2Birds1Stone Workspace"
    })
    .select("id")
    .single();

  if (workspaceInsert.error && workspaceInsert.error.code !== "23505") {
    throw workspaceInsert.error;
  }

  const membershipInsert = await client.from("workspace_memberships").insert({
    workspace_id: workspaceId,
    user_id: userId,
    role: "owner"
  });

  if (membershipInsert.error && membershipInsert.error.code !== "23505") {
    throw membershipInsert.error;
  }

  await client.from("workspace_settings").upsert({
    workspace_id: workspaceId,
    priority_guidance: demoWorkspaceSnapshot.settings.priorityGuidance,
    p1_label: demoWorkspaceSnapshot.settings.p1Label,
    p2_label: demoWorkspaceSnapshot.settings.p2Label,
    p3_label: demoWorkspaceSnapshot.settings.p3Label,
    p4_label: demoWorkspaceSnapshot.settings.p4Label,
    gentle_lock_enabled: demoWorkspaceSnapshot.settings.gentleLockEnabled
  });

  await client.from("goals").upsert(
    demoWorkspaceSnapshot.goals.map((goal) => ({
      workspace_id: workspaceId,
      title: goal.title,
      priority_rank: goal.priorityRank
    })),
    { onConflict: "workspace_id,title" }
  );

  await client.from("projects").upsert(
    demoWorkspaceSnapshot.projects.map((project) => ({
      workspace_id: workspaceId,
      title: project.title,
      priority_rank: project.priorityRank
    })),
    { onConflict: "workspace_id,title" }
  );

  await client.from("topics").upsert(
    demoWorkspaceSnapshot.topics.map((topic) => ({
      workspace_id: workspaceId,
      title: topic.title,
      priority_rank: topic.priorityRank
    })),
    { onConflict: "workspace_id,title" }
  );

  await client.from("tags").upsert(
    demoWorkspaceSnapshot.tags.map((tag) => ({
      workspace_id: workspaceId,
      label: tag
    })),
    { onConflict: "workspace_id,label" }
  );

  return workspaceId;
}
