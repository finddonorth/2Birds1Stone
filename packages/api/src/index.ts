import {
  demoWorkspaceSnapshot,
  type CaptureInput,
  type InboxItem,
  type RankedEntity,
  type RelativePriority,
  type SetupEntryType,
  type UpdateInboxItemInput,
  type WorkspaceSettingsInput,
  type WorkspaceSnapshot
} from "@two-birds/shared";

export type CreateInboxItemInput = CaptureInput;

export interface AIClassificationResult {
  kind: "idea" | "task";
  suggestedPriority: RelativePriority;
  projectId?: string;
  topicId?: string;
  tags: string[];
  reasoning: string;
  heuristicScore?: number;
}

export interface SyncApi {
  getWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot>;
  createInboxItem(workspaceId: string, input: CreateInboxItemInput): Promise<InboxItem>;
  updateInboxItem(workspaceId: string, itemId: string, input: UpdateInboxItemInput): Promise<void>;
  reorderInboxItem(workspaceId: string, itemId: string, manualRank: number): Promise<void>;
  classifyInboxItem(workspaceId: string, itemId: string): Promise<AIClassificationResult>;
  updateWorkspaceSettings(workspaceId: string, input: WorkspaceSettingsInput): Promise<void>;
  addSetupEntry(workspaceId: string, type: SetupEntryType, value: string): Promise<void>;
  deleteSetupEntry(
    workspaceId: string,
    type: SetupEntryType,
    identifier: { id?: string; label?: string }
  ): Promise<void>;
  moveSetupEntry(workspaceId: string, type: Exclude<SetupEntryType, "tags">, id: string, direction: "up" | "down"): Promise<void>;
}

function cloneSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    goals: [...snapshot.goals],
    projects: [...snapshot.projects],
    topics: [...snapshot.topics],
    tags: [...snapshot.tags],
    settings: { ...snapshot.settings },
    items: snapshot.items.map((item) => ({
      ...item,
      tags: [...item.tags],
      attachments: [...item.attachments],
      followUpContact: item.followUpContact ? { ...item.followUpContact } : undefined,
      aiSuggestedSummary: item.aiSuggestedSummary ? { ...item.aiSuggestedSummary } : undefined
    }))
  };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function findRankedMatch(
  haystack: string,
  entries: WorkspaceSnapshot["projects"] | WorkspaceSnapshot["topics"] | WorkspaceSnapshot["goals"]
) {
  return entries.find((entry) => {
    const normalizedTitle = normalize(entry.title);
    const titleWords = normalizedTitle.split(/\s+/).filter((word) => word.length > 2);
    return normalizedTitle && (haystack.includes(normalizedTitle) || titleWords.some((word) => haystack.includes(word)));
  });
}

function getRankBoost(priorityRank: number | undefined, total: number): number {
  if (!priorityRank || total <= 0) {
    return 0;
  }

  return Math.max(0, total - priorityRank + 1) / total;
}

function inferClassification(input: CreateInboxItemInput, snapshot: WorkspaceSnapshot): AIClassificationResult {
  const haystack = normalize(`${input.title} ${input.notes ?? ""}`);

  const kind =
    input.kind === "idea" || haystack.includes("idea") || haystack.includes("brainstorm") ? "idea" : "task";

  let suggestedPriority: RelativePriority = input.relativePriority ?? "p3";
  let urgencyScore = 0.25;
  if (input.dueAt) {
    suggestedPriority = "p1";
    urgencyScore = 1;
  } else if (haystack.includes("today") || haystack.includes("urgent") || haystack.includes("asap")) {
    suggestedPriority = "p1";
    urgencyScore = 0.9;
  } else if (haystack.includes("this week") || haystack.includes("follow up")) {
    suggestedPriority = "p2";
    urgencyScore = 0.7;
  } else if (haystack.includes("someday") || haystack.includes("later")) {
    suggestedPriority = "p4";
    urgencyScore = 0.1;
  }

  const project = input.projectId
    ? snapshot.projects.find((entry) => entry.id === input.projectId)
    : findRankedMatch(haystack, snapshot.projects);
  const topic = input.topicId
    ? snapshot.topics.find((entry) => entry.id === input.topicId)
    : findRankedMatch(haystack, snapshot.topics);
  const goal = findRankedMatch(haystack, snapshot.goals);
  const tags = snapshot.tags.filter((tag) => haystack.includes(normalize(tag))).slice(0, 3);

  const projectBoost = getRankBoost(project?.priorityRank, snapshot.projects.length);
  const topicBoost = getRankBoost(topic?.priorityRank, snapshot.topics.length);
  const goalBoost = getRankBoost(goal?.priorityRank, snapshot.goals.length);
  const heuristicScore = Number((urgencyScore + projectBoost * 0.6 + topicBoost * 0.35 + goalBoost * 0.5).toFixed(2));

  if (!input.relativePriority) {
    if (heuristicScore >= 1.2) {
      suggestedPriority = "p1";
    } else if (heuristicScore >= 0.8) {
      suggestedPriority = "p2";
    } else if (heuristicScore <= 0.2) {
      suggestedPriority = "p4";
    }
  }

  const matchedDrivers = [
    project ? `project "${project.title}" (#${project.priorityRank})` : undefined,
    topic ? `topic "${topic.title}" (#${topic.priorityRank})` : undefined,
    goal ? `goal "${goal.title}" (#${goal.priorityRank})` : undefined
  ].filter(Boolean);

  return {
    kind,
    suggestedPriority,
    projectId: project?.id,
    topicId: topic?.id,
    tags: input.tags?.length ? input.tags : tags,
    reasoning:
      input.dueAt
        ? "Due date detected, so this was elevated for deadline-driven attention."
        : matchedDrivers.length
          ? `Priority was influenced by ${matchedDrivers.join(", ")} plus urgency signals.`
          : "Priority was inferred from urgency words and your saved guidance.",
    heuristicScore
  };
}

export function createMockSyncApi(seed: WorkspaceSnapshot = demoWorkspaceSnapshot): SyncApi {
  const snapshot = cloneSnapshot(seed);

  function addRankedEntry(entries: RankedEntity[], title: string): RankedEntity[] {
    return [...entries, { id: `${entries.length + 1}-${title}`, title, priorityRank: entries.length + 1 }];
  }

  return {
    async getWorkspaceSnapshot() {
      return cloneSnapshot(snapshot);
    },

    async createInboxItem(_workspaceId, input) {
      const classification = inferClassification(input, snapshot);
      const newItem: InboxItem = {
        id: `item-${snapshot.items.length + 1}`,
        kind: classification.kind,
        status: "open",
        title: input.title,
        notes: input.notes ?? "",
        tags: classification.tags,
        relativePriority: classification.suggestedPriority,
        orderingMode: "ai",
        aiRank: classification.heuristicScore ?? 0.25,
        projectId: classification.projectId,
        topicId: classification.topicId,
        isMultiDay: input.isMultiDay ?? false,
        startAt: input.startAt,
        dueAt: input.dueAt,
        followUpContact: input.followUpContact
          ? {
              id: `contact-${snapshot.items.length + 1}`,
              fullName: input.followUpContact.fullName,
              email: input.followUpContact.email,
              phone: input.followUpContact.phone
            }
          : undefined,
        attachments: (input.attachments ?? []).map((attachment, index) => ({
          id: `attachment-${snapshot.items.length + 1}-${index + 1}`,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType ?? "text/uri-list",
          url: attachment.url
        })),
        aiSuggestedSummary: {
          suggestedKind: classification.kind,
          suggestedPriority: classification.suggestedPriority,
          suggestedProjectId: classification.projectId,
          suggestedTopicId: classification.topicId,
          suggestedTags: classification.tags,
          reasoning: classification.reasoning
        }
      };

      snapshot.items = [newItem, ...snapshot.items];
      return {
        ...newItem,
        tags: [...newItem.tags],
        attachments: [...newItem.attachments],
        followUpContact: newItem.followUpContact ? { ...newItem.followUpContact } : undefined
      };
    },

    async reorderInboxItem(_workspaceId, itemId, manualRank) {
      snapshot.items = snapshot.items.map((item) =>
        item.id === itemId ? { ...item, orderingMode: "manual", manualRank } : item
      );
    },

    async updateInboxItem(_workspaceId, itemId, input) {
      snapshot.items = snapshot.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              kind: input.kind ?? item.kind,
              status: input.status ?? item.status,
              title: input.title ?? item.title,
              notes: input.notes ?? item.notes,
              relativePriority: input.relativePriority ?? item.relativePriority,
              tags: input.tags ?? item.tags,
              projectId: input.projectId ?? item.projectId,
              topicId: input.topicId ?? item.topicId,
              isMultiDay: input.isMultiDay ?? item.isMultiDay,
              startAt: input.startAt === undefined ? item.startAt : input.startAt,
              dueAt: input.dueAt === undefined ? item.dueAt : input.dueAt,
              followUpContact:
                input.followUpContact === undefined
                  ? item.followUpContact
                  : input.followUpContact.fullName
                    ? {
                        id: item.followUpContact?.id ?? `contact-${item.id}`,
                        fullName: input.followUpContact.fullName,
                        email: input.followUpContact.email,
                        phone: input.followUpContact.phone
                      }
                    : undefined
            }
          : item
      );
    },

    async classifyInboxItem(_workspaceId, itemId) {
      const item = snapshot.items.find((entry) => entry.id === itemId);
      if (!item) {
        throw new Error(`Item not found: ${itemId}`);
      }

      const result = inferClassification(
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

      snapshot.items = snapshot.items.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              kind: result.kind,
              relativePriority: result.suggestedPriority,
              projectId: result.projectId,
              topicId: result.topicId,
              tags: result.tags,
              aiRank: result.heuristicScore ?? entry.aiRank,
              aiSuggestedSummary: {
                suggestedKind: result.kind,
                suggestedPriority: result.suggestedPriority,
                suggestedProjectId: result.projectId,
                suggestedTopicId: result.topicId,
                suggestedTags: result.tags,
                reasoning: result.reasoning
              }
            }
          : entry
      );

      return result;
    },

    async updateWorkspaceSettings(_workspaceId, input) {
      snapshot.settings = { ...input };
    },

    async addSetupEntry(_workspaceId, type, value) {
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error("Value is required.");
      }

      if (type === "goals") {
        snapshot.goals = addRankedEntry(snapshot.goals, trimmed);
      } else if (type === "projects") {
        snapshot.projects = addRankedEntry(snapshot.projects, trimmed);
      } else if (type === "topics") {
        snapshot.topics = addRankedEntry(snapshot.topics, trimmed);
      } else {
        snapshot.tags = [...snapshot.tags, trimmed];
      }
    },

    async deleteSetupEntry(_workspaceId, type, identifier) {
      if (type === "goals" && identifier.id) {
        snapshot.goals = snapshot.goals.filter((entry) => entry.id !== identifier.id);
      } else if (type === "projects" && identifier.id) {
        snapshot.projects = snapshot.projects.filter((entry) => entry.id !== identifier.id);
      } else if (type === "topics" && identifier.id) {
        snapshot.topics = snapshot.topics.filter((entry) => entry.id !== identifier.id);
      } else if (type === "tags" && identifier.label) {
        snapshot.tags = snapshot.tags.filter((entry) => entry !== identifier.label);
      }
    },

    async moveSetupEntry(_workspaceId, type, id, direction) {
      const list =
        type === "goals" ? snapshot.goals : type === "projects" ? snapshot.projects : snapshot.topics;
      const index = list.findIndex((entry) => entry.id === id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= list.length) {
        return;
      }

      const next = [...list];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      next.forEach((entry, rankIndex) => {
        entry.priorityRank = rankIndex + 1;
      });

      if (type === "goals") {
        snapshot.goals = next;
      } else if (type === "projects") {
        snapshot.projects = next;
      } else {
        snapshot.topics = next;
      }
    }
  };
}

export function createHttpSyncApi(options: {
  baseUrl: string;
  workspaceId: string;
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
}): SyncApi {
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  async function buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const accessToken = options.getAccessToken ? await options.getAccessToken() : undefined;
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return headers;
  }

  return {
    async getWorkspaceSnapshot(workspaceId = options.workspaceId) {
      const response = await fetch(`${baseUrl}/api/workspace?workspaceId=${encodeURIComponent(workspaceId)}`, {
        headers: await buildHeaders()
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch workspace snapshot: ${response.status}`);
      }
      return (await response.json()) as WorkspaceSnapshot;
    },

    async createInboxItem(workspaceId = options.workspaceId, input) {
      const response = await fetch(`${baseUrl}/api/items`, {
        method: "POST",
        headers: {
          ...(await buildHeaders()),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, input })
      });
      if (!response.ok) {
        throw new Error(`Failed to create item: ${response.status}`);
      }
      return (await response.json()) as InboxItem;
    },

    async updateInboxItem(workspaceId = options.workspaceId, itemId, input) {
      const response = await fetch(`${baseUrl}/api/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: {
          ...(await buildHeaders()),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, input })
      });
      if (!response.ok) {
        throw new Error(`Failed to update item: ${response.status}`);
      }
    },

    async reorderInboxItem(workspaceId = options.workspaceId, itemId, manualRank) {
      const response = await fetch(`${baseUrl}/api/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: {
          ...(await buildHeaders()),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, manualRank })
      });
      if (!response.ok) {
        throw new Error(`Failed to reorder item: ${response.status}`);
      }
    },

    async classifyInboxItem(workspaceId = options.workspaceId, itemId) {
      const response = await fetch(`${baseUrl}/api/items/${encodeURIComponent(itemId)}/classify`, {
        method: "POST",
        headers: {
          ...(await buildHeaders()),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId })
      });
      if (!response.ok) {
        throw new Error(`Failed to classify item: ${response.status}`);
      }
      return (await response.json()) as AIClassificationResult;
    },

    async updateWorkspaceSettings(workspaceId = options.workspaceId, input) {
      const response = await fetch(`${baseUrl}/api/setup/settings`, {
        method: "PUT",
        headers: {
          ...(await buildHeaders()),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, input })
      });
      if (!response.ok) {
        throw new Error(`Failed to update workspace settings: ${response.status}`);
      }
    },

    async addSetupEntry(workspaceId = options.workspaceId, type, value) {
      const response = await fetch(`${baseUrl}/api/setup/entries`, {
        method: "POST",
        headers: {
          ...(await buildHeaders()),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, type, value })
      });
      if (!response.ok) {
        throw new Error(`Failed to add setup entry: ${response.status}`);
      }
    },

    async deleteSetupEntry(workspaceId = options.workspaceId, type, identifier) {
      const response = await fetch(`${baseUrl}/api/setup/entries`, {
        method: "DELETE",
        headers: {
          ...(await buildHeaders()),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, type, identifier })
      });
      if (!response.ok) {
        throw new Error(`Failed to delete setup entry: ${response.status}`);
      }
    },

    async moveSetupEntry(workspaceId = options.workspaceId, type, id, direction) {
      const response = await fetch(`${baseUrl}/api/setup/reorder`, {
        method: "POST",
        headers: {
          ...(await buildHeaders()),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workspaceId, type, id, direction })
      });
      if (!response.ok) {
        throw new Error(`Failed to reorder setup entry: ${response.status}`);
      }
    }
  };
}

export * from "./openai";
export * from "./supabase";
