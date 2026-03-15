import { createSupabaseServerClient } from "@two-birds/api";
import { env, hasServerSyncEnv } from "./env";

type RankedTable = "goals" | "projects" | "topics";

function getServiceClient() {
  if (!hasServerSyncEnv() || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Setup editing requires Supabase server configuration.");
  }

  return createSupabaseServerClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey
  });
}

export async function addRankedEntry(workspaceId: string, table: RankedTable, title: string) {
  const client = getServiceClient();
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Title is required.");
  }

  const { data: existing, error: existingError } = await client
    .from(table)
    .select("priority_rank")
    .eq("workspace_id", workspaceId)
    .order("priority_rank", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const nextRank = (existing?.priority_rank ?? 0) + 1;
  const { error } = await client.from(table).insert({
    workspace_id: workspaceId,
    title: trimmedTitle,
    priority_rank: nextRank
  });

  if (error) {
    throw error;
  }
}

export async function deleteRankedEntry(workspaceId: string, table: RankedTable, id: string) {
  const client = getServiceClient();
  const { error } = await client.from(table).delete().eq("workspace_id", workspaceId).eq("id", id);

  if (error) {
    throw error;
  }
}

export async function moveRankedEntry(
  workspaceId: string,
  table: RankedTable,
  id: string,
  direction: "up" | "down"
) {
  const client = getServiceClient();

  const { data: entries, error } = await client
    .from(table)
    .select("id,priority_rank")
    .eq("workspace_id", workspaceId)
    .order("priority_rank", { ascending: true });

  if (error) {
    throw error;
  }

  const currentIndex = (entries ?? []).findIndex((entry) => entry.id === id);
  if (currentIndex === -1) {
    throw new Error("Entry not found.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= entries.length) {
    return;
  }

  const current = entries[currentIndex];
  const target = entries[targetIndex];

  const currentUpdate = await client
    .from(table)
    .update({ priority_rank: target.priority_rank })
    .eq("workspace_id", workspaceId)
    .eq("id", current.id);

  if (currentUpdate.error) {
    throw currentUpdate.error;
  }

  const targetUpdate = await client
    .from(table)
    .update({ priority_rank: current.priority_rank })
    .eq("workspace_id", workspaceId)
    .eq("id", target.id);

  if (targetUpdate.error) {
    throw targetUpdate.error;
  }
}

export async function addTag(workspaceId: string, label: string) {
  const client = getServiceClient();
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error("Tag label is required.");
  }

  const { error } = await client.from("tags").insert({
    workspace_id: workspaceId,
    label: trimmedLabel
  });

  if (error) {
    throw error;
  }
}

export async function deleteTag(workspaceId: string, label: string) {
  const client = getServiceClient();
  const { error } = await client.from("tags").delete().eq("workspace_id", workspaceId).eq("label", label);

  if (error) {
    throw error;
  }
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  input: {
    priorityGuidance: string;
    p1Label: string;
    p2Label: string;
    p3Label: string;
    p4Label: string;
    gentleLockEnabled: boolean;
  }
) {
  const client = getServiceClient();
  const { error } = await client.from("workspace_settings").upsert({
    workspace_id: workspaceId,
    priority_guidance: input.priorityGuidance.trim(),
    p1_label: input.p1Label.trim() || "Today",
    p2_label: input.p2Label.trim() || "End of Day",
    p3_label: input.p3Label.trim() || "End of Week",
    p4_label: input.p4Label.trim() || "Parking Lot",
    gentle_lock_enabled: input.gentleLockEnabled
  });

  if (error) {
    throw error;
  }
}
