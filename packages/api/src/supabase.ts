import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { InboxItem, SetupEntryType, UpdateInboxItemInput, WorkspaceSnapshot, WorkspaceSettingsInput } from "@two-birds/shared";
import type { AIClassificationResult, CreateInboxItemInput, SyncApi } from "./index";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type RowSnapshot = {
  goals: { id: string; title: string; priority_rank: number }[];
  projects: { id: string; title: string; priority_rank: number }[];
  topics: { id: string; title: string; priority_rank: number }[];
  tags: { label: string }[];
  settings:
    | {
        priority_guidance: string;
        p1_label: string;
        p2_label: string;
        p3_label: string;
        p4_label: string;
        gentle_lock_enabled: boolean;
      }
    | null;
  items: {
    id: string;
    kind: "idea" | "task";
    status: "open" | "done" | "archived";
    title: string;
    notes: string;
    tags: string[] | null;
    relative_priority: "p1" | "p2" | "p3" | "p4";
    ordering_mode: "ai" | "manual";
    manual_rank: number | null;
    ai_rank: number | null;
    project_id: string | null;
    topic_id: string | null;
    is_multi_day: boolean;
    start_at: string | null;
    due_at: string | null;
    follow_up_contact: Json | null;
    attachments: Json | null;
    ai_summary: Json | null;
  }[];
};

function mapRowItem(item: RowSnapshot["items"][number]): InboxItem {
  const followUpContact =
    item.follow_up_contact && typeof item.follow_up_contact === "object" && !Array.isArray(item.follow_up_contact)
      ? (item.follow_up_contact as {
          id?: string;
          fullName?: string;
          email?: string;
          phone?: string;
        })
      : undefined;
  const attachments =
    item.attachments && Array.isArray(item.attachments)
      ? (item.attachments as {
          id?: string;
          fileName?: string;
          mimeType?: string;
          url?: string;
        }[])
      : [];
  const aiSummary =
    item.ai_summary && typeof item.ai_summary === "object" && !Array.isArray(item.ai_summary)
      ? (item.ai_summary as {
          suggestedKind?: "idea" | "task";
          suggestedPriority?: "p1" | "p2" | "p3" | "p4";
          suggestedProjectId?: string;
          suggestedTopicId?: string;
          suggestedTags?: string[];
          reasoning?: string;
        })
      : undefined;

  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    title: item.title,
    notes: item.notes,
    tags: item.tags ?? [],
    relativePriority: item.relative_priority,
    orderingMode: item.ordering_mode,
    manualRank: item.manual_rank ?? undefined,
    aiRank: item.ai_rank ?? undefined,
    projectId: item.project_id ?? undefined,
    topicId: item.topic_id ?? undefined,
    isMultiDay: item.is_multi_day,
    startAt: item.start_at ?? undefined,
    dueAt: item.due_at ?? undefined,
    followUpContact: followUpContact?.fullName
      ? {
          id: followUpContact.id ?? `contact-${item.id}`,
          fullName: followUpContact.fullName,
          email: followUpContact.email,
          phone: followUpContact.phone
        }
      : undefined,
    attachments: attachments
      .filter((attachment) => attachment.fileName && attachment.url)
      .map((attachment, index) => ({
        id: attachment.id ?? `${item.id}-attachment-${index + 1}`,
        fileName: attachment.fileName ?? "Attachment",
        mimeType: attachment.mimeType ?? "text/uri-list",
        url: attachment.url ?? ""
      })),
    aiSuggestedSummary: aiSummary
      ? {
          suggestedKind: aiSummary.suggestedKind,
          suggestedPriority: aiSummary.suggestedPriority,
          suggestedProjectId: aiSummary.suggestedProjectId,
          suggestedTopicId: aiSummary.suggestedTopicId,
          suggestedTags: aiSummary.suggestedTags,
          reasoning: aiSummary.reasoning
        }
      : undefined
  };
}

async function fetchWorkspaceSnapshot(client: SupabaseClient, workspaceId: string): Promise<WorkspaceSnapshot> {
  const [goals, projects, topics, tags, settings, items] = await Promise.all([
    client.from("goals").select("id,title,priority_rank").eq("workspace_id", workspaceId).order("priority_rank"),
    client.from("projects").select("id,title,priority_rank").eq("workspace_id", workspaceId).order("priority_rank"),
    client.from("topics").select("id,title,priority_rank").eq("workspace_id", workspaceId).order("priority_rank"),
    client.from("tags").select("label").eq("workspace_id", workspaceId).order("label"),
    client.from("workspace_settings").select("priority_guidance,p1_label,p2_label,p3_label,p4_label,gentle_lock_enabled").eq("workspace_id", workspaceId).maybeSingle(),
    client.from("inbox_items").select("id,kind,status,title,notes,tags,relative_priority,ordering_mode,manual_rank,ai_rank,project_id,topic_id,is_multi_day,start_at,due_at,follow_up_contact,attachments,ai_summary").eq("workspace_id", workspaceId).order("created_at", { ascending: false })
  ]);

  for (const result of [goals, projects, topics, tags, settings, items]) {
    if (result.error) {
      throw result.error;
    }
  }

  const rows: RowSnapshot = {
    goals: goals.data ?? [],
    projects: projects.data ?? [],
    topics: topics.data ?? [],
    tags: tags.data ?? [],
    settings: settings.data ?? null,
    items: items.data ?? []
  };

  return {
    goals: rows.goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      priorityRank: goal.priority_rank
    })),
    projects: rows.projects.map((project) => ({
      id: project.id,
      title: project.title,
      priorityRank: project.priority_rank
    })),
    topics: rows.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      priorityRank: topic.priority_rank
    })),
    tags: rows.tags.map((tag) => tag.label),
    settings: {
      priorityGuidance: rows.settings?.priority_guidance ?? "",
      p1Label: rows.settings?.p1_label ?? "Today",
      p2Label: rows.settings?.p2_label ?? "End of Day",
      p3Label: rows.settings?.p3_label ?? "End of Week",
      p4Label: rows.settings?.p4_label ?? "Parking Lot",
      gentleLockEnabled: rows.settings?.gentle_lock_enabled ?? true
    },
    items: rows.items.map(mapRowItem)
  };
}

export function createSupabaseServerClient(options: { url: string; serviceRoleKey: string }) {
  return createClient(options.url, options.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function createSupabaseSyncApi(options: {
  client: SupabaseClient;
  classify: (input: CreateInboxItemInput, snapshot: WorkspaceSnapshot) => Promise<AIClassificationResult>;
}): SyncApi {
  const { client, classify } = options;

  return {
    async getWorkspaceSnapshot(workspaceId) {
      return fetchWorkspaceSnapshot(client, workspaceId);
    },

    async createInboxItem(workspaceId, input) {
      const snapshot = await fetchWorkspaceSnapshot(client, workspaceId);
      const classification = await classify(input, snapshot);

      const { data, error } = await client
        .from("inbox_items")
        .insert({
          workspace_id: workspaceId,
          kind: classification.kind,
          status: "open",
          title: input.title,
          notes: input.notes ?? "",
          tags: classification.tags,
          relative_priority: classification.suggestedPriority,
          ordering_mode: "ai",
          ai_rank: 0,
          project_id: classification.projectId ?? null,
          topic_id: classification.topicId ?? null,
          is_multi_day: input.isMultiDay ?? false,
          start_at: input.startAt ?? null,
          due_at: input.dueAt ?? null,
          follow_up_contact: input.followUpContact?.fullName
            ? {
                id: createId("contact"),
                fullName: input.followUpContact.fullName,
                email: input.followUpContact.email ?? null,
                phone: input.followUpContact.phone ?? null
              }
            : null,
          attachments: (input.attachments ?? []).map((attachment) => ({
            id: createId("attachment"),
            fileName: attachment.fileName,
            mimeType: attachment.mimeType ?? "text/uri-list",
            url: attachment.url
          })),
          ai_summary: {
            suggestedKind: classification.kind,
            suggestedPriority: classification.suggestedPriority,
            suggestedProjectId: classification.projectId ?? null,
            suggestedTopicId: classification.topicId ?? null,
            suggestedTags: classification.tags,
            reasoning: classification.reasoning
          }
        })
        .select("id,kind,status,title,notes,tags,relative_priority,ordering_mode,manual_rank,ai_rank,project_id,topic_id,is_multi_day,start_at,due_at,follow_up_contact,attachments,ai_summary")
        .single();

      if (error) {
        throw error;
      }

      return mapRowItem(data);
    },

    async reorderInboxItem(workspaceId, itemId, manualRank) {
      const { error } = await client
        .from("inbox_items")
        .update({
          ordering_mode: "manual",
          manual_rank: manualRank
        })
        .eq("workspace_id", workspaceId)
        .eq("id", itemId);

      if (error) {
        throw error;
      }
    },

    async updateInboxItem(workspaceId, itemId, input: UpdateInboxItemInput) {
      const updatePayload: Record<string, unknown> = {};

      if (input.kind !== undefined) {
        updatePayload.kind = input.kind;
      }
      if (input.status !== undefined) {
        updatePayload.status = input.status;
      }
      if (input.title !== undefined) {
        updatePayload.title = input.title;
      }
      if (input.notes !== undefined) {
        updatePayload.notes = input.notes;
      }
      if (input.relativePriority !== undefined) {
        updatePayload.relative_priority = input.relativePriority;
      }
      if (input.tags !== undefined) {
        updatePayload.tags = input.tags;
      }
      if (input.projectId !== undefined) {
        updatePayload.project_id = input.projectId ?? null;
      }
      if (input.topicId !== undefined) {
        updatePayload.topic_id = input.topicId ?? null;
      }
      if (input.isMultiDay !== undefined) {
        updatePayload.is_multi_day = input.isMultiDay;
      }
      if (input.startAt !== undefined) {
        updatePayload.start_at = input.startAt ?? null;
      }
      if (input.dueAt !== undefined) {
        updatePayload.due_at = input.dueAt ?? null;
      }
      if (input.followUpContact !== undefined) {
        updatePayload.follow_up_contact = input.followUpContact.fullName
          ? {
              id: createId("contact"),
              fullName: input.followUpContact.fullName,
              email: input.followUpContact.email ?? null,
              phone: input.followUpContact.phone ?? null
            }
          : null;
      }

      const { error } = await client
        .from("inbox_items")
        .update(updatePayload)
        .eq("workspace_id", workspaceId)
        .eq("id", itemId);

      if (error) {
        throw error;
      }
    },

    async classifyInboxItem(workspaceId, itemId) {
      const snapshot = await fetchWorkspaceSnapshot(client, workspaceId);
      const item = snapshot.items.find((entry) => entry.id === itemId);
      if (!item) {
        throw new Error(`Item not found: ${itemId}`);
      }

      const classification = await classify(
        {
          kind: item.kind,
          title: item.title,
          notes: item.notes,
          relativePriority: item.relativePriority,
          tags: item.tags,
          projectId: item.projectId,
          topicId: item.topicId,
          isMultiDay: item.isMultiDay,
          startAt: item.startAt,
          dueAt: item.dueAt
        },
        snapshot
      );

      const { error } = await client
        .from("inbox_items")
        .update({
          kind: classification.kind,
          relative_priority: classification.suggestedPriority,
          project_id: classification.projectId ?? null,
          topic_id: classification.topicId ?? null,
          tags: classification.tags,
          ai_summary: {
            suggestedKind: classification.kind,
            suggestedPriority: classification.suggestedPriority,
            suggestedProjectId: classification.projectId ?? null,
            suggestedTopicId: classification.topicId ?? null,
            suggestedTags: classification.tags,
            reasoning: classification.reasoning
          }
        })
        .eq("workspace_id", workspaceId)
        .eq("id", itemId);

      if (error) {
        throw error;
      }

      return classification;
    },

    async updateWorkspaceSettings(workspaceId, input: WorkspaceSettingsInput) {
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
    },

    async addSetupEntry(workspaceId, type: SetupEntryType, value: string) {
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error("Value is required.");
      }

      if (type === "tags") {
        const { error } = await client.from("tags").insert({
          workspace_id: workspaceId,
          label: trimmed
        });

        if (error) {
          throw error;
        }

        return;
      }

      const { data: existing, error: existingError } = await client
        .from(type)
        .select("priority_rank")
        .eq("workspace_id", workspaceId)
        .order("priority_rank", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      const nextRank = (existing?.priority_rank ?? 0) + 1;
      const { error } = await client.from(type).insert({
        workspace_id: workspaceId,
        title: trimmed,
        priority_rank: nextRank
      });

      if (error) {
        throw error;
      }
    },

    async deleteSetupEntry(workspaceId, type, identifier) {
      if (type === "tags") {
        if (!identifier.label) {
          throw new Error("Tag label is required.");
        }

        const { error } = await client
          .from("tags")
          .delete()
          .eq("workspace_id", workspaceId)
          .eq("label", identifier.label);

        if (error) {
          throw error;
        }

        return;
      }

      if (!identifier.id) {
        throw new Error("Entry id is required.");
      }

      const { error } = await client.from(type).delete().eq("workspace_id", workspaceId).eq("id", identifier.id);

      if (error) {
        throw error;
      }
    },

    async moveSetupEntry(workspaceId, type, id, direction) {
      const { data: entries, error } = await client
        .from(type)
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
        .from(type)
        .update({ priority_rank: target.priority_rank })
        .eq("workspace_id", workspaceId)
        .eq("id", current.id);

      if (currentUpdate.error) {
        throw currentUpdate.error;
      }

      const targetUpdate = await client
        .from(type)
        .update({ priority_rank: current.priority_rank })
        .eq("workspace_id", workspaceId)
        .eq("id", target.id);

      if (targetUpdate.error) {
        throw targetUpdate.error;
      }
    }
  };
}
